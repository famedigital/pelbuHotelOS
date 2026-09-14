export type DeskPrintTarget =
  | "note"
  | "voucher"
  | "reg"
  | "reg-party"
  | "settlement";

/** Reveal `#print-*` sheets via html[data-desk-print] (see globals.css). */
export function printDeskSheet(target: DeskPrintTarget) {
  if (typeof window === "undefined") return;
  const html = document.documentElement;
  html.setAttribute("data-desk-print", target);
  html.setAttribute("data-doc-paper", "a4");
  const cleanup = () => {
    html.removeAttribute("data-desk-print");
    html.removeAttribute("data-doc-paper");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
  window.setTimeout(cleanup, 1500);
}
