"use client";

import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CommandPalette } from "@hotel-os/ui";
import { toast } from "sonner";
import { readV2DeskToken } from "@/lib/v2/desk-api";
import { getDeskApiBaseUrl } from "@/lib/v2/desk-api";

/** Map apps/desk paths from the command registry to Innora `/v2/*`. */
function deskPathToV2(path: string): string {
  if (!path || path === "/") return "/v2/desk";
  if (path.startsWith("/v2")) return path;
  return `/v2${path}`;
}

export function V2CommandPaletteHost(): ReactElement | null {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onNavigate = useCallback(
    (path: string) => {
      router.push(deskPathToV2(path));
    },
    [router],
  );

  const onCopilot = useCallback(async (prompt: string) => {
    const token = readV2DeskToken();
    if (!token) {
      toast.error("Sign in with staff PIN to use Copilot drafts.");
      return;
    }
    try {
      const res = await fetch(`${getDeskApiBaseUrl()}/v1/ai/desk`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          context: { route: typeof window !== "undefined" ? window.location.pathname : "" },
        }),
      });
      const text = await res.text();
      const data = text ? (JSON.parse(text) as { reply?: string; error?: string }) : {};
      if (!res.ok) {
        throw new Error(data.error || text.slice(0, 200) || `HTTP ${res.status}`);
      }
      toast.message("Draft (BYOK)", {
        description: data.reply?.slice(0, 280) || "No reply text.",
      });
    } catch (err) {
      console.error("[V2CommandPaletteHost] copilot", { err });
      toast.error(
        err instanceof Error ? err.message : "Copilot request failed.",
      );
    }
  }, []);

  return (
    <CommandPalette
      open={open}
      onClose={() => setOpen(false)}
      onNavigate={onNavigate}
      onCopilot={onCopilot}
    />
  );
}
