/**
 * Rate sheet pack composition + HMAC share tokens (browser Web Crypto).
 * Mirrors Innora agent-rate-pdf audience patterns: public/B2B open; MoU gated.
 */

import {
  TYPES,
  type Agent,
  type MealPlan,
  type RateCard,
  type RateCell,
  type Season,
} from "./commercial-store";
import {
  getPropertyBrand,
  getRoomTypeMedia,
  type PropertyBrand,
  type RoomTypeMedia,
} from "./property-brand";
import { getPropertyTaxPolicy } from "./property-tax-policy";

export const RATE_SHARE_TTL_MS = 15 * 60 * 1000;
export const RATE_SHARE_PUBLIC_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const SHARE_SECRET =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: { VITE_RATE_SHARE_SECRET?: string } }).env
      ?.VITE_RATE_SHARE_SECRET) ||
  "hos-v2-desk-rate-sheet-dev";

export type RateShareAudience = "public_b2b" | "selected" | "mou";

export type RateSharePayload = {
  v: 1;
  audience: RateShareAudience;
  cardIds: string[];
  season: Season;
  mealPlan: MealPlan;
  propertyId: string;
  exp: number;
  agentId?: string;
  /** Human label for OG / WhatsApp */
  title?: string;
};

export type RateSheetRow = {
  typeCode: string;
  label: string;
  photos: string[];
  cards: {
    cardId: string;
    code: string;
    name: string;
    double: number;
    single: number;
    extra: number;
    child: number;
  }[];
};

export type RateSheetPack = {
  brand: PropertyBrand;
  media: RoomTypeMedia[];
  season: Season;
  mealPlan: MealPlan;
  cards: RateCard[];
  rows: RateSheetRow[];
  scOn: boolean;
  gstOn: boolean;
  confidential: boolean;
  agent?: Pick<Agent, "id" | "name" | "code" | "contact">;
  validityNote: string;
  childPolicy: string;
};

export type MouAcceptance = {
  id: string;
  propertyId: string;
  agentId: string;
  agentName: string;
  tokenFingerprint: string;
  signerName: string;
  contact: string;
  acceptedAt: string;
};

export type MouChallenge = {
  tokenFingerprint: string;
  code: string;
  contactHint: string;
  exp: number;
};

const MOU_ACCEPT_KEY = "hos-v2-mou-acceptances";

