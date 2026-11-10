import { useEffect, useMemo, useState, useTransition } from "react";
import { NeoGlassCard, TactileButton } from "@hotel-os/ui";
import { api } from "../api";
import { FastBookModal } from "../components/FastBookModal";
import { StayHubDrawer } from "../components/StayHubDrawer";

type StayView = {
  from: string;
  to: string;
  nights: number;
  rooms: Array<{
    id: string;
    label: string;
    roomTypeId: string;
    roomTypeName: string | null;
    hkStatus: string | null;
  }>;
  stays: Array<{
    bookingId: string;
    confirmationCode: string;
    guestName: string;
    status: string;
    checkIn: string;
    checkOut: string;
    roomUnitIds: string[];
  }>;
};

function addDays(iso: string, n: number) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000)
    .toISOString()
    .slice(0, 10);
}

export function StayViewPage() {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Thimphu",
  });
  const [from, setFrom] = useState(today);
  const [data, setData] = useState<StayView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bookCell, setBookCell] = useState<{
    roomId: string;
    roomTypeId: string;
    label: string;
    date: string;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const dates = useMemo(() => {
    if (!data) return [];
    return Array.from({ length: data.nights }, (_, i) => addDays(data.from, i));
  }, [data]);

  const load = () => {
    start(async () => {
      try {
        setError(null);
        setData(
          await api(`/v1/calendar/stayview?from=${from}&nights=14`),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  useEffect(() => {
    load();
  }, [from]);

  const stayOn = (roomId: string, date: string) =>
    data?.stays.find(
      (s) =>
        s.roomUnitIds.includes(roomId) &&
        s.checkIn <= date &&
        s.checkOut > date,
    );

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 20 }}>StayView</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={{
              background: "#0b1220",
              color: "#f8fafc",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: 6,
            }}
          />
          <TactileButton onClick={load}>Refresh</TactileButton>
        </div>
      </div>
      {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}
      {pending ? <p style={{ color: "#94a3b8", fontSize: 12 }}>Loading…</p> : null}

      <NeoGlassCard>
        <div style={{ overflow: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 11, minWidth: 900 }}>
            <thead>
              <tr>
                <th
                  style={{
                    position: "sticky",
                    left: 0,
                    background: "#0f172a",
                    padding: 6,
                    textAlign: "left",
                    zIndex: 1,
                  }}
                >
                  Room
                </th>
                {dates.map((d) => (
                  <th key={d} style={{ padding: 6, color: "#94a3b8", minWidth: 72 }}>
                    {d.slice(5)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.rooms || []).map((room) => (
                <tr key={room.id}>
                  <td
                    style={{
                      position: "sticky",
                      left: 0,
                      background: "#0f172a",
                      padding: 6,
                      fontWeight: 600,
                      zIndex: 1,
                    }}
                  >
                    {room.label}
                    <div style={{ fontSize: 10, color: "#64748b" }}>
                      {room.roomTypeName || room.hkStatus}
                    </div>
                  </td>
                  {dates.map((d) => {
                    const stay = stayOn(room.id, d);
                    return (
                      <td key={d} style={{ padding: 2 }}>
                        {stay ? (
                          <button
                            type="button"
                            onClick={() => setSelectedId(stay.bookingId)}
                            style={{
                              width: "100%",
                              minHeight: 36,
                              border: "none",
                              borderRadius: 6,
                              background:
                                stay.status === "checked_in"
                                  ? "rgba(59,130,246,0.45)"
                                  : "rgba(245,158,11,0.35)",
                              color: "#f8fafc",
                              cursor: "pointer",
                              fontSize: 10,
                            }}
                            title={stay.confirmationCode}
                          >
                            {stay.guestName.split(" ")[0]}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setBookCell({
                                roomId: room.id,
                                roomTypeId: room.roomTypeId,
                                label: room.label,
                                date: d,
                              })
                            }
                            style={{
                              width: "100%",
                              minHeight: 36,
                              border: "1px dashed rgba(255,255,255,0.08)",
                              borderRadius: 6,
                              background: "#0b1220",
                              color: "#475569",
                              cursor: "pointer",
                            }}
                          >
                            +
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </NeoGlassCard>

      <FastBookModal
        open={!!bookCell}
        defaults={
          bookCell
            ? {
                checkIn: bookCell.date,
                checkOut: addDays(bookCell.date, 1),
                roomUnitHint: bookCell.label,
                roomUnitId: bookCell.roomId,
                roomTypeId: bookCell.roomTypeId,
              }
            : undefined
        }
        onClose={() => setBookCell(null)}
        onCreated={async (bookingId) => {
          setBookCell(null);
          setSelectedId(bookingId);
          load();
        }}
      />
      <StayHubDrawer
        bookingId={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={load}
      />
    </div>
  );
}
