"use client";

import { useDeskWorkspace } from "@/components/erp/DeskWorkspaceProvider";
import { resolveWorkspaceLandingHref } from "@/lib/erp/desk-workspace";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";

/**
 * Header chip: Front desk | Back office (eZee Absolute FO/BO rail → one ERP).
 * Flipping worlds persists preference and lands on that world's home.
 */
export function DeskWorkspaceToggle({
  className,
}: {
  className?: string;
} = {}) {
  const { workspace, setWorkspace, showToggle, allowedModuleKeys } =
    useDeskWorkspace();
  const router = useRouter();
  const pathname = usePathname();

  if (!showToggle) return null;

  const switchTo = (next: "front_desk" | "back_office") => {
    if (next === workspace) return;
    setWorkspace(next);
    const land = resolveWorkspaceLandingHref(next, allowedModuleKeys);
    if (pathname !== land && !pathname?.startsWith(`${land}/`)) {
      router.push(land);
    }
  };

  return (
    <div
      role="group"
      aria-label="Desk workspace"
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border border-border/80 bg-muted/40 p-0.5",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => switchTo("front_desk")}
        aria-pressed={workspace === "front_desk"}
        className={cn(
          "rounded px-2 py-1 text-[11px] font-medium tracking-tight transition-colors",
          workspace === "front_desk"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Front desk
      </button>
      <button
        type="button"
        onClick={() => switchTo("back_office")}
        aria-pressed={workspace === "back_office"}
        className={cn(
          "rounded px-2 py-1 text-[11px] font-medium tracking-tight transition-colors",
          workspace === "back_office"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Back office
      </button>
    </div>
  );
}
