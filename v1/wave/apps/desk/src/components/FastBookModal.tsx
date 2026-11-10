import { useEffect, useState, useTransition } from "react";
import { NeoGlassCard, TactileButton } from "@hotel-os/ui";
import { api } from "../api";

type RoomType = {
  id: string;
  code: string;
  name: string;
  sellable: boolean;
};

export function FastBookModal({
  open,
  onClose,
  onCreated,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (bookingId: string, confirmationCode: string) => void;
  defaults?: {
    checkIn?: string;
    checkOut?: string;
    roomUnitHint?: string;
    roomUnitId?: string;
    roomTypeId?: string;
  };
}) {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Thimphu",
  });
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86400000)
    .toISOString()
    .slice(0, 10);

  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [checkIn, setCheckIn] = useState(defaults?.checkIn || today);
  const [checkOut, setCheckOut] = useState(defaults?.checkOut || tomorrow);
  const [adults, setAdults] = useState(2);
  const [mealPlanCode, setMealPlanCode] = useState<"EP" | "CP" | "MAP" | "AP">(
    "MAP",
  );
  const [rate, setRate] = useState("");
  const [intent, setIntent] = useState<"reserve" | "confirm" | "check_in">(
    "confirm",
  );
  const [roomTypeId, setRoomTypeId] = useState(defaults?.roomTypeId || "");
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    start(async () => {
      try {
        const res = await api<{ roomTypes: RoomType[] }>("/v1/room-types");
        const sellable = (res.roomTypes || []).filter((r) => r.sellable);
        setRoomTypes(sellable);
        if (!roomTypeId && defaults?.roomTypeId) {
          setRoomTypeId(defaults.roomTypeId);
        } else if (!roomTypeId && sellable[0]) {
          setRoomTypeId(sellable[0].id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per open
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        background: "rgba(2,6,23,0.75)",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(480px, 100%)" }}
      >
        <NeoGlassCard>
          <h2 style={{ marginTop: 0 }}>Fast Book</h2>
          <div style={{ display: "grid", gap: 8 }}>
            <Field label="Guest name">
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                style={inputStyle}
                required
              />
            </Field>
            <Field label="Phone">
              <input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <div
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
            >
              <Field label="Check-in">
                <input
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label="Check-out">
                <input
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
            <Field label="Room type">
              <select
                value={roomTypeId}
                onChange={(e) => setRoomTypeId(e.target.value)}
                style={inputStyle}
              >
                {roomTypes.length === 0 ? (
                  <option value="">Loading…</option>
                ) : (
                  roomTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name}
                    </option>
                  ))
                )}
              </select>
            </Field>
            {defaults?.roomUnitHint || defaults?.roomUnitId ? (
              <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                Assign unit{" "}
                {defaults.roomUnitHint || defaults.roomUnitId?.slice(0, 8)}
              </p>
            ) : null}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 8,
              }}
            >
              <Field label="Adults">
                <input
                  type="number"
                  min={1}
                  value={adults}
                  onChange={(e) => setAdults(Number(e.target.value))}
                  style={inputStyle}
                />
              </Field>
              <Field label="Meal">
                <select
                  value={mealPlanCode}
                  onChange={(e) =>
                    setMealPlanCode(e.target.value as typeof mealPlanCode)
                  }
                  style={inputStyle}
                >
                  <option value="EP">EP</option>
                  <option value="CP">CP</option>
                  <option value="MAP">MAP</option>
                  <option value="AP">AP</option>
                </select>
              </Field>
              <Field label="Nightly BTN">
                <input
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  style={inputStyle}
                  placeholder="sheet"
                />
              </Field>
            </div>
            <Field label="Intent">
              <select
                value={intent}
                onChange={(e) => setIntent(e.target.value as typeof intent)}
                style={inputStyle}
              >
                <option value="reserve">Hold / reserve</option>
                <option value="confirm">Confirm</option>
                <option value="check_in">Confirm + check-in</option>
              </select>
            </Field>
            {error ? (
              <p style={{ color: "#dc2626", fontSize: 12 }}>{error}</p>
            ) : null}
            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <TactileButton variant="ghost" onClick={onClose}>
                Cancel
              </TactileButton>
              <TactileButton
                disabled={pending || !contactName.trim() || !roomTypeId}
                onClick={() =>
                  start(async () => {
                    try {
                      setError(null);
                      const res = await api<{
                        bookingId: string;
                        confirmationCode: string;
                      }>("/v1/reservations", {
                        method: "POST",
                        body: JSON.stringify({
                          idempotencyKey: crypto.randomUUID(),
                          contactName: contactName.trim(),
                          contactPhone: contactPhone.trim() || undefined,
                          checkIn,
                          checkOut,
                          adults,
                          mealPlanCode,
                          intent,
                          roomTypeId,
                          roomUnitId: defaults?.roomUnitId || undefined,
                          assignNow: Boolean(defaults?.roomUnitId),
                          agreedNightlyRateBtn: rate
                            ? Number(rate)
                            : undefined,
                          notes: defaults?.roomUnitHint
                            ? `StayView hint room ${defaults.roomUnitHint}`
                            : undefined,
                        }),
                      });
                      onCreated(res.bookingId, res.confirmationCode);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : String(e));
                    }
                  })
                }
              >
                {pending ? "Saving…" : "Create booking"}
              </TactileButton>
            </div>
          </div>
        </NeoGlassCard>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#64748b" }}>
      {label}
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#fff",
  color: "#0f172a",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "8px 10px",
};
