import { PassPrintBar } from "@/components/erp/day-desk/PassPrintBar";

export type KitchenPassRow = {
  rooms: string[];
  people: number;
  name: string;
  plan: string;
};

type MealBucket = "both" | "all" | "breakfast" | "none";

function bucket(plan: string): MealBucket {
  const code = plan.trim().toUpperCase();
  if (code === "MAP") return "both";
  if (code === "AP") return "all";
  if (code === "BB" || code === "CP") return "breakfast";
  return "none";
}

const SECTIONS: { id: MealBucket; title: string; cook: string }[] = [
  { id: "both", title: "Breakfast and dinner", cook: "Cook breakfast and dinner" },
  { id: "all", title: "Breakfast, lunch and dinner", cook: "Cook all three meals" },
  { id: "breakfast", title: "Breakfast only", cook: "Cook breakfast. No dinner." },
  { id: "none", title: "No meal", cook: "Do not cook for these rooms." },
];

function people(rows: KitchenPassRow[], meals: MealBucket[]): number {
  return rows.filter((row) => meals.includes(bucket(row.plan))).reduce((sum, row) => sum + row.people, 0);
}

/** One sheet a kitchen can read: how many plates, then the room numbers. */
export function KitchenPass({
  hotel,
  dateLabel,
  title,
  rows,
  whatsapp,
}: {
  hotel: string;
  dateLabel: string;
  title: string;
  rows: KitchenPassRow[];
  whatsapp: string;
}) {
  const breakfast = people(rows, ["both", "all", "breakfast"]);
  const lunch = people(rows, ["all"]);
  const dinner = people(rows, ["both", "all"]);
  const counts = [
    { label: "Breakfast", value: breakfast },
    { label: "Lunch", value: lunch },
    { label: "Dinner", value: dinner },
  ].filter((item) => item.value > 0);

  return (
    <main className="mx-auto max-w-[190mm] bg-white p-6 text-black print:p-0">
      <p className="text-sm">{hotel}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-lg">{dateLabel}</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {(counts.length ? counts : [{ label: "Meals", value: 0 }]).map((item) => (
          <div key={item.label} className="border-2 border-black px-3 py-2">
            <p className="text-sm font-semibold uppercase">{item.label}</p>
            <p className="text-4xl font-bold tabular-nums leading-none">{item.value}</p>
            <p className="text-sm">people</p>
          </div>
        ))}
      </div>
      {SECTIONS.map((section) => {
        const list = rows.filter((row) => bucket(row.plan) === section.id);
        if (!list.length) return null;
        const heads = list.reduce((sum, row) => sum + row.people, 0);
        return (
          <section key={section.id} className="mt-6 break-inside-avoid">
            <h2 className="border-b-2 border-black pb-1 text-xl font-bold">{section.title}</h2>
            <p className="mt-1 text-base">
              {section.cook} {heads} people.
            </p>
            <ul className="mt-3 space-y-3">
              {list.map((row) => (
                <li key={`${row.name}-${row.rooms.join("-")}`} className="border border-black p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {row.rooms.length ? (
                      row.rooms.map((room) => (
                        <span
                          key={room}
                          className="inline-flex min-w-12 items-center justify-center border-2 border-black px-2 py-1 text-2xl font-bold tabular-nums"
                        >
                          {room}
                        </span>
                      ))
                    ) : (
                      <span className="text-lg font-bold">No room yet</span>
                    )}
                    <span className="ml-auto text-right">
                      <span className="block text-3xl font-bold tabular-nums leading-none">{row.people}</span>
                      <span className="text-sm">people</span>
                    </span>
                  </div>
                  <p className="mt-1 text-base">{row.name}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <PassPrintBar whatsapp={whatsapp} />
    </main>
  );
}
