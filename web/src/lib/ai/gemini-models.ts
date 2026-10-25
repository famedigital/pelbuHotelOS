/** Google shut these off. Trying them only adds a 404 before the real call. */
const RETIRED_GEMINI_MODELS = new Set([
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
  "gemini-2.5-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-pro",
]);

/** Current fast model, then one older live model if Google returns 404. */
const FAST_GEMINI_MODELS = ["gemini-3.8-flash", "gemini-2.5-flash"] as const;

export const LIVE_GEMINI_MODEL = FAST_GEMINI_MODELS[0];

/** At most two models. Retired names never occupy the first slot. */
export function deskGeminiModels(saved?: string | null): string[] {
  const name = saved?.trim() ?? "";
  const preferred =
    name && !RETIRED_GEMINI_MODELS.has(name) ? name : LIVE_GEMINI_MODEL;
  const fallback = FAST_GEMINI_MODELS.find((model) => model !== preferred);
  return fallback ? [preferred, fallback] : [preferred];
}

export function liveGeminiModel(saved?: string | null): string {
  return deskGeminiModels(saved)[0];
}
