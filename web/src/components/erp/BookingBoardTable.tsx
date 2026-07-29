import { DeskTable, StatusPill } from "@/components/erp/DeskListShell";
import { fmtDate } from "@/lib/erp-lists";

export function BookingBoardTable({
  rows,
}: {
  rows: Record<string, unknown>[];
}) {
  return (
    <DeskTable caption="Board" headers={["Guest", "Stay", "Rooms", "Status", ""]}>
      {rows.length === 0 ? (
        <tr>
          <td colSpan={5} className="px-3 py-6 text-muted-foreground">
            None for this board.
          </td>
        </tr>
      ) : (
        rows.map((r) => {
          const agent = r.agents as
            | { company_name?: string }
            | { company_name?: string }[]
            | null;
          const agentName = Array.isArray(agent)
            ? agent[0]?.company_name
            : agent?.company_name;
          return (
            <tr key={r.id as string} className="border-t border-espresso/10">
              <td className="px-3 py-2.5">
                <p className="font-medium text-espresso">
                  {(r.contact_name as string) ?? "Guest"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(r.contact_phone as string) ?? "—"}
                  {agentName ? ` Â· ${agentName}` : ""}
                </p>
              </td>
              <td className="px-3 py-2.5 text-sm">
                {fmtDate(r.check_in as string)} → {fmtDate(r.check_out as string)}
              </td>
              <td className="px-3 py-2.5 tabular-nums">
                {Number(r.rooms ?? 0)} / {Number(r.adults ?? 0)} pax
              </td>
              <td className="px-3 py-2.5">
                <StatusPill value={r.status as string} />
              </td>
              <td className="px-3 py-2.5 text-right">
                <a
                  href={`/erp/check-in?booking=${r.id as string}`}
                  className="text-sm text-maroon underline-offset-4 hover:underline"
                >
                  Open →
                </a>
              </td>
            </tr>
          );
        })
      )}
    </DeskTable>
  );
}
