/**
 * Desk print helper — uses a hidden iframe so Chrome does not block
 * window.open("", "_blank") as a pop-up (about:blank).
 */
export function printHtmlDocument(html: string, title = "Print"): void {
  if (typeof document === "undefined") {
    throw new Error("Print is only available in the browser");
  }

  const prev = document.getElementById("hos-v2-print-frame");
  if (prev) prev.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "hos-v2-print-frame";
  iframe.title = title;
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument ?? win?.document;
  if (!win || !doc) {
    iframe.remove();
    throw new Error("Could not open print frame");
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    try {
      iframe.remove();
    } catch {
      /* ignore */
    }
  };

  const trigger = () => {
    try {
      win.focus();
      win.print();
    } finally {
      // Delay remove so the print dialog can attach to the frame.
      window.setTimeout(cleanup, 1000);
    }
  };

  // Images / fonts: print after load; fallback timer if load already fired.
  if (doc.readyState === "complete") {
    window.setTimeout(trigger, 50);
  } else {
    iframe.addEventListener("load", () => window.setTimeout(trigger, 50), { once: true });
    window.setTimeout(trigger, 300);
  }
}

export function escapePrintHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
