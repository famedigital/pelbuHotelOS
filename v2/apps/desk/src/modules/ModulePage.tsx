import { ModuleFrame, EmptyState, Button } from "@hos-v2/ui";
import { useNavigate } from "react-router-dom";

const GATE = [
  "Write flows (commands registered on API)",
  "Permission keys",
  "Audit entries",
  "Emits / handles events",
  "Live updates (Realtime — Wave wiring)",
  "Tablet/phone layout (shell responsive)",
  "Domain money tests (when applicable)",
  "Journey segment (Playwright — before done)",
];

const COMMANDS: Record<string, string[]> = {
  settings: ["settings.upsertRoomType"],
  hr: ["hr.setStaffPin"],
  rates: ["rates.quoteNight", "rates.publishRange"],
  reservations: [
    "reservations.createReservation",
    "reservations.checkIn",
    "reservations.checkOut",
    "reservations.updateGuestRoster",
  ],
  stayview: ["stayview.assignRooms"],
  desk: ["reservations.checkIn", "reservations.checkOut"],
  guests: ["guests.upsert", "reservations.updateGuestRoster"],
  hermes: [
    "hermes.overview",
    "hermes.createPairToken",
    "hermes.listChats",
    "hermes.ocrDocument",
    "hermes.applyDocDraft",
  ],
  telegram: [
    "hermes.overview",
    "hermes.createPairToken",
    "hermes.listChats",
    "hermes.ocrDocument",
    "hermes.applyDocDraft",
  ],
  groups: ["groups.create"],
  "night-audit": ["night_audit.run"],
  finance: ["finance.postCharge", "finance.postPayment", "finance.issueFiscalDoc"],
  reports: ["reports.run"],
  compliance: ["compliance.generateReturn"],
  pos: ["pos.addItem", "pos.fire"],
  kds: ["kds.bump"],
  housekeeping: ["housekeeping.setStatus"],
  laundry: ["laundry.deliver"],
  agents: ["agents.create", "agents.creditHold", "agents.decideChangeRequest"],
  registry: ["registry.upsertGuide"],
  channel: ["channel.acceptBooking"],
  purchases: ["purchases.receiveGrn", "purchases.approveBill"],
  "staff-portal": ["staff_portal.clockIn"],
  owner: ["owner.dashboardSnapshot"],
  loyalty: ["loyalty.enrol"],
  superadmin: ["superadmin.createTenant"],
  cms: ["cms.publish"],
  website: ["website.searchAvailability"],
  marketing: ["marketing.scheduleCampaign"],
  "innora-ai": ["ai.proposeAction"],
  services: ["services.book", "services.complete"],
  events: ["events.confirm"],
};

type Props = { id: string; title: string };

/** Honest thin module — polished chrome, no mock rows. */
export function ModulePage({ id, title }: Props) {
  const navigate = useNavigate();
  const cmds = COMMANDS[id] ?? [];

  return (
    <ModuleFrame
      title={title}
      description="Dense UI ships when this wave passes the module-done gate. Commands below are live on the API."
      actions={
        <Button size="sm" variant="secondary" onClick={() => navigate("/desk")}>
          Back to Desk
        </Button>
      }
    >
      <EmptyState
        title={`${title} · in progress`}
        description="No mock guest or money rows. Use Desk / Reservations / StayView for live FO today."
        action={
          <Button size="sm" onClick={() => navigate("/desk")}>
            Open Desk
          </Button>
        }
      />
      <div className="hos-cell mt-3 rounded-[12px] p-4">
        <strong className="text-sm text-[var(--hos-ink)]">Module-done gate</strong>
        <ol className="mt-2 space-y-1 pl-4 text-xs text-[var(--hos-ink-3)]">
          {GATE.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ol>
      </div>
      <div className="hos-cell mt-3 rounded-[12px] p-4">
        <strong className="text-sm text-[var(--hos-ink)]">API commands</strong>
        <ul className="mt-2 space-y-1 font-mono text-xs text-[var(--hos-ink-2)]">
          {cmds.length === 0 ? (
            <li>(none mapped)</li>
          ) : (
            cmds.map((c) => <li key={c}>{c}</li>)
          )}
        </ul>
        <p className="meta mt-2">POST /v1/command on :4200</p>
      </div>
    </ModuleFrame>
  );
}
