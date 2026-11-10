/** Slim Gemini Vision JSON helper for Hotel Hermes OCR (Wave 1). */

const MODELS = [
  "gemini-2.0-flash",
  "gemini-flash-latest",
  "gemini-1.5-flash",
] as const;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function readGeminiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key || null;
}

export function readJsonText(raw: string): unknown | null {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    } catch {
      return null;
    }
  }
}

async function generateOnce(
  model: string,
  key: string,
  prompt: string,
  image: { mime: string; data: string },
  timeoutMs: number,
): Promise<"retry" | "stop" | { text: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: image.mime || "image/jpeg",
                    data: image.data,
                  },
                },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      },
    );
    if (res.status === 401 || res.status === 403) return "stop";
    if (res.status === 429 || res.status >= 500) {
      await sleep(400);
      return "retry";
    }
    if (!res.ok) return "retry";
    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text.trim()) return "retry";
    return { text };
  } catch {
    return "retry";
  } finally {
    clearTimeout(timer);
  }
}

export async function geminiVisionJsonOnce(
  key: string,
  prompt: string,
  mime: string,
  dataBase64: string,
  timeoutMs = 25_000,
): Promise<unknown | null> {
  const started = Date.now();
  for (const model of MODELS) {
    const left = timeoutMs - (Date.now() - started);
    if (left < 2_000) break;
    const result = await generateOnce(
      model,
      key,
      prompt,
      { mime, data: dataBase64 },
      left,
    );
    if (result === "stop") return null;
    if (result === "retry") continue;
    const parsed = readJsonText(result.text);
    if (parsed) return parsed;
  }
  return null;
}
