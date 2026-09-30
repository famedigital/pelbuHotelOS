import { cn } from "@/lib/utils";

export function ProductFrame({
  url,
  children,
  className,
  bodyClassName,
}: {
  url: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-black/10 bg-[#0c1726] shadow-[0_24px_60px_-28px_rgba(12,23,38,0.55)]",
        className,
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="size-2 rounded-full bg-white/25" />
        <span className="size-2 rounded-full bg-white/25" />
        <span className="size-2 rounded-full bg-white/25" />
        <p className="mx-auto max-w-[70%] truncate rounded-md bg-white/10 px-3 py-0.5 text-[10px] tracking-wide text-white/75">
          {url}
        </p>
      </div>
      <div className={cn("bg-[#f4f7fb]", bodyClassName)}>{children}</div>
    </div>
  );
}
