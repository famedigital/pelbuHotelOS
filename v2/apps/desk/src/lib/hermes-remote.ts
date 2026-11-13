import { newIdempotencyKey, runCommand } from "./api";

export type HermesOcr = {
  kind: "passport" | "sdf";
  fullName?: string;
  passportOrCid?: string;
  nationality?: string;
  sdfRef?: string;
  confidence?: number;
};

export type HermesDocDraft = {
  id: string;
  propertyId: string;
  kind: "passport" | "sdf";
  status: "pending" | "applied" | "discarded";
  ocr: HermesOcr;
  suggestedStayId: string | null;
  appliedStayId: string | null;
  createdAt: string;
  appliedAt: string | null;
};

export type HermesChat = {
  id: string;
  propertyId: string;
  chatId: number;
  role: string;
  status: string;
  displayName: string | null;
  pairedAt: string;
  chatType?: string;
  agentId?: string | null;
  tgUsername?: string | null;
};

export type HermesEvent = {
  id: string;
  propertyId: string;
  chatId: number | null;
  direction: "in" | "out" | "system";
  intent: string;
  kind?: string;
  status?: string;
  text?: string | null;
  latencyMs?: number | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type HermesAlertKind =
  | "guest_check_in"
  | "guest_check_out"
  | "meal_board"
  | "invoice_issued"
  | "hk_dirty"
  | "night_audit";

export type HermesAlertPref = {
  kind: HermesAlertKind;
  enabled: boolean;
  sendAt: string | null;
  roles: Array<"fo" | "hk" | "kitchen" | "manager" | "gm" | "agent">;
};

export type HermesTopic = {
  id: string;
  propertyId: string;
  chatId: number;
  threadId: number;
  kind: string;
};

export type HermesStaffLink = {
  id: string;
  propertyId: string;
  tgUserId: number;
  staffName: string;
  role: string;
  linkedAt: string;
  active: boolean;
};

export type HermesOverview = {
  pairedChats: number;
  pendingDocs: number;
  appliedToday: number;
  botConfigured: boolean;
  botUsername: string;
  webhookSecretConfigured?: boolean;
  geminiConfigured: boolean;
  simulateMode: boolean;
  recentEvents: HermesEvent[];
  chats: HermesChat[];
  topics?: HermesTopic[];
};

export async function hermesOverview() {
  return runCommand<HermesOverview>("hermes.overview", {
    idempotencyKey: newIdempotencyKey(),
  });
}

export type HermesPairRole = "fo" | "manager" | "hk" | "kitchen" | "gm" | "agent";

export async function hermesCreatePairToken(
  role: HermesPairRole = "fo",
  agentId?: string,
) {
  return runCommand<{
    token: string;
    role: string;
    agentId: string | null;
    expiresAt: string;
    deepLink: string;
    botUsername: string;
  }>("hermes.createPairToken", {
    role,
    agentId,
    idempotencyKey: newIdempotencyKey(),
  });
}

export async function hermesPairState(token: string) {
  return runCommand<{
    used: boolean;
    expiresAt: string;
    expired: boolean;
    chat: {
      id: string;
      displayName: string | null;
      chatType: string;
      role: string;
    } | null;
  }>("hermes.pairState", {
    token,
    idempotencyKey: newIdempotencyKey(),
  });
}

export async function hermesLinkStaff(input: {
  tgUserId: number;
  staffName: string;
  role: Exclude<HermesPairRole, "agent">;
}) {
  return runCommand<{
    link: {
      id: string;
      tgUserId: number;
      staffName: string;
      role: string;
    };
  }>("hermes.linkStaff", {
    ...input,
    idempotencyKey: newIdempotencyKey(),
  });
}

export async function hermesListStaffLinks() {
  return runCommand<{ links: HermesStaffLink[] }>("hermes.listStaffLinks", {
    idempotencyKey: newIdempotencyKey(),
  });
}

export async function hermesBindTopic(input: {
  chatId: number;
  threadId: number;
  kind:
    | "front_office"
    | "housekeeping"
    | "kitchen_pos"
    | "management_audit"
    | "guides_drivers";
}) {
  return runCommand<{ topic: HermesTopic }>("hermes.bindTopic", {
    ...input,
    idempotencyKey: newIdempotencyKey(),
  });
}

export async function hermesListTopics() {
  return runCommand<{ topics: HermesTopic[] }>("hermes.listTopics", {
    idempotencyKey: newIdempotencyKey(),
  });
}

export async function hermesPostDepartmentPass(input: {
  pass: "kitchen" | "fb" | "hk" | "fo";
  text: string;
}) {
  return runCommand<{
    queued: boolean;
    chatId: number;
    threadId: number | null;
    delivery: string;
    error?: string;
  }>("hermes.postDepartmentPass", {
    ...input,
    idempotencyKey: newIdempotencyKey(),
  });
}

export async function hermesListChats() {
  return runCommand<{ chats: HermesChat[] }>("hermes.listChats", {
    idempotencyKey: newIdempotencyKey(),
  });
}

export async function hermesRevokeChat(chatRowId: string) {
  return runCommand<{ id: string; status: string }>("hermes.revokeChat", {
    chatRowId,
    idempotencyKey: newIdempotencyKey(),
  });
}

export async function hermesTestChat(chatRowId: string) {
  return runCommand<{
    delivered: boolean;
    delivery: string;
    error?: string;
  }>("hermes.testChat", {
    chatRowId,
    idempotencyKey: newIdempotencyKey(),
  });
}

export async function hermesListDocDrafts(
  status: "pending" | "applied" | "discarded" | "all" = "pending",
) {
  return runCommand<{ drafts: HermesDocDraft[] }>("hermes.listDocDrafts", {
    status,
    idempotencyKey: newIdempotencyKey(),
  });
}

export async function hermesApplyDocDraft(input: {
  draftId: string;
  bookingId: string;
  asCompanion?: boolean;
}) {
  return runCommand<{
    draftId: string;
    bookingId: string;
    guestName: string;
    roomLabel: string;
    ocr: HermesOcr;
  }>("hermes.applyDocDraft", {
    ...input,
    asCompanion: input.asCompanion ?? false,
    idempotencyKey: newIdempotencyKey(),
  });
}

export async function hermesDiscardDocDraft(draftId: string) {
  return runCommand<{ id: string; status: string }>("hermes.discardDocDraft", {
    draftId,
    idempotencyKey: newIdempotencyKey(),
  });
}

export async function hermesOcrDocument(input: {
  mime?: string;
  dataBase64?: string;
  hintKind?: "passport" | "sdf";
  simulate?: boolean;
  simulateFields?: {
    fullName?: string;
    passportOrCid?: string;
    nationality?: string;
    sdfRef?: string;
  };
  createDraft?: boolean;
}) {
  return runCommand<{
    draftId: string | null;
    ocr: HermesOcr;
    botConfigured: boolean;
    simulated: boolean;
  }>("hermes.ocrDocument", {
    mime: input.mime ?? "image/jpeg",
    dataBase64: input.dataBase64,
    hintKind: input.hintKind,
    simulate: input.simulate,
    simulateFields: input.simulateFields,
    createDraft: input.createDraft ?? true,
    idempotencyKey: newIdempotencyKey(),
  });
}

export async function hermesListEvents(input?: {
  intent?: string;
  kind?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}) {
  return runCommand<{
    events: HermesEvent[];
    nextCursor: string | null;
    total: number;
  }>("hermes.listEvents", {
    ...input,
    idempotencyKey: newIdempotencyKey(),
  });
}

export async function hermesGetAlerts() {
  return runCommand<{ prefs: HermesAlertPref[] }>("hermes.getAlerts", {
    idempotencyKey: newIdempotencyKey(),
  });
}

export async function hermesPutAlerts(prefs: HermesAlertPref[]) {
  return runCommand<{ prefs: HermesAlertPref[] }>("hermes.putAlerts", {
    prefs,
    idempotencyKey: newIdempotencyKey(),
  });
}

export async function hermesRegisterWebhook(publicBaseUrl?: string) {
  return runCommand<{
    webhookUrl: string;
    secretConfigured: boolean;
  }>("hermes.registerWebhook", {
    publicBaseUrl,
    idempotencyKey: newIdempotencyKey(),
  });
}

export async function hermesNotifyFolio(input: {
  bookingId: string;
  chatRowId?: string;
  summaryText?: string;
}) {
  return runCommand<{
    eventId: string;
    delivered: boolean;
    delivery: string;
    error?: string;
  }>("hermes.notifyFolio", {
    ...input,
    idempotencyKey: newIdempotencyKey(),
  });
}

export async function hermesAckDepositProof(eventId: string) {
  return runCommand<{ eventId: string; status: string }>(
    "hermes.ackDepositProof",
    {
      eventId,
      idempotencyKey: newIdempotencyKey(),
    },
  );
}

export async function hermesRecordDepositProof(input: {
  text: string;
  chatRowId?: string;
  amountBtn?: number;
}) {
  return runCommand<{ eventId: string; status: string }>(
    "hermes.recordDepositProof",
    {
      ...input,
      idempotencyKey: newIdempotencyKey(),
    },
  );
}

export function fileToBase64(
  file: File,
): Promise<{ mime: string; dataBase64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      const dataBase64 = comma >= 0 ? result.slice(comma + 1) : result;
      resolve({ mime: file.type || "image/jpeg", dataBase64 });
    };
    reader.readAsDataURL(file);
  });
}

export function thimphuTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      timeZone: "Asia/Thimphu",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
