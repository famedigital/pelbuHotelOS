import { NavLink, Outlet } from "react-router-dom";
import { Button, ModuleFrame, StatusLegend } from "@hos-v2/ui";
import { TELEGRAM_NAV } from "./telegram-nav";

export type TelegramDeskFrameProps = {
  onRefresh: () => void;
  onPair: () => void;
  busy?: boolean;
};

export function TelegramDeskFrame({
  onRefresh,
  onPair,
  busy,
}: TelegramDeskFrameProps) {
  return (
    <ModuleFrame
      title="Innora Bot · Telegram"
      description="Pair FO · docs OCR · folio/deposit notify · agent alerts"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <StatusLegend
            dense
            items={[
              { id: "live", label: "Paired", swatch: "var(--hos-emerald)" },
              { id: "docs", label: "Docs", swatch: "var(--hos-brass)" },
              { id: "alert", label: "Alerts", swatch: "var(--hos-primary)" },
            ]}
          />
          <Button
            size="sm"
            variant="ghost"
            className="!rounded-full"
            disabled={busy}
            onClick={onRefresh}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            className="hos-btn-ink !rounded-full"
            data-testid="hermes-open-pair"
            disabled={busy}
            onClick={onPair}
          >
            Pair…
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4" data-testid="hermes-telegram-page">
        <nav
          className="hos-mobile-segment-rail -mx-1 flex flex-wrap gap-1.5 px-1"
          aria-label="Innora Bot sections"
        >
          {TELEGRAM_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              data-testid={`hermes-nav-${item.label.toLowerCase()}`}
              className={({ isActive }) =>
                `hos-mobile-segment !min-h-8 shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold no-underline transition-colors ${
                  isActive
                    ? "border-[var(--hos-primary)] bg-[var(--hos-primary)] text-white"
                    : "border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink-2)]"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Outlet />
      </div>
    </ModuleFrame>
  );
}
