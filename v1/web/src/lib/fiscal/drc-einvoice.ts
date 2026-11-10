/**
 * Bhutan DRC / RRCO e-invoice adapter — interface + stub only.
 * Do not call a live API until DRC publishes the mandated endpoint and credentials.
 *
 * See docs/GST-EINVOICE.md
 */

export type EinvoiceDocKind = "invoice" | "credit_note" | "receipt";

export type EinvoicePayload = {
  propertyId: string;
  fiscalDocId: string;
  docKind: EinvoiceDocKind;
  docNo: string;
  issuedAt: string;
  buyerName: string | null;
  buyerTaxId: string | null;
  lines: Array<{
    description: string;
    qty: number;
    amountBtn: number;
    gstBtn: number;
  }>;
  totalBtn: number;
  gstBtn: number;
};

export type EinvoiceSubmitResult =
  | {
      ok: true;
      status: "queued" | "accepted" | "not_configured";
      externalRef?: string;
      message: string;
    }
  | {
      ok: false;
      status: "rejected" | "unavailable";
      message: string;
    };

export interface BhutanEinvoiceClient {
  /** Whether live submission is enabled (env + mandate flag). */
  isLive(): boolean;
  /** Validate payload shape without network I/O. */
  validate(payload: EinvoicePayload): { ok: boolean; errors: string[] };
  /** Submit to DRC when live; otherwise returns not_configured. */
  submit(payload: EinvoicePayload): Promise<EinvoiceSubmitResult>;
}

function requiredFields(payload: EinvoicePayload): string[] {
  const errors: string[] = [];
  if (!payload.propertyId) errors.push("propertyId required");
  if (!payload.fiscalDocId) errors.push("fiscalDocId required");
  if (!payload.docNo) errors.push("docNo required");
  if (!payload.lines.length) errors.push("at least one line required");
  if (!(payload.totalBtn > 0)) errors.push("totalBtn must be positive");
  return errors;
}

/**
 * Stub client: validates locally; never invents a DRC HTTP call.
 * Flip `BHUTAN_EINVOICE_LIVE=1` only after real credentials exist — still no-ops network.
 */
export class StubBhutanEinvoiceClient implements BhutanEinvoiceClient {
  isLive(): boolean {
    return process.env.BHUTAN_EINVOICE_LIVE === "1";
  }

  validate(payload: EinvoicePayload): { ok: boolean; errors: string[] } {
    const errors = requiredFields(payload);
    return { ok: errors.length === 0, errors };
  }

  async submit(payload: EinvoicePayload): Promise<EinvoiceSubmitResult> {
    const { ok, errors } = this.validate(payload);
    if (!ok) {
      return {
        ok: false,
        status: "rejected",
        message: errors.join("; "),
      };
    }
    if (!this.isLive()) {
      return {
        ok: true,
        status: "not_configured",
        message:
          "DRC e-invoice API not configured. Internal INV/RCP/CN sequences remain the fiscal record until mandate + credentials.",
      };
    }
    return {
      ok: true,
      status: "queued",
      message:
        "Live flag set but no DRC endpoint wired yet — document queued locally only.",
    };
  }
}

let singleton: BhutanEinvoiceClient | null = null;

export function getBhutanEinvoiceClient(): BhutanEinvoiceClient {
  if (!singleton) singleton = new StubBhutanEinvoiceClient();
  return singleton;
}
