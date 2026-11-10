"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCallback, useEffect, useState } from "react";

type Version = {
  id: string;
  version_label: string;
  version_no: number;
  sha256: string;
  status: string;
  requires_gemini: boolean;
  gemini_model: string | null;
  tested_at: string | null;
  approved_at: string | null;
  created_at: string;
  file_name?: string;
};

type Script = {
  id: string;
  kind: string;
  bank_code: string | null;
  name: string;
  description: string | null;
  is_builtin: boolean;
  latest_version: Version | null;
  versions?: Version[];
};

type Integration = {
  gemini: { configured: boolean; provider: string; model: string };
  worker: { secretConfigured: boolean };
};

export function FinanceImportsSettings() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [kind, setKind] = useState<"receipt" | "bank">("receipt");
  const [bankCode, setBankCode] = useState("bob");
  const [name, setName] = useState("");
  const [versionLabel, setVersionLabel] = useState("1.0.0");
  const [requiresGemini, setRequiresGemini] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch("/api/erp/finance/parsers");
    if (!res.ok) return;
    const data = (await res.json()) as {
      scripts: Script[];
      integration: Integration;
    };
    setScripts(data.scripts ?? []);
    setIntegration(data.integration);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setRequiresGemini(kind === "receipt");
  }, [kind]);

  async function uploadScript(file: File) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (!name.trim()) throw new Error("Display name is required.");
      if (!file.name.toLowerCase().endsWith(".py")) {
        throw new Error("Upload a .py parser script.");
      }
      const signRes = await fetch("/api/erp/finance/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "parser",
          fileName: file.name,
          mimeType: "text/x-python",
          byteSize: file.size,
        }),
      });
      const signed = (await signRes.json()) as {
        signedUrl?: string;
        path?: string;
        error?: string;
      };
      if (!signRes.ok || !signed.signedUrl || !signed.path) {
        throw new Error(signed.error ?? "Signed upload failed.");
      }
      const put = await fetch(signed.signedUrl, {
        method: "PUT",
        headers: { "content-type": "text/x-python" },
        body: file,
      });
      if (!put.ok) throw new Error("Could not store parser script.");

      const createRes = await fetch("/api/erp/finance/parsers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          bankCode: kind === "bank" ? bankCode : null,
          name: name.trim(),
          storagePath: signed.path,
          fileName: file.name,
          versionLabel,
          requiresGemini,
        }),
      });
      const created = (await createRes.json()) as { error?: string };
      if (!createRes.ok) throw new Error(created.error ?? "Could not register parser.");
      setMessage(`Uploaded ${file.name} as draft version. Test, then approve.`);
      setName("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function act(versionId: string, action: "approve" | "retire" | "set_default" | "test") {
    setBusy(true);
    setError(null);
    try {
      if (action === "test") {
        const res = await fetch(`/api/erp/finance/parsers/${versionId}/test`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ok: true,
            message: "Desk marked tested — run worker sandbox before production use.",
          }),
        });
        const j = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(j.error ?? "Test failed.");
        setMessage("Marked tested.");
      } else {
        const res = await fetch(`/api/erp/finance/parsers/${versionId}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const j = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(j.error ?? "Action failed.");
        setMessage(
          action === "approve"
            ? "Parser approved for Finance selection."
            : action === "retire"
              ? "Parser retired."
              : "Default parser updated.",
        );
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border p-4 space-y-3">
        <h2 className="text-base font-semibold">Integration status</h2>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <li className="rounded-md bg-muted/50 px-3 py-2">
            <span className="font-medium">Gemini</span>
            <p className="text-muted-foreground">
              {integration?.gemini.configured ? "Configured" : "Not configured"} ·{" "}
              {integration?.gemini.provider}/{integration?.gemini.model ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              Key lives in server/worker env only (`GEMINI_API_KEY`). Never stored in
              scripts or the database.
            </p>
          </li>
          <li className="rounded-md bg-muted/50 px-3 py-2">
            <span className="font-medium">Parser worker</span>
            <p className="text-muted-foreground">
              {integration?.worker.secretConfigured
                ? "Worker secret configured"
                : "FINANCE_WORKER_SECRET missing"}
            </p>
            <p className="text-xs text-muted-foreground">
              Uploaded Python runs only in `services/finance-parser-worker`, not on
              Vercel.
            </p>
          </li>
        </ul>
      </section>

      <section className="rounded-lg border border-border p-4 space-y-3">
        <h2 className="text-base font-semibold">Upload parser script</h2>
        <p className="text-sm text-muted-foreground">
          Scripts must expose <code>parse(input_path, context) -&gt; list[dict]</code>.
          Edits create a new immutable version. Approve before use in Finance.
        </p>
        <div className="flex flex-wrap gap-2">
          <select
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as "receipt" | "bank")}
          >
            <option value="receipt">Receipt</option>
            <option value="bank">Bank statement</option>
          </select>
          {kind === "bank" ? (
            <select
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
            >
              <option value="bob">BoB</option>
              <option value="bnb">BNB</option>
              <option value="tbank">T Bank</option>
              <option value="drukpnb">Druk PNB</option>
              <option value="other">Other</option>
            </select>
          ) : null}
          <Input
            className="h-9 max-w-xs"
            placeholder="Display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            className="h-9 w-28"
            placeholder="Version"
            value={versionLabel}
            onChange={(e) => setVersionLabel(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={requiresGemini}
              onChange={(e) => setRequiresGemini(e.target.checked)}
            />
            Needs Gemini
          </label>
          <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input px-3 text-sm hover:bg-muted">
            Choose .py
            <input
              type="file"
              accept=".py,text/x-python,text/plain"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void uploadScript(f);
              }}
            />
          </label>
        </div>
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Parser library</h2>
        <div className="overflow-auto rounded-md border">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-muted/80 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Kind</th>
                <th className="p-2 text-left">Version</th>
                <th className="p-2 text-left">SHA</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {scripts.map((s) => {
                const v = s.latest_version;
                return (
                  <tr key={s.id} className="border-t">
                    <td className="p-2">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.is_builtin ? "Built-in" : "Custom"}
                        {s.description ? ` · ${s.description}` : ""}
                      </div>
                    </td>
                    <td className="p-2 uppercase">
                      {s.kind}
                      {s.bank_code ? `/${s.bank_code}` : ""}
                    </td>
                    <td className="p-2">
                      {v ? `${v.version_label} (#${v.version_no})` : "—"}
                    </td>
                    <td className="p-2 font-mono text-xs">
                      {v?.sha256?.startsWith("builtin:")
                        ? v.sha256
                        : v?.sha256?.slice(0, 12) ?? "—"}
                    </td>
                    <td className="p-2 uppercase text-xs">{v?.status ?? "none"}</td>
                    <td className="p-2">
                      {v && !s.is_builtin ? (
                        <div className="flex flex-wrap gap-1">
                          {v.status === "draft" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => void act(v.id, "test")}
                            >
                              Mark tested
                            </Button>
                          ) : null}
                          {["draft", "tested"].includes(v.status) ? (
                            <Button
                              type="button"
                              size="sm"
                              disabled={busy}
                              onClick={() => void act(v.id, "approve")}
                            >
                              Approve
                            </Button>
                          ) : null}
                          {v.status === "approved" ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={busy}
                                onClick={() => void act(v.id, "set_default")}
                              >
                                Set default
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => void act(v.id, "retire")}
                              >
                                Retire
                              </Button>
                            </>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Worker built-in adapter
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!scripts.length ? (
                <tr>
                  <td colSpan={6} className="p-4 text-muted-foreground">
                    No parsers yet. Built-ins seed per property after migration.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
