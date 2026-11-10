"use client";

import { cn } from "@/lib/utils";
import { FileUpIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";

export function FileDropzone({
  accept,
  disabled,
  busy,
  progress,
  label = "Drop a photo or PDF, or click to choose",
  onFile,
}: {
  accept: string;
  disabled?: boolean;
  busy?: boolean;
  progress?: number;
  label?: string;
  onFile: (file: File) => void;
}) {
  const [over, setOver] = useState(false);

  return (
    <label
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled && !busy) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        if (disabled || busy) return;
        const file = event.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground transition-colors",
        over ? "border-accent bg-accent/10 text-foreground" : "border-border bg-muted/20",
        (disabled || busy) && "pointer-events-none opacity-60",
      )}
    >
      {busy ? (
        <Loader2Icon className="size-4 animate-spin" aria-hidden />
      ) : (
        <FileUpIcon className="size-4" aria-hidden />
      )}
      <span>
        {busy
          ? `Uploading… ${progress ?? 0}%`
          : label}
      </span>
      <input
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled || busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
    </label>
  );
}
