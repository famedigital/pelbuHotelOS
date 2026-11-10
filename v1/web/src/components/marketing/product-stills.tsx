import { cn } from "@/lib/utils";

function DeskChrome({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[240px] text-[#0c1726]", className)}>
      <aside className="flex w-11 shrink-0 flex-col items-center gap-2.5 bg-[#0c1726] py-3">
        <span className="size-5 rounded-md bg-sky-500" />
        <span className="size-3.5 rounded-sm bg-white/20" />
        <span className="size-3.5 rounded-sm bg-amber-400" />
        <span className="size-3.5 rounded-sm bg-white/15" />
        <span className="mt-auto size-3.5 rounded-full bg-white/20" />
      </aside>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between border-b border-slate-200/80 bg-white px-3 py-2">
          <p className="text-[11px] font-semibold tracking-tight">{title}</p>
          <p className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
            Demo Hotel
          </p>
        </div>
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function RackStill() {
  const rows = [
    { room: "101", bars: [] as Array<{ from: number; span: number; label: string; tone: string }> },
    { room: "102", bars: [{ from: 1, span: 3, label: "In house", tone: "bg-sky-500" }] },
    { room: "103", bars: [{ from: 4, span: 2, label: "Arrival", tone: "bg-amber-500" }] },
    { room: "104", bars: [{ from: 0, span: 2, label: "Agent", tone: "bg-sky-700" }] },
    { room: "201", bars: [{ from: 2, span: 4, label: "Stay", tone: "bg-sky-500" }] },
    { room: "202", bars: [] },
  ];

  return (
    <DeskChrome title="Stay view">
      <div className="grid grid-cols-[44px_repeat(7,1fr)] gap-1 text-[9px]">
        <span />
        {DAYS.map((d) => (
          <span key={d} className="text-center font-medium text-slate-400">
            {d}
          </span>
        ))}
        {rows.map((row) => (
          <div key={row.room} className="contents">
            <span className="flex items-center font-medium text-slate-500">{row.room}</span>
            <div className="relative col-span-7 h-7">
              <div className="grid h-full grid-cols-7 gap-1">
                {DAYS.map((d) => (
                  <span key={d} className="rounded-sm bg-white ring-1 ring-slate-200/80" />
                ))}
              </div>
              {row.bars.map((bar) => (
                <span
                  key={bar.label}
                  className={cn(
                    "absolute top-0.5 flex h-6 items-center rounded-md px-1.5 text-[9px] font-medium text-white",
                    bar.tone,
                  )}
                  style={{
                    left: `calc(${(bar.from / 7) * 100}% + 2px)`,
                    width: `calc(${(bar.span / 7) * 100}% - 6px)`,
                  }}
                >
                  {bar.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </DeskChrome>
  );
}

export function ArrivalsStill() {
  const rows = [
    ["204", "Agent", "2", "MAP"],
    ["108", "Walk-in", "1", "EP"],
    ["305", "Agent", "3", "BB"],
  ];
  return (
    <DeskChrome title="Today · arrivals">
      <div className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
        <div className="grid grid-cols-4 bg-slate-50 px-2 py-1.5 text-[9px] font-semibold tracking-wide text-slate-400 uppercase">
          <span>Room</span>
          <span>Bill to</span>
          <span>Rooms</span>
          <span>Meal</span>
        </div>
        {rows.map((row) => (
          <div
            key={row[0]}
            className="grid grid-cols-4 border-t border-slate-100 px-2 py-2 text-[11px]"
          >
            {row.map((cell) => (
              <span key={cell}>{cell}</span>
            ))}
          </div>
        ))}
      </div>
    </DeskChrome>
  );
}

export function CheckInStill() {
  return (
    <DeskChrome title="Check-in">
      <div className="grid gap-2 rounded-lg bg-white p-3 ring-1 ring-slate-200">
        <div className="flex gap-2 text-[10px]">
          <span className="rounded-full bg-sky-500 px-2 py-0.5 font-medium text-white">Local</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">Regional</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">International</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <Field label="Room" value="204" />
          <Field label="Meal" value="MAP" />
          <Field label="Origin" value="Bhutan" />
          <Field label="Nights" value="3" />
        </div>
        <div className="mt-1 flex justify-end">
          <span className="rounded-full bg-[#0c1726] px-3 py-1 text-[10px] font-semibold text-white">
            Confirm check-in
          </span>
        </div>
      </div>
    </DeskChrome>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-2 py-1.5">
      <p className="text-[9px] text-slate-400">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

export function FolioStill() {
  const lines = [
    ["Room · 3 nights", "12,600"],
    ["MAP · 2 adults", "3,600"],
    ["Restaurant · room charge", "890"],
    ["Suja", "120"],
  ];
  return (
    <DeskChrome title="Folio · room 204">
      <div className="rounded-lg bg-white ring-1 ring-slate-200">
        {lines.map(([name, amt]) => (
          <div
            key={name}
            className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-[11px] last:border-0"
          >
            <span>{name}</span>
            <span className="font-medium tabular-nums">{amt}</span>
          </div>
        ))}
        <div className="flex items-center justify-between bg-amber-50 px-3 py-2 text-[11px]">
          <span className="font-semibold">Balance BTN</span>
          <span className="font-semibold tabular-nums">17,210</span>
        </div>
      </div>
    </DeskChrome>
  );
}

export function PosStill() {
  return (
    <DeskChrome title="POS · restaurant">
      <div className="grid grid-cols-[1.2fr_0.8fr] gap-2">
        <div className="grid grid-cols-2 gap-1.5">
          {["Ema datshi", "Red rice", "Suja", "Momos"].map((item) => (
            <div
              key={item}
              className="rounded-lg bg-white px-2 py-3 text-[11px] font-medium ring-1 ring-slate-200"
            >
              {item}
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
          <p className="text-[10px] text-slate-400">Ticket · room 204</p>
          <p className="mt-2 text-[11px]">Ema datshi</p>
          <p className="text-[11px]">Suja</p>
          <p className="mt-2 text-[10px] text-slate-500">GST included</p>
          <p className="text-[12px] font-semibold">BTN 890</p>
          <p className="mt-2 rounded-full bg-amber-500 px-2 py-1 text-center text-[10px] font-semibold text-[#0c1726]">
            Charge to room
          </p>
        </div>
      </div>
    </DeskChrome>
  );
}

export function NightAuditStill() {
  const steps = [
    ["Room nights posted", true],
    ["Open POS tickets", true],
    ["Cash variance", true],
    ["Business date", false],
  ] as const;
  return (
    <DeskChrome title="Night audit">
      <ul className="space-y-1.5">
        {steps.map(([label, done]) => (
          <li
            key={label}
            className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-[11px] ring-1 ring-slate-200"
          >
            <span>{label}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[9px] font-semibold",
                done ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-800",
              )}
            >
              {done ? "Done" : "Close day"}
            </span>
          </li>
        ))}
      </ul>
    </DeskChrome>
  );
}

export function SwitcherStill() {
  return (
    <DeskChrome title="Stay view">
      <div className="mb-2 flex justify-end">
        <div className="rounded-lg bg-white p-2 text-[11px] shadow-lg ring-1 ring-slate-200">
          <p className="px-2 py-1 font-semibold text-sky-700">Demo Hotel</p>
          <p className="px-2 py-1 text-slate-500">Second Hotel</p>
          <p className="px-2 py-1 text-slate-500">Valley Inn</p>
        </div>
      </div>
      <p className="text-[10px] text-slate-400">Each property keeps its own rooms and folio.</p>
    </DeskChrome>
  );
}

export function BookStill() {
  return (
    <div className="bg-white p-4 text-[#0c1726]">
      <p className="text-[10px] font-medium tracking-wide text-slate-400 uppercase">
        Demo Hotel · book
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
        <Field label="Arrive" value="12 Oct" />
        <Field label="Leave" value="15 Oct" />
        <Field label="Guests" value="2" />
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <div>
          <p className="text-[12px] font-semibold">Deluxe</p>
          <p className="text-[10px] text-slate-500">3 nights · public rack</p>
        </div>
        <p className="text-[13px] font-semibold">BTN 12,600</p>
      </div>
      <div className="mt-3 flex justify-end">
        <span className="rounded-full bg-[#0c1726] px-3 py-1.5 text-[10px] font-semibold text-white">
          Hold these dates
        </span>
      </div>
    </div>
  );
}

export function DotStill() {
  const rows = [
    ["Trade", "82"],
    ["BFDA", "76"],
    ["DOT", "88"],
  ];
  return (
    <DeskChrome title="DOT assessment · HCS">
      <ul className="space-y-1.5">
        {rows.map(([name, score]) => (
          <li
            key={name}
            className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-[11px] ring-1 ring-slate-200"
          >
            <span>{name}</span>
            <span className="font-semibold tabular-nums text-sky-700">{score}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-slate-400">3★ / 4★ checklist · print pack</p>
    </DeskChrome>
  );
}

export function RotaStill() {
  const staff = [
    ["Front office", "M T W"],
    ["Housekeeping", "T W T"],
    ["Food & beverage", "T T S"],
    ["Maintenance", "M W F"],
  ];
  return (
    <DeskChrome title="Rota · this week">
      <div className="space-y-1.5">
        {staff.map(([role, days]) => (
          <div
            key={role}
            className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-[11px] ring-1 ring-slate-200"
          >
            <span>{role}</span>
            <span className="font-medium tracking-widest text-sky-700">{days}</span>
          </div>
        ))}
      </div>
    </DeskChrome>
  );
}

const PRINTS = [
  "Day sheet",
  "Registration",
  "Invoice",
  "Receipt",
  "Voucher",
  "Settlement",
  "KOT",
  "Night audit",
];

export function PrintsStill() {
  return (
    <div className="relative h-44 bg-[#f4f7fb]">
      {PRINTS.map((name, i) => (
        <div
          key={name}
          className="absolute top-4 w-28 rounded-md bg-white px-2 py-3 shadow-md ring-1 ring-slate-200"
          style={{ left: 12 + i * 22, transform: `rotate(${i % 2 === 0 ? -2 : 2}deg)` }}
        >
          <p className="text-[8px] font-semibold tracking-wide text-slate-400 uppercase">
            Demo Hotel
          </p>
          <p className="mt-2 text-[11px] font-semibold leading-tight">{name}</p>
          <div className="mt-3 space-y-1">
            <span className="block h-1 w-16 rounded bg-slate-100" />
            <span className="block h-1 w-12 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TodayStill() {
  return <ArrivalsStill />;
}

/** Arrivals as they read on a phone, without the desk rail. */
export function PhoneArrivalsStill() {
  const rows = [
    ["204", "Agent", "MAP"],
    ["108", "Walk-in", "EP"],
    ["305", "Agent", "BB"],
  ];
  return (
    <div className="min-h-full bg-[#f4f7fb] px-3.5 pb-6 pt-3 text-[#0c1726]">
      <p className="text-[15px] font-semibold tracking-tight">Today · arrivals</p>
      <p className="mt-0.5 text-[12px] text-slate-500">Demo Hotel</p>
      <ul className="mt-4 space-y-2.5">
        {rows.map(([room, bill, meal]) => (
          <li
            key={room}
            className="rounded-2xl bg-white px-3.5 py-3 ring-1 ring-slate-200"
          >
            <p className="text-[15px] font-semibold">Room {room}</p>
            <p className="mt-0.5 text-[12px] text-slate-500">
              {bill} · {meal}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OwnerStill() {
  const tiles = [
    ["Occupancy", "78%"],
    ["In house", "24"],
    ["Revenue BTN", "186,400"],
    ["Compliance", "Open"],
  ];
  return (
    <DeskChrome title="Owner">
      <div className="grid grid-cols-2 gap-2">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
            <p className="text-[9px] text-slate-400">{label}</p>
            <p className="text-sm font-semibold">{value}</p>
          </div>
        ))}
      </div>
    </DeskChrome>
  );
}

export function GmStill() {
  const rows = [
    ["Arrivals", "6"],
    ["Departures", "4"],
    ["Kitchen tickets", "3"],
    ["Holds", "2"],
  ];
  return (
    <DeskChrome title="General manager">
      <ul className="space-y-1.5">
        {rows.map(([label, value]) => (
          <li
            key={label}
            className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-[11px] ring-1 ring-slate-200"
          >
            <span>{label}</span>
            <span className="font-semibold text-sky-700">{value}</span>
          </li>
        ))}
      </ul>
    </DeskChrome>
  );
}
