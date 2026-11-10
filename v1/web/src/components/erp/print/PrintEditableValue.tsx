"use client";

import { useEffect, useRef } from "react";

type Listener = (value: string) => void;

const buckets = new Map<string, { value: string; listeners: Set<Listener> }>();

function bucket(key: string, initial: string) {
  let row = buckets.get(key);
  if (!row) {
    row = { value: initial, listeners: new Set() };
    buckets.set(key, row);
  }
  return row;
}

/**
 * Room number on a printed invoice. Click and type before printing.
 * Copies with the same syncKey stay in step. Nothing is saved.
 */
export function PrintEditableValue({
  syncKey,
  initial,
  placeholder = "Room no.",
  className,
  hint = false,
}: {
  syncKey: string;
  initial: string;
  placeholder?: string;
  className?: string;
  hint?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const row = bucket(syncKey, initial);
    if (!row.value && initial) row.value = initial;
    const el = ref.current;
    if (el && document.activeElement !== el) {
      el.textContent = row.value;
    }
    const listener: Listener = (next) => {
      const node = ref.current;
      if (!node || document.activeElement === node) return;
      node.textContent = next;
    };
    row.listeners.add(listener);
    return () => {
      row.listeners.delete(listener);
    };
  }, [syncKey, initial]);

  return (
    <>
      {hint ? (
        <style>{`
          .print-room-edit:empty::before {
            content: attr(data-placeholder);
            color: #8a7f76;
            font-weight: 400;
          }
          @media print {
            .print-room-edit:empty::before { content: none; }
            .print-room-hint { display: none !important; }
          }
        `}</style>
      ) : null}
      <span
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Room number"
        data-placeholder={placeholder}
        spellCheck={false}
        className={`print-room-edit cursor-text rounded-sm outline-none hover:bg-white/80 focus:bg-white focus:ring-1 focus:ring-[#1a1410]/30 print:bg-transparent print:ring-0 ${className ?? ""}`}
        onInput={(event) => {
          const next = event.currentTarget.textContent ?? "";
          const row = bucket(syncKey, initial);
          row.value = next;
          for (const listener of row.listeners) listener(next);
        }}
      >
        {initial}
      </span>
      {hint ? (
        <span className="print-room-hint mt-0.5 block text-[9px] font-normal tracking-normal text-[#8a7f76] normal-case">
          Click to change the room number. Print uses what you type. The stay
          is not changed.
        </span>
      ) : null}
    </>
  );
}
