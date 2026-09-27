export type DeskPrintTarget =
  | "note"
  | "voucher"
  | "reg"
  | "reg-party"
  | "settlement";

const PRINT_ROOT_ID: Record<DeskPrintTarget, string> = {
  note: "print-booking-note",
  voucher: "print-agent-voucher",
  reg: "print-reg-card",
  "reg-party": "print-reg-party",
  settlement: "print-agent-settlement",
};

/**
 * Copy the sheet onto document.body, then print.
 * The live sheet often sits inside a dialog; hiding the page for print
 * left that copy blank.
 */
export function printDeskSheet(target: DeskPrintTarget) {
  if (typeof window === "undefined") return;
  const html = document.documentElement;
  const source = document.getElementById(PRINT_ROOT_ID[target]);
  const previous = document.getElementById("desk-print-mount");
  previous?.remove();

  if (source) {
    const mount = document.createElement("div");
    mount.id = "desk-print-mount";
    mount.appendChild(source.cloneNode(true));
    document.body.appendChild(mount);
  }

  html.setAttribute("data-desk-print", target);
  html.setAttribute("data-doc-paper", "a4");
  const cleanup = () => {
    html.removeAttribute("data-desk-print");
    html.removeAttribute("data-doc-paper");
    document.getElementById("desk-print-mount")?.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
  window.setTimeout(cleanup, 1500);
}
