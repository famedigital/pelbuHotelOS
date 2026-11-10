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
};

export type HermesOverview = {
  pairedChats: number;
  pendingDocs: number;
  appliedToday: number;
  botConfigured: boolean;
  botUsername: string;
  geminiConfigured: boolean;
  simulateMode: boolean;
  recentEvents: {
    id: string;
    intent: string;
    direction: string;
    createdAt: string;
  }[];
  chats: HermesChat[];
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

export function fileToBase64(file: File): Promise<{ mime: string; dataBase64: string }> {
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
