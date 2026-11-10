import {
  Banknote,
  ConciergeBell,
  Moon,
  Printer,
  Search,
  Sun,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useFrontOfficeStore } from "../lib/front-office-store";

type DockProps = {
  theme: "light" | "midnight";
  onToggleTheme: () => void;
  onOpenJump: () => void;
  onOpenPrint: () => void;
};

type DockItem = {
  id: string;
  Icon: LucideIcon;
  hint: string;
  onClick: () => void;
};

/** Flat dock — no magnification / tilt on hover. */
export function QuickActionDock({
  theme,
  onToggleTheme,
  onOpenJump,
  onOpenPrint,
}: DockProps) {
  const navigate = useNavigate();
  const openFastBook = useFrontOfficeStore((s) => s.openFastBook);
  const openStay = useFrontOfficeStore((s) => s.openStay);
  const stays = useFrontOfficeStore((s) => s.stays);

  const quickCheckIn = useCallback(() => {
    const next = stays.find(
      (s) => ["confirmed", "held"].includes(s.status) && Boolean(s.roomId),
    );
    if (next) {
      openStay(next.id);
      navigate("/desk");
      return;
    }
    navigate("/desk");
  }, [navigate, openStay, stays]);

  const items: DockItem[] = [
    { id: "fast-book", Icon: Zap, hint: "Fast Book ⌘B", onClick: () => openFastBook() },
    { id: "check-in", Icon: ConciergeBell, hint: "Quick Check-In", onClick: quickCheckIn },
    { id: "till", Icon: Banknote, hint: "Cash Till Drop", onClick: () => navigate("/purchases") },
    { id: "jump", Icon: Search, hint: "Jump Ctrl+K", onClick: onOpenJump },
    { id: "print", Icon: Printer, hint: "Print Passes", onClick: onOpenPrint },
    {
      id: "theme",
      Icon: theme === "light" ? Moon : Sun,
      hint: theme === "light" ? "Obsidian" : "Ceramic",
      onClick: onToggleTheme,
    },
  ];

  return (
    <nav
      aria-label="Quick actions"
      className="hos-glass-l3 no-print fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-[var(--hos-glass-border)] bg-[var(--hos-surface-3)] px-2.5 py-2 shadow-[var(--hos-elevated-shadow)] backdrop-blur-[var(--hos-blur-l3)] [transform:translate3d(-50%,0,0)]"
    >
      {items.map((item) => {
        const Icon = item.Icon;
        return (
          <button
            key={item.id}
            type="button"
            title={item.hint}
            onClick={item.onClick}
            className="group flex min-w-[56px] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[var(--hos-ink)] transition-colors hover:bg-[rgba(17,17,17,0.06)]"
          >
            <Icon className="size-5 text-[var(--hos-ink)] transition-colors group-hover:text-[var(--hos-hl)]" strokeWidth={1.75} />
            <span className="max-w-[64px] truncate text-[9px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)] group-hover:text-[var(--hos-ink)]">
              {item.hint.split(" ")[0]}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
