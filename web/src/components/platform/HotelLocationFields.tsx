"use client";

import { useMemo, useState } from "react";

export type DzongkhagOption = { code: string; name: string };
export type AreaOption = {
  dzongkhag_code: string;
  code: string;
  name: string;
};

export function HotelLocationFields({
  dzongkhags,
  areas,
  defaultDzongkhag = "THI",
  defaultArea = "01",
  suggestedCode,
}: {
  dzongkhags: DzongkhagOption[];
  areas: AreaOption[];
  defaultDzongkhag?: string;
  defaultArea?: string;
  suggestedCode?: string;
}) {
  const [dz, setDz] = useState(defaultDzongkhag);
  const [area, setArea] = useState(defaultArea);

  const filteredAreas = useMemo(
    () => areas.filter((a) => a.dzongkhag_code === dz),
    [areas, dz],
  );

  return (
    <div className="space-y-3">
      <select
        name="dzongkhag_code"
        className="w-full rounded-md border px-3 py-2 text-sm"
        value={dz}
        onChange={(e) => {
          setDz(e.target.value);
          const first = areas.find((a) => a.dzongkhag_code === e.target.value);
          setArea(first?.code ?? "01");
        }}
        required
      >
        {dzongkhags.map((d) => (
          <option key={d.code} value={d.code}>
            {d.name} ({d.code})
          </option>
        ))}
      </select>
      <select
        name="area_code"
        className="w-full rounded-md border px-3 py-2 text-sm"
        value={area}
        onChange={(e) => setArea(e.target.value)}
        required
      >
        {filteredAreas.map((a) => (
          <option key={`${a.dzongkhag_code}-${a.code}`} value={a.code}>
            {a.code} — {a.name}
          </option>
        ))}
      </select>
      {suggestedCode ? (
        <p className="text-xs text-muted-foreground">
          Next code for this area will be assigned on create (e.g.{" "}
          <span className="font-mono">{suggestedCode}</span>).
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Login code = dzongkhag + area + signup number (e.g. THI02001).
        </p>
      )}
    </div>
  );
}
