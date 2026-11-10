/** Hardware interfaces — COPY later from root packages/hardware; no simulated success. */

export type PrintJob = {
  type: "kot" | "receipt" | "reg_card" | "invoice";
  bytes: Uint8Array;
};

export interface ThermalPrinter {
  print(job: PrintJob): Promise<{ ok: true } | { ok: false; error: string }>;
}

export interface KeycardEncoder {
  encode(input: {
    roomNumber: string;
    checkOut: string;
  }): Promise<{ ok: true; encodedCard: true } | { ok: false; encodedCard: false; error: string }>;
}

export class UnconfiguredPrinter implements ThermalPrinter {
  async print(): Promise<{ ok: false; error: string }> {
    return { ok: false, error: "No printer bridge configured" };
  }
}

export class UnconfiguredKeycard implements KeycardEncoder {
  async encode(): Promise<{ ok: false; encodedCard: false; error: string }> {
    return { ok: false, encodedCard: false, error: "No keycard encoder configured" };
  }
}
