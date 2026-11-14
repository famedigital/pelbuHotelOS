/**
 * Keep desk hotelInitial / FN·INV prefixes aligned with the live property.
 * Demo leftover "DH" must not stick on Pelbu Suites groups (PSFN / PSINV).
 */
import {
  canonicalHotelInitial,
  rewriteDocHotelInitial,
} from "./doc-numbers";
import { useSettingsStore } from "./settings-store";

function isDemoName(name: string): boolean {
  return /\bdemo\b/i.test(name.trim());
}

/** Rewrite stay folio/tax INV + fiscal register docs from one initial to another. */
export async function rewriteDeskDocInitials(
  fromInitial: string,
  toInitial: string,
): Promise<number> {
  const from = fromInitial.trim().toUpperCase();
  const to = toInitial.trim().toUpperCase().slice(0, 4);
  if (!from || !to || from === to) return 0;

  const { useFrontOfficeStore } = await import("./front-office-store");
  const { useExtrasStore } = await import("./extras-store");

  let changed = 0;
  useFrontOfficeStore.setState((st) => ({
    stays: st.stays.map((stay) => {
      const folioNo = stay.folioNo
        ? rewriteDocHotelInitial(stay.folioNo, from, to)
        : stay.folioNo;
      const taxInvoiceNo = stay.taxInvoiceNo
        ? rewriteDocHotelInitial(stay.taxInvoiceNo, from, to)
        : stay.taxInvoiceNo;
      if (folioNo !== stay.folioNo || taxInvoiceNo !== stay.taxInvoiceNo) changed += 1;
      return { ...stay, folioNo, taxInvoiceNo };
    }),
    liveRevision: st.liveRevision + 1,
  }));

  useExtrasStore.setState((ex) => ({
    fiscalDocs: ex.fiscalDocs.map((d) => {
      const docNo = rewriteDocHotelInitial(d.docNo, from, to);
      if (docNo !== d.docNo) changed += 1;
      return { ...d, docNo };
    }),
  }));

  return changed;
}

/**
 * Sync hotel name from API property; if Demo/DH leftovers remain on a real
 * property (esp. Pelbu), adopt canonical initial and rewrite DH* → PS* docs.
 */
export async function applyPropertyHotelIdentity(hotelName: string): Promise<void> {
  const name = hotelName.trim();
  if (!name) return;

  const settings = useSettingsStore.getState();
  const prevInitial = (
    settings.hotelInitial?.trim() ||
    (isDemoName(settings.hotelName) ? "DH" : canonicalHotelInitial(settings.hotelName))
  ).toUpperCase();
  const nextInitial = canonicalHotelInitial(name);

  const adoptInitial =
    prevInitial !== nextInitial &&
    (prevInitial === "DH" || isDemoName(settings.hotelName)) &&
    !isDemoName(name);

  settings.updateProfile({ hotelName: name });

  if (
    adoptInitial &&
    (!settings.bnbAccountName.trim() || isDemoName(settings.bnbAccountName))
  ) {
    useSettingsStore.getState().updatePayments({ bnbAccountName: name });
  }

  if (adoptInitial) {
    useSettingsStore.getState().updateFiscal({
      hotelInitial: nextInitial,
      invPrefix: `${nextInitial}INV`,
      psbnPrefix: `${nextInitial}PSBN`,
    });
    await rewriteDeskDocInitials(prevInitial, nextInitial);
    return;
  }

  /* Settings already PS but leftover Demo DHFN/DHINV on Pelbu stays. */
  if (nextInitial === "PS" && prevInitial === "PS") {
    await rewriteDeskDocInitials("DH", "PS");
  }
}
