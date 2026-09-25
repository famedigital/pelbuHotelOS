/** Browser prefs for POS receipt + KOT printers — local to this register. */

export type PosReceiptPaper = "thermal" | "a4";

/** How physical printers are used (browser cannot name devices — OS picks). */
export type PosPrinterMode = "same" | "separate";

/**
 * After settle, what to send to the print dialog(s).
 * - receipt: guest paid receipt only
 * - kot_and_receipt: kitchen ticket then guest receipt (same or separate printers)
 * - none: no auto-print
 */
export type PosSettlePrint = "receipt" | "kot_and_receipt" | "none";

export type PosPrintPrefs = {
  /** Auto-open guest receipt print after settle. */
  receiptAutoPrint: boolean;
  receiptPaper: PosReceiptPaper;
  /** Print kitchen ticket when order is sent / fired. */
  kotPrintOnSend: boolean;
  /** Paper for KOT (almost always thermal). */
  kotPaper: PosReceiptPaper;
  /**
   * same — one printer for KOT + receipt (pick the same device twice, or
   * OS remembers). separate — two dialogs so you can pick KOT printer then
   * receipt printer.
   */
  printerMode: PosPrinterMode;
  settlePrint: PosSettlePrint;
};

const KEY = "pelbu.pos.printPrefs";

export const DEFAULT_POS_PRINT_PREFS: PosPrintPrefs = {
  receiptAutoPrint: true,
  receiptPaper: "thermal",
  kotPrintOnSend: true,
  kotPaper: "thermal",
  printerMode: "same",
  settlePrint: "receipt",
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function coerce(raw: Partial<PosPrintPrefs> | null | undefined): PosPrintPrefs {
  const d = DEFAULT_POS_PRINT_PREFS;
  if (!raw || typeof raw !== "object") return { ...d };
  return {
    receiptAutoPrint:
      typeof raw.receiptAutoPrint === "boolean"
        ? raw.receiptAutoPrint
        : d.receiptAutoPrint,
    receiptPaper:
      raw.receiptPaper === "a4" || raw.receiptPaper === "thermal"
        ? raw.receiptPaper
        : d.receiptPaper,
    kotPrintOnSend:
      typeof raw.kotPrintOnSend === "boolean"
        ? raw.kotPrintOnSend
        : d.kotPrintOnSend,
    kotPaper:
      raw.kotPaper === "a4" || raw.kotPaper === "thermal"
        ? raw.kotPaper
        : d.kotPaper,
    printerMode:
      raw.printerMode === "same" || raw.printerMode === "separate"
        ? raw.printerMode
        : d.printerMode,
    settlePrint:
      raw.settlePrint === "receipt" ||
      raw.settlePrint === "kot_and_receipt" ||
      raw.settlePrint === "none"
        ? raw.settlePrint
        : d.settlePrint,
  };
}

export function readPosPrintPrefs(): PosPrintPrefs {
  if (!canUseStorage()) return { ...DEFAULT_POS_PRINT_PREFS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_POS_PRINT_PREFS };
    return coerce(JSON.parse(raw) as Partial<PosPrintPrefs>);
  } catch {
    return { ...DEFAULT_POS_PRINT_PREFS };
  }
}

export function writePosPrintPrefs(next: PosPrintPrefs): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(coerce(next)));
  } catch {
    /* ignore */
  }
}

export function receiptPrintUrl(
  orderId: string,
  opts?: { print?: boolean; paper?: PosReceiptPaper },
): string {
  const prefs = typeof window !== "undefined" ? readPosPrintPrefs() : null;
  const paper = opts?.paper ?? prefs?.receiptPaper ?? "thermal";
  const print = opts?.print ?? prefs?.receiptAutoPrint ?? true;
  const q = new URLSearchParams({ paper });
  if (print) q.set("print", "1");
  return `/erp/orders/${orderId}/receipt?${q.toString()}`;
}

export function kotPrintUrl(
  orderId: string,
  opts?: { print?: boolean; paper?: PosReceiptPaper },
): string {
  const prefs = typeof window !== "undefined" ? readPosPrintPrefs() : null;
  const paper = opts?.paper ?? prefs?.kotPaper ?? "thermal";
  const print = opts?.print ?? true;
  const q = new URLSearchParams({ paper });
  if (print) q.set("print", "1");
  return `/erp/orders/${orderId}/kot?${q.toString()}`;
}

/** Open a named shell early (avoids popup blockers on settle). */
export function openPrintShell(name: string, title = "Printing…"): Window | null {
  try {
    const w = window.open("about:blank", name);
    if (!w) return null;
    w.document.open();
    w.document.write(
      `<!doctype html><html><head><title>${title}</title></head>` +
        `<body style="font:14px system-ui;padding:24px;color:#111">${title}</body></html>`,
    );
    w.document.close();
    return w;
  } catch {
    return null;
  }
}

function navigateShell(shell: Window | null, url: string): boolean {
  if (shell && !shell.closed) {
    try {
      shell.location.href = url;
      shell.focus();
      return true;
    } catch {
      /* fall through */
    }
  }
  window.open(url, "_blank");
  return false;
}

/**
 * After settle: honour print prefs (receipt / KOT+receipt / none).
 * `same` printer → KOT window then receipt in sequence (user picks one device).
 * `separate` → two shells so each dialog can target a different printer.
 */
export function routeSettlePrints(
  orderId: string,
  receiptShell: Window | null,
): void {
  const prefs = readPosPrintPrefs();
  if (prefs.settlePrint === "none") {
    if (receiptShell && !receiptShell.closed) {
      try {
        receiptShell.close();
      } catch {
        /* ignore */
      }
    }
    return;
  }

  const wantKot = prefs.settlePrint === "kot_and_receipt";
  const receiptUrl = receiptPrintUrl(orderId, {
    print: prefs.receiptAutoPrint,
    paper: prefs.receiptPaper,
  });
  const kotUrl = kotPrintUrl(orderId, {
    print: true,
    paper: prefs.kotPaper,
  });

  if (!wantKot) {
    navigateShell(receiptShell, receiptUrl);
    return;
  }

  if (prefs.printerMode === "separate") {
    const kotShell = openPrintShell("posKotPrint", "KOT…");
    navigateShell(kotShell, kotUrl);
    // Slight delay so the second dialog isn't swallowed.
    window.setTimeout(() => {
      navigateShell(receiptShell, receiptUrl);
    }, 600);
    return;
  }

  // Same printer: KOT first, then receipt after a beat (one physical device).
  navigateShell(receiptShell, kotUrl);
  window.setTimeout(() => {
    const second = openPrintShell("posReceiptPrint", "Guest receipt…");
    navigateShell(second, receiptUrl);
  }, 900);
}

/** After send/fire: print kitchen ticket when enabled. */
export function routeKotPrintOnSend(orderId: string): void {
  const prefs = readPosPrintPrefs();
  if (!prefs.kotPrintOnSend) return;
  const shell = openPrintShell("posKotPrint", "KOT…");
  navigateShell(
    shell,
    kotPrintUrl(orderId, { print: true, paper: prefs.kotPaper }),
  );
}
