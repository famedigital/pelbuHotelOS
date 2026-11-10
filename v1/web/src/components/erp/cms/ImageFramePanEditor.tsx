"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useCallback,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

export type FrameAspect = "9/16" | "16/9" | "3/2";

const ASPECT_CLASS: Record<FrameAspect, string> = {
  "9/16": "aspect-[9/16]",
  "16/9": "aspect-video",
  "3/2": "aspect-[3/2]",
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, Math.round(n * 1000) / 1000));
}

/**
 * Android-gallery style frame pan: slide the photo inside a fixed crop
 * (phone tall / desktop wide). Live CSS object-position — WYSIWYG, not
 * a stale crosshair on a contain preview.
 */
export function ImageFramePanEditor({
  imageSrc,
  focalX,
  focalY,
  onChange,
  aspect = "9/16",
  label = "Slide to frame",
  hint,
  phoneChrome = false,
  className,
  verticalBias = false,
}: {
  imageSrc: string | null;
  focalX: number;
  focalY: number;
  onChange: (x: number, y: number) => void;
  aspect?: FrameAspect;
  label?: string;
  hint?: string;
  /** Soft phone bezels for mobile heroes. */
  phoneChrome?: boolean;
  className?: string;
  /** Weight vertical drag higher (mobile heroes). */
  verticalBias?: boolean;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    fx: number;
    fy: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const labelId = useId();

  const objectPosition = `${clamp01(focalX) * 100}% ${clamp01(focalY) * 100}%`;

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!imageSrc) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        fx: clamp01(focalX),
        fy: clamp01(focalY),
      };
      setDragging(true);
    },
    [focalX, focalY, imageSrc],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (!d || d.pointerId !== e.pointerId) return;
      const el = frameRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;

      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      // Drag the photo with the finger: down → see more sky/top (lower Y).
      const xSense = verticalBias ? 0.55 : 1;
      const ySense = verticalBias ? 1.35 : 1;
      const nextX = clamp01(d.fx - (dx / rect.width) * xSense);
      const nextY = clamp01(d.fy - (dy / rect.height) * ySense);
      onChange(nextX, nextY);
    },
    [onChange, verticalBias],
  );

  const endDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === e.pointerId) {
      drag.current = null;
      setDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    }
  }, []);

  const frame = (
    <div
      ref={frameRef}
      role="slider"
      aria-labelledby={labelId}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamp01(focalY) * 100)}
      aria-valuetext={`Focus ${Math.round(clamp01(focalX) * 100)}% across, ${Math.round(clamp01(focalY) * 100)}% down`}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 0.08 : 0.03;
        if (e.key === "ArrowUp") {
          e.preventDefault();
          onChange(clamp01(focalX), clamp01(focalY - step));
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          onChange(clamp01(focalX), clamp01(focalY + step));
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          onChange(clamp01(focalX - step), clamp01(focalY));
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          onChange(clamp01(focalX + step), clamp01(focalY));
        }
      }}
      className={cn(
        "relative w-full touch-none select-none overflow-hidden bg-muted",
        ASPECT_CLASS[aspect],
        phoneChrome ? "rounded-[1.25rem]" : "rounded-lg",
        imageSrc
          ? dragging
            ? "cursor-grabbing ring-2 ring-sky-500"
            : "cursor-grab ring-1 ring-border"
          : "ring-1 ring-dashed ring-border",
      )}
    >
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- live pan editor needs raw CSS object-position
        <img
          src={imageSrc}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition }}
        />
      ) : (
        <div className="flex h-full items-center justify-center px-3 text-center text-xs text-muted-foreground">
          Add a photo first
        </div>
      )}
      {/* Subtle grid + crosshair so orientation is clear while dragging */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(to right, transparent 33%, rgba(255,255,255,0.25) 33%, rgba(255,255,255,0.25) 34%, transparent 34%), linear-gradient(to bottom, transparent 33%, rgba(255,255,255,0.25) 33%, rgba(255,255,255,0.25) 34%, transparent 34%)",
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2 pb-2 pt-8">
        <p className="text-center text-[10px] font-medium tracking-wide text-white">
          {dragging ? "Release to lock frame" : "Drag / slide · arrows fine-tune"}
        </p>
      </div>
    </div>
  );

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p id={labelId} className="text-xs font-medium text-foreground">
            {label}
          </p>
          {hint ? (
            <p className="text-[11px] text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-[11px]"
          disabled={!imageSrc}
          onClick={() => onChange(0.5, 0.5)}
        >
          Reset centre
        </Button>
      </div>

      {phoneChrome ? (
        <div className="mx-auto w-full max-w-[220px]">
          <div className="rounded-[1.6rem] border-[3px] border-foreground/85 bg-foreground/90 p-1.5 shadow-lg">
            <div className="mb-1 flex justify-center">
              <span className="h-1 w-10 rounded-full bg-background/40" aria-hidden />
            </div>
            {frame}
            <div className="mt-1.5 flex justify-center pb-0.5">
              <span className="h-1 w-8 rounded-full bg-background/30" aria-hidden />
            </div>
          </div>
        </div>
      ) : (
        frame
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-[11px] text-muted-foreground">
          <span className="flex justify-between">
            <span>Left · right</span>
            <span className="font-mono tabular-nums text-foreground">
              {Math.round(clamp01(focalX) * 100)}%
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(clamp01(focalX) * 1000)}
            disabled={!imageSrc}
            onChange={(e) =>
              onChange(Number(e.target.value) / 1000, clamp01(focalY))
            }
            className="w-full accent-sky-600"
            aria-label="Horizontal frame position"
          />
        </label>
        <label className="space-y-1 text-[11px] text-muted-foreground">
          <span className="flex justify-between">
            <span>Slide up · down</span>
            <span className="font-mono tabular-nums text-foreground">
              {Math.round(clamp01(focalY) * 100)}%
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(clamp01(focalY) * 1000)}
            disabled={!imageSrc}
            onChange={(e) =>
              onChange(clamp01(focalX), Number(e.target.value) / 1000)
            }
            className="w-full accent-sky-600"
            aria-label="Vertical frame position"
          />
        </label>
      </div>
    </div>
  );
}

/** Full uncropped source for pan editor (object-cover does the frame). */
export function frameEditorSourceUrl(
  publicId: string | null | undefined,
  cloudinaryUrlFn: (
    id: string,
    t: { width: number; crop: "limit"; quality: "auto:good" },
  ) => string | null,
): string | null {
  if (!publicId?.trim()) return null;
  return cloudinaryUrlFn(publicId.trim(), {
    width: 1400,
    crop: "limit",
    quality: "auto:good",
  });
}
