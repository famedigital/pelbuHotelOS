"use client";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatForecastMonthLabel } from "@/lib/erp/guest-forecast";
import type {
  GuestForecastDay,
  GuestForecastMonth,
} from "@/lib/erp/guest-forecast";
import type { DashboardView } from "@/lib/erp/dashboard-views";
import { useRouter } from "next/navigation";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";

const roomsConfig = {
  rooms: { label: "Rooms in house", color: "var(--chart-1)" },
} satisfies ChartConfig;

const occupancyConfig = {
  occupancy: { label: "Occupancy %", color: "var(--chart-2)" },
} satisfies ChartConfig;

function dashboardHref(opts: {
  view: DashboardView;
  homeView: DashboardView;
  forecastMonthYm?: string;
  currentYm: string;
}): string {
  const params = new URLSearchParams();
  if (opts.view !== opts.homeView) params.set("view", opts.view);
  if (opts.forecastMonthYm && opts.forecastMonthYm !== opts.currentYm) {
    params.set("forecastMonth", opts.forecastMonthYm);
  }
  const q = params.toString();
  return q ? `/erp?${q}` : "/erp";
}

export function MonthRoomsChart({
  days,
  businessDate,
  totalRooms,
}: {
  days: GuestForecastDay[];
  businessDate: string;
  totalRooms: number;
}) {
  const data = days.map((day) => ({
    label: day.date.slice(8),
    date: day.date,
    rooms: day.rooms,
    guests: day.guests,
    arrivals: day.arrivals,
    departures: day.departures,
  }));

  return (
    <ChartContainer
      config={roomsConfig}
      className="aspect-auto h-24 w-full"
      initialDimension={{ width: 480, height: 96 }}
      aria-label="Daily in-house rooms"
    >
      <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <YAxis hide domain={[0, Math.max(1, totalRooms)]} />
        <XAxis dataKey="label" hide />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelKey="date"
              formatter={(value, _name, item) => {
                const row = item.payload as (typeof data)[number];
                return (
                  <span className="font-medium">
                    {row.date}: {value} rooms · {row.guests} guests · arr{" "}
                    {row.arrivals} / dep {row.departures}
                  </span>
                );
              }}
            />
          }
        />
        <Bar dataKey="rooms" radius={[2, 2, 0, 0]}>
          {data.map((day) => (
            <Cell
              key={day.date}
              fill={
                day.date === businessDate
                  ? "var(--color-rooms)"
                  : day.rooms > totalRooms && totalRooms > 0
                    ? "var(--destructive)"
                    : day.rooms > 0
                      ? "color-mix(in oklch, var(--color-rooms) 55%, transparent)"
                      : "var(--muted)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export function HorizonOccupancyChart({
  months,
  selectedYm,
  currentYm,
  view,
  homeView,
}: {
  months: GuestForecastMonth[];
  selectedYm: string;
  currentYm: string;
  view: DashboardView;
  homeView: DashboardView;
}) {
  const router = useRouter();
  const data = months.map((month) => ({
    label: formatForecastMonthLabel(month.monthYm).split(" ")[0],
    monthYm: month.monthYm,
    occupancy: month.occupancyPct,
    peakRooms: month.peakRooms,
    peakGuests: month.peakGuests,
  }));

  return (
    <ChartContainer
      config={occupancyConfig}
      className="aspect-auto h-28 w-full"
      initialDimension={{ width: 480, height: 112 }}
      aria-label="Six-month occupancy"
    >
      <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <YAxis hide domain={[0, 100]} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10 }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, _name, item) => {
                const row = item.payload as (typeof data)[number];
                return (
                  <span className="font-medium">
                    {formatForecastMonthLabel(row.monthYm)}: {value}% occ · peak{" "}
                    {row.peakRooms} rooms / {row.peakGuests} guests
                  </span>
                );
              }}
            />
          }
        />
        <Bar
          dataKey="occupancy"
          radius={[2, 2, 0, 0]}
          className="cursor-pointer"
          onClick={(bar) => {
            const ym = (bar as { monthYm?: string }).monthYm;
            if (!ym) return;
            router.push(
              dashboardHref({
                view,
                homeView,
                currentYm,
                forecastMonthYm: ym,
              }),
            );
          }}
        >
          {data.map((month) => (
            <Cell
              key={month.monthYm}
              fill={
                month.monthYm === selectedYm
                  ? "var(--color-occupancy)"
                  : month.occupancy >= 90
                    ? "var(--destructive)"
                    : month.occupancy > 0
                      ? "color-mix(in oklch, var(--color-occupancy) 55%, transparent)"
                      : "var(--muted)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
