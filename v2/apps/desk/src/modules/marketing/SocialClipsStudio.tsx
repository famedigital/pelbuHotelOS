import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Clapperboard,
  Download,
  Loader2,
  ShieldCheck,
  Upload,
} from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  GlassPanel,
} from "@hos-v2/ui";
import {
  CLIP_TOOLS,
  downloadBlob,
  preloadFfmpeg,
  runClipTool,
  type ClipAspect,
  type ClipContainer,
  type ClipToolId,
  type CompressPreset,
  type AudioFormat,
} from "../../lib/ffmpeg-clips";

const ASPECTS: ClipAspect[] = ["9:16", "16:9", "1:1", "4:5"];
const CONTAINERS: ClipContainer[] = ["mp4", "webm", "mov"];
const AUDIO_FMTS: AudioFormat[] = ["mp3", "wav"];
const CRF: CompressPreset[] = ["light", "medium", "heavy"];

export function SocialClipsStudio() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [, start] = useTransition();
  const [tool, setTool] = useState<ClipToolId>("aspect");
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [engineReady, setEngineReady] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultName, setResultName] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [metaText, setMetaText] = useState<string | null>(null);

  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(30);
  const [aspect, setAspect] = useState<ClipAspect>("9:16");
  const [container, setContainer] = useState<ClipContainer>("mp4");
  const [audioFormat, setAudioFormat] = useState<AudioFormat>("mp3");
  const [crfPreset, setCrfPreset] = useState<CompressPreset>("medium");
  const [frameAtSec, setFrameAtSec] = useState(1);
  const [captionText, setCaptionText] = useState(
    "00:00:00,000 --> 00:00:04,000\nWelcome to our Himalayan suite\n",
  );
  const [captionBurn, setCaptionBurn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await preloadFfmpeg();
      if (cancelled) return;
      if (!res.ok) {
        toast.error("Clip engine failed to load", { description: res.error });
        return;
      }
      setEngineReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [sourceUrl, resultUrl]);

  const toolMeta = useMemo(
    () => CLIP_TOOLS.find((t) => t.id === tool) ?? CLIP_TOOLS[0]!,
    [tool],
  );

  const onPickFile = (next: File | null) => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);
    setResultBlob(null);
    setResultName(null);
    setMetaText(null);
    setFile(next);
    setSourceUrl(next ? URL.createObjectURL(next) : null);
  };

  const applyReelsPreset = () => {
    setTool("aspect");
    setAspect("9:16");
    setStartSec(0);
    setEndSec(30);
    toast.message("Reels preset", { description: "9:16 · trim 0–30s next via Slicer" });
  };

  const run = () => {
    if (!file) {
      toast.error("Drop a hotel video first");
      return;
    }
    if (!engineReady) {
      toast.error("Clip engine still loading");
      return;
    }
    start(async () => {
      setBusy(true);
      setProgress(0);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      setResultUrl(null);
      setResultBlob(null);
      setMetaText(null);
      try {
        // Optional pre-slice when aspect/gif and user set range via slicer fields
        const options = {
          startSec,
          endSec,
          aspect,
          container,
          audioFormat,
          crfPreset,
          frameAtSec,
          captionText,
          captionBurn,
          gifFps: 10,
          gifScale: 480,
        };
        const res = await runClipTool(tool, file, options, (r) =>
          setProgress(Math.round(r * 100)),
        );
        if (!res.ok) {
          toast.error("Processing failed", { description: res.error });
          return;
        }
        setResultUrl(res.objectUrl || null);
        setResultBlob(res.blob);
        setResultName(res.outName);
        if (res.text) setMetaText(res.text);
        toast.success("Clip ready", { description: res.outName });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[SocialClipsStudio] run failed", { err: msg });
        toast.error("Processing failed", { description: msg });
      } finally {
        setBusy(false);
        setProgress(100);
      }
    });
  };

  const previewIsVideo =
    resultBlob?.type.startsWith("video/") ||
    (!resultBlob && sourceUrl && file?.type.startsWith("video/"));
  const previewIsImage =
    resultBlob?.type.startsWith("image/") ||
    resultName?.endsWith(".gif") ||
    resultName?.endsWith(".jpg");
  const previewIsAudio = resultBlob?.type.startsWith("audio/");

  return (
    <div className="flex flex-col gap-4">
      <div className="hos-glass-card flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs text-[var(--hos-ink-2)]">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--hos-emerald)]" />
        <p className="m-0">
          <strong className="text-[var(--hos-ink)]">Processed on this device</strong>
          {" — "}
          video is not uploaded. FFmpeg runs in a browser worker (AutoClipr-style free tools).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {CLIP_TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTool(t.id)}
            className={`hos-btn-tactile rounded-xl border px-3 py-2 text-left text-xs transition ${
              tool === t.id
                ? "border-[var(--hos-primary)] bg-[rgba(37,99,235,0.1)] text-[var(--hos-ink)]"
                : "border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink-2)]"
            }`}
          >
            <div className="font-semibold">{t.label}</div>
            <div className="text-[10px] text-[var(--hos-ink-3)]">{t.blurb}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="default">{toolMeta.label}</Badge>
        <span className="text-[11px] text-[var(--hos-ink-3)]">{toolMeta.blurb}</span>
        <Button size="sm" variant="secondary" onClick={applyReelsPreset}>
          Reels 9:16 30s
        </Button>
        <span className="ml-auto text-[10px] text-[var(--hos-ink-3)]">
          {engineReady ? "Engine ready" : "Loading WASM…"}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <GlassPanel className="flex flex-col gap-3 p-3.5">
          <input
            ref={inputRef}
            type="file"
            accept="video/*,audio/*,.mkv,.mov,.webm,.mp4"
            className="sr-only"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          />
          {!file ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="hos-cell flex min-h-[180px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--hos-line)] p-6 text-center"
            >
              <Upload className="size-8 text-[var(--hos-primary)]" />
              <EmptyState
                title="Drop hotel walkthrough / suite video"
                description="MP4, MOV, WebM, MKV — stays on this machine."
              />
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium text-[var(--hos-ink)]">
                  <Clapperboard className="mr-1 inline size-3.5" />
                  {file.name}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    onPickFile(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                >
                  Clear
                </Button>
              </div>
              <div className="hos-cell overflow-hidden rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)]">
                {resultUrl && previewIsImage ? (
                  <img
                    src={resultUrl}
                    alt="Clip result"
                    className="max-h-[360px] w-full object-contain"
                  />
                ) : resultUrl && previewIsAudio ? (
                  <audio controls src={resultUrl} className="w-full p-3" />
                ) : (
                  <video
                    controls
                    src={resultUrl ?? sourceUrl ?? undefined}
                    className="max-h-[360px] w-full bg-black object-contain"
                  />
                )}
              </div>
              {busy ? (
                <div className="hos-cell rounded-lg border border-[var(--hos-line)] px-3 py-2">
                  <div className="mb-1 flex items-center gap-2 text-[11px] font-medium text-[var(--hos-ink-2)]">
                    <Loader2 className="size-3.5 animate-spin" />
                    Processing {progress}%
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[rgba(15,23,42,0.08)]">
                    <div
                      className="h-full rounded-full bg-[var(--hos-primary)] transition-[width] duration-150"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ) : null}
              {metaText ? (
                <pre className="hos-cell max-h-40 overflow-auto rounded-xl border border-[var(--hos-line)] p-3 font-mono text-[10px] text-[var(--hos-ink-2)]">
                  {metaText}
                </pre>
              ) : null}
            </div>
          )}
        </GlassPanel>

        <GlassPanel className="flex flex-col gap-3 p-3.5">
          <strong className="text-sm text-[var(--hos-ink)]">Tool options</strong>

          {(tool === "slice" || tool === "gif") && (
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-[11px] font-medium">
                Start (s)
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={startSec}
                  onChange={(e) => setStartSec(Number(e.target.value) || 0)}
                  className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs"
                />
              </label>
              <label className="grid gap-1 text-[11px] font-medium">
                End (s)
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={endSec}
                  onChange={(e) => setEndSec(Number(e.target.value) || 0)}
                  className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs"
                />
              </label>
            </div>
          )}

          {tool === "convert" ? (
            <label className="grid gap-1 text-[11px] font-medium">
              Container
              <select
                value={container}
                onChange={(e) => setContainer(e.target.value as ClipContainer)}
                className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs"
              >
                {CONTAINERS.map((c) => (
                  <option key={c} value={c}>
                    {c.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {tool === "aspect" ? (
            <label className="grid gap-1 text-[11px] font-medium">
              Aspect
              <select
                value={aspect}
                onChange={(e) => setAspect(e.target.value as ClipAspect)}
                className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs"
              >
                {ASPECTS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {tool === "audio" ? (
            <label className="grid gap-1 text-[11px] font-medium">
              Format
              <select
                value={audioFormat}
                onChange={(e) => setAudioFormat(e.target.value as AudioFormat)}
                className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs"
              >
                {AUDIO_FMTS.map((a) => (
                  <option key={a} value={a}>
                    {a.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {tool === "compress" ? (
            <label className="grid gap-1 text-[11px] font-medium">
              CRF preset
              <select
                value={crfPreset}
                onChange={(e) => setCrfPreset(e.target.value as CompressPreset)}
                className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs"
              >
                {CRF.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {tool === "thumbnail" ? (
            <label className="grid gap-1 text-[11px] font-medium">
              Frame at (s)
              <input
                type="number"
                min={0}
                step={0.1}
                value={frameAtSec}
                onChange={(e) => setFrameAtSec(Number(e.target.value) || 0)}
                className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 text-xs"
              />
            </label>
          ) : null}

          {tool === "captions" ? (
            <div className="grid gap-2">
              <label className="grid gap-1 text-[11px] font-medium">
                SRT body
                <textarea
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                  rows={5}
                  className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5 font-mono text-[10px]"
                />
              </label>
              <label className="flex items-center gap-2 text-[11px] font-medium">
                <input
                  type="checkbox"
                  checked={captionBurn}
                  onChange={(e) => setCaptionBurn(e.target.checked)}
                />
                Burn into video (else download .srt)
              </label>
            </div>
          ) : null}

          {tool === "metadata" ? (
            <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
              Reads container tags via WASM ffmpeg — limited vs desktop ffprobe.
            </p>
          ) : null}

          <Button
            disabled={!file || busy || !engineReady}
            onClick={run}
            className="hos-btn-tactile"
          >
            {busy ? (
              <>
                <Loader2 className="mr-1 size-3.5 animate-spin" />
                Working…
              </>
            ) : (
              "Run tool"
            )}
          </Button>

          <Button
            variant="secondary"
            disabled={!resultBlob || !resultName}
            onClick={() => {
              if (resultBlob && resultName) downloadBlob(resultBlob, resultName);
            }}
            className="hos-btn-tactile"
          >
            <Download className="mr-1 size-3.5" />
            Download
          </Button>

          {!previewIsVideo && !file ? null : (
            <p className="m-0 text-[10px] text-[var(--hos-ink-3)]">
              Tip: Slicer → Aspect 9:16 → Compress for a hotel Reels pack.
            </p>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