function loadMouAcceptances(): MouAcceptance[] {
  try {
    const raw = localStorage.getItem(MOU_ACCEPT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MouAcceptance[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("[rate-share] load acceptances failed", err);
    return [];
  }
}

function persistMouAcceptances(rows: MouAcceptance[]): void {
  try {
    localStorage.setItem(MOU_ACCEPT_KEY, JSON.stringify(rows.slice(-200)));
  } catch (err) {
    console.warn("[rate-share] persist acceptances failed", err);
  }
}

const mouAcceptances: MouAcceptance[] =
  typeof localStorage !== "undefined" ? loadMouAcceptances() : [];
const mouChallenges = new Map<string, MouChallenge>();

function b64urlBytes(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlString(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64urlString(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return decodeURIComponent(escape(atob(b64)));
}

async function hmacSign(payloadB64: string, secret = SHARE_SECRET): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadB64),
  );
  return b64urlBytes(new Uint8Array(sig));
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export function tokenFingerprint(token: string): string {
  return token.slice(0, 24);
}

/** Cards safe for public + common B2B WhatsApp / website */
export function publicB2bCardIds(cards: RateCard[]): string[] {
  return cards
    .filter(
      (c) =>
        c.active &&
        (c.kind === "public" || c.kind === "personal" || c.kind === "agent"),
    )
    .map((c) => c.id);
}

export function composeRateSheetPack(input: {
  cards: RateCard[];
  cells: RateCell[];
  cardIds: string[];
  season: Season;
  mealPlan: MealPlan;
  agent?: Agent | null;
  confidential?: boolean;
}): RateSheetPack {
  const brand = getPropertyBrand();
  const media = getRoomTypeMedia();
  const tax = getPropertyTaxPolicy();
  const selected = input.cards.filter(
    (c) => c.active && input.cardIds.includes(c.id),
  );
  const rows: RateSheetRow[] = TYPES.map((t) => {
    const photos = media.find((m) => m.typeCode === t.code)?.photos ?? [];
    const cardCols = selected.map((card) => {
      const cell = input.cells.find(
        (c) =>
          c.rateCardId === card.id &&
          c.typeCode === t.code &&
          c.season === input.season &&
          c.mealPlan === input.mealPlan,
      );
      return {
        cardId: card.id,
        code: card.code,
        name: card.name,
        double: cell?.doubleNet ?? cell?.netAmount ?? 0,
        single: cell?.singleNet ?? 0,
        extra: cell?.extraNet ?? 0,
        child: cell?.childNet ?? 0,
      };
    });
    return {
      typeCode: t.code,
      label: t.name,
      photos,
      cards: cardCols,
    };
  });

  return {
    brand,
    media,
    season: input.season,
    mealPlan: input.mealPlan,
    cards: selected,
    rows,
    scOn: tax.scOn,
    gstOn: tax.gstOn,
    confidential: Boolean(input.confidential ?? input.agent),
    agent: input.agent
      ? {
          id: input.agent.id,
          name: input.agent.name,
          code: input.agent.code,
          contact: input.agent.contact,
        }
      : undefined,
    validityNote: `Rates valid for the stated season · subject to change without notice · ${brand.locality}`,
    childPolicy:
      "Child 0–5 sharing parents’ bed: free. Child 6–11: child rate. Extra bed charged separately.",
  };
}

export async function mintRateShareToken(
  payload: Omit<RateSharePayload, "v" | "exp"> & { exp?: number },
  now = Date.now(),
): Promise<string> {
  const ttl =
    payload.audience === "mou" ? RATE_SHARE_TTL_MS : RATE_SHARE_PUBLIC_TTL_MS;
  const body: RateSharePayload = {
    v: 1,
    audience: payload.audience,
    cardIds: [...payload.cardIds],
    season: payload.season,
    mealPlan: payload.mealPlan,
    propertyId: payload.propertyId,
    exp: payload.exp ?? now + ttl,
    agentId: payload.agentId,
    title: payload.title,
  };
  const payloadB64 = b64urlString(JSON.stringify(body));
  const sig = await hmacSign(payloadB64);
  return `${payloadB64}.${sig}`;
}

export async function parseRateShareToken(
  token: string | undefined | null,
  now = Date.now(),
): Promise<RateSharePayload | null> {
  if (!token) return null;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;
  let expected: string;
  try {
    expected = await hmacSign(payloadB64);
  } catch (err) {
    console.error("[rate-share] hmac failed", err);
    return null;
  }
  if (!timingSafeEqualStr(sig, expected)) return null;
  try {
    const raw = fromB64urlString(payloadB64);
    const body = JSON.parse(raw) as RateSharePayload;
    if (
      body.v !== 1 ||
      !Array.isArray(body.cardIds) ||
      !body.season ||
      !body.mealPlan ||
      !body.propertyId ||
      typeof body.exp !== "number" ||
      body.exp <= now
    ) {
      return null;
    }
    if (body.audience === "mou" && !body.agentId) return null;
    return body;
  } catch (err) {
    console.error("[rate-share] parse failed", err);
    return null;
  }
}

export function sharePathForToken(token: string): string {
  return `/rates/share/${encodeURIComponent(token)}`;
}

export function absoluteShareUrl(token: string, origin = window.location.origin): string {
  return `${origin}${sharePathForToken(token)}`;
}

/** Issue one-time code for MoU gate (shown in desk toast / agent contact match). */
export function issueMouChallenge(
  token: string,
  agent: Pick<Agent, "contact" | "name">,
  now = Date.now(),
): MouChallenge {
  const fp = tokenFingerprint(token);
  const code = String(100000 + Math.floor(Math.random() * 900000));
  const challenge: MouChallenge = {
    tokenFingerprint: fp,
    code,
    contactHint: agent.contact,
    exp: now + RATE_SHARE_TTL_MS,
  };
  mouChallenges.set(fp, challenge);
  return challenge;
}

export function verifyMouContactAndCode(input: {
  token: string;
  contact: string;
  code: string;
  agentContact: string;
  now?: number;
}): { ok: true } | { ok: false; error: string } {
  const now = input.now ?? Date.now();
  const fp = tokenFingerprint(input.token);
  const challenge = mouChallenges.get(fp);
  if (!challenge || challenge.exp <= now) {
    return { ok: false, error: "Verification code expired — request a new link" };
  }
  const contactNorm = input.contact.trim().toLowerCase();
  if (!contactNorm) {
    return { ok: false, error: "Enter the email or phone on the MoU" };
  }
  const agentNorm = input.agentContact.trim().toLowerCase();
  const digits = contactNorm.replace(/\D/g, "");
  const agentDigits = agentNorm.replace(/\D/g, "");
  const emailOk = agentNorm.includes(contactNorm) || contactNorm === agentNorm;
  const phoneOk = digits.length >= 6 && agentDigits.includes(digits);
  if (!emailOk && !phoneOk) {
    return { ok: false, error: "Contact does not match the MoU agent on file" };
  }
  if (!timingSafeEqualStr(input.code.trim(), challenge.code)) {
    return { ok: false, error: "Invalid verification code" };
  }
  return { ok: true };
}

export function acceptMouTerms(input: {
  token: string;
  propertyId: string;
  agentId: string;
  agentName: string;
  signerName: string;
  contact: string;
}): { ok: true; acceptance: MouAcceptance } | { ok: false; error: string } {
  const name = input.signerName.trim();
  if (name.length < 2) {
    return { ok: false, error: "Type your full name to accept the MoU" };
  }
  const acceptance: MouAcceptance = {
    id: `mou-acc-${Date.now()}`,
    propertyId: input.propertyId,
    agentId: input.agentId,
    agentName: input.agentName,
    tokenFingerprint: tokenFingerprint(input.token),
    signerName: name,
    contact: input.contact.trim(),
    acceptedAt: new Date().toISOString(),
  };
  mouAcceptances.push(acceptance);
  persistMouAcceptances(mouAcceptances);
  mouChallenges.delete(tokenFingerprint(input.token));
  return { ok: true, acceptance };
}

export function hasMouAcceptance(token: string): MouAcceptance | undefined {
  const fp = tokenFingerprint(token);
  return [...mouAcceptances].reverse().find((a) => a.tokenFingerprint === fp);
}

export function listMouAcceptances(): MouAcceptance[] {
  return [...mouAcceptances];
}

/** Session unlock after verify+sign (survives refresh for this tab). */
export function markMouSessionUnlocked(token: string): void {
  try {
    sessionStorage.setItem(`hos-mou-unlock:${tokenFingerprint(token)}`, "1");
  } catch (err) {
    console.warn("[rate-share] sessionStorage unavailable", err);
  }
}

export function isMouSessionUnlocked(token: string): boolean {
  if (hasMouAcceptance(token)) return true;
  try {
    return sessionStorage.getItem(`hos-mou-unlock:${tokenFingerprint(token)}`) === "1";
  } catch {
    return false;
  }
}
