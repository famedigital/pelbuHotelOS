import type { Dzongkhag } from "./settings-store";

export type PinWeatherCoords = { lat: number; lon: number; label: string };

/** Approximate property centroids for Bhutan desk weather. */
export const DZONGKHAG_COORDS: Record<Dzongkhag, PinWeatherCoords> = {
  Paro: { lat: 27.4305, lon: 89.4135, label: "Paro Valley" },
  Thimphu: { lat: 27.4728, lon: 89.6393, label: "Thimphu" },
  Punakha: { lat: 27.5916, lon: 89.877, label: "Punakha" },
  Bumthang: { lat: 27.5492, lon: 90.7338, label: "Bumthang" },
  Wangdue: { lat: 27.4865, lon: 89.9009, label: "Wangdue" },
  Haa: { lat: 27.3867, lon: 89.2794, label: "Haa Valley" },
  Trashigang: { lat: 27.314, lon: 91.554, label: "Trashigang" },
};

export type PinWeatherSnapshot = {
  tempC: number;
  feelsC: number;
  humidity: number;
  windKmh: number;
  code: number;
  label: string;
  fetchedAt: string;
  source: "open-meteo" | "demo";
};

/** WMO weather interpretation codes → short desk labels. */
export function weatherLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  if (code <= 99) return "Thunder";
  return "Local";
}

export function weatherTone(code: number): "sun" | "cloud" | "rain" | "snow" | "storm" {
  if (code === 0) return "sun";
  if (code <= 48) return "cloud";
  if (code <= 67 || (code >= 80 && code <= 82)) return "rain";
  if (code <= 77 || (code >= 85 && code <= 86)) return "snow";
  return "storm";
}

function demoWeather(dzongkhag: Dzongkhag): PinWeatherSnapshot {
  const hour = new Date().getHours();
  const base = dzongkhag === "Paro" || dzongkhag === "Haa" ? 12 : 16;
  const tempC = Math.round(base + (hour > 12 && hour < 17 ? 4 : hour < 8 ? -3 : 0));
  return {
    tempC,
    feelsC: tempC - 1,
    humidity: 48,
    windKmh: 8,
    code: hour >= 18 || hour < 6 ? 2 : 0,
    label: weatherLabel(hour >= 18 || hour < 6 ? 2 : 0),
    fetchedAt: new Date().toISOString(),
    source: "demo",
  };
}

export async function fetchPinWeather(
  dzongkhag: Dzongkhag,
  signal?: AbortSignal,
): Promise<PinWeatherSnapshot> {
  const coords = DZONGKHAG_COORDS[dzongkhag];
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${coords.lat}&longitude=${coords.lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&timezone=Asia%2FThimphu`;

  try {
    const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
    if (!res.ok) {
      console.error("[pin-weather] HTTP", res.status, dzongkhag);
      return demoWeather(dzongkhag);
    }
    const data = (await res.json()) as {
      current?: {
        temperature_2m?: number;
        apparent_temperature?: number;
        relative_humidity_2m?: number;
        weather_code?: number;
        wind_speed_10m?: number;
      };
    };
    const cur = data.current;
    if (!cur || typeof cur.temperature_2m !== "number") {
      console.error("[pin-weather] missing current payload", dzongkhag);
      return demoWeather(dzongkhag);
    }
    const code = Number(cur.weather_code ?? 0);
    return {
      tempC: Math.round(cur.temperature_2m),
      feelsC: Math.round(cur.apparent_temperature ?? cur.temperature_2m),
      humidity: Math.round(cur.relative_humidity_2m ?? 0),
      windKmh: Math.round(cur.wind_speed_10m ?? 0),
      code,
      label: weatherLabel(code),
      fetchedAt: new Date().toISOString(),
      source: "open-meteo",
    };
  } catch (err) {
    if (signal?.aborted) throw err;
    console.error("[pin-weather] fetch failed", dzongkhag, err);
    return demoWeather(dzongkhag);
  }
}
