/** Thin Telegram Bot API client for Hotel Hermes. */

export function telegramBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

export function telegramBotUsername(): string {
  return process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") || "HotelOSHermesBot";
}

export function telegramWebhookSecret(): string | null {
  return process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || null;
}

export type InlineButton = {
  text: string;
  callback_data: string;
};

async function tgApi<T>(
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
  const token = telegramBotToken();
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN not set" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      description?: string;
      result?: T;
    };
    if (!json.ok || json.result === undefined) {
      return { ok: false, error: json.description || `Telegram ${method} failed` };
    }
    return { ok: true, result: json.result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export async function sendMessage(
  chatId: number,
  text: string,
  replyMarkup?: { inline_keyboard: InlineButton[][] },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await tgApi<unknown>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
  });
  if (!res.ok) return res;
  return { ok: true };
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  await tgApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: text?.slice(0, 180),
  });
}

export async function getFileBase64(
  fileId: string,
): Promise<
  { ok: true; mime: string; dataBase64: string } | { ok: false; error: string }
> {
  const token = telegramBotToken();
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN not set" };
  const meta = await tgApi<{ file_path?: string }>("getFile", { file_id: fileId });
  if (!meta.ok) return meta;
  const path = meta.result.file_path;
  if (!path) return { ok: false, error: "Telegram file_path missing" };
  try {
    const res = await fetch(`https://api.telegram.org/file/bot${token}/${path}`);
    if (!res.ok) return { ok: false, error: `Download failed ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    const lower = path.toLowerCase();
    const mime = lower.endsWith(".png")
      ? "image/png"
      : lower.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";
    return { ok: true, mime, dataBase64: buf.toString("base64") };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export function pairingDeepLink(token: string): string {
  return `https://t.me/${telegramBotUsername()}?start=pair_${token}`;
}
