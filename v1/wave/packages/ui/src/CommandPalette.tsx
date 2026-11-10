"use client";

import { useEffect, useMemo, useState } from "react";
import { matchDeskCommands, type DeskCommand } from "./command-registry";

export function CommandPalette({
  open,
  onClose,
  onNavigate,
  onFastBook,
  onOpenStay,
  onCopilot,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  onFastBook?: () => void;
  onOpenStay?: (code: string) => void;
  onCopilot?: (prompt: string) => void;
}) {
  const [q, setQ] = useState("");
  const results = useMemo(() => matchDeskCommands(q), [q]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  if (!open) return null;

  const run = (cmd: DeskCommand) => {
    if (cmd.kind === "fast_book") {
      onFastBook?.();
      if (cmd.path) onNavigate(cmd.path);
    } else if (cmd.kind === "open_stay") {
      const code = cmd.title.replace(/^Open stay\s+/i, "");
      onOpenStay?.(code);
      if (cmd.path) onNavigate(cmd.path);
    } else if (cmd.kind === "copilot") {
      onCopilot?.(q || "help");
    } else if (cmd.path) {
      onNavigate(cmd.path);
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(15,23,42,0.45)",
        display: "grid",
        placeItems: "start center",
        paddingTop: 72,
      }}
      onClick={onClose}
    >
      <div
        className="hos-glass"
        style={{
          width: "min(560px, 92vw)",
          borderRadius: 16,
          padding: 12,
          transform: "translateZ(0)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Jump, Fast Book, PS-code, Copilot…"
          style={{
            width: "100%",
            background: "#fff",
            color: "#0f172a",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: "12px 14px",
            fontSize: 14,
            outline: "none",
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && results[0]) run(results[0]);
          }}
        />
        <div style={{ marginTop: 8, maxHeight: 360, overflow: "auto" }}>
          {results.map((cmd) => (
            <button
              key={cmd.id}
              type="button"
              onClick={() => run(cmd)}
              style={{
                display: "flex",
                width: "100%",
                textAlign: "left",
                gap: 8,
                padding: "10px 12px",
                borderRadius: 10,
                border: "none",
                background: "transparent",
                color: "#0f172a",
                cursor: "pointer",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{cmd.title}</div>
                {cmd.hint ? (
                  <div style={{ fontSize: 11, color: "#64748b" }}>{cmd.hint}</div>
                ) : null}
              </div>
              <span style={{ fontSize: 10, color: "#94a3b8" }}>{cmd.kind}</span>
            </button>
          ))}
          {!results.length ? (
            <div style={{ padding: 12, color: "#64748b", fontSize: 12 }}>
              No matches
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
