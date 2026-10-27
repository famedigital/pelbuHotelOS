export type CollectionFolioLink = {
  id: string;
  folioType: string | null;
  masterFolioId: string | null;
};

export type CollectionMasterPlan =
  | { ok: true; masterId: string; attachIds: string[] }
  | { ok: false; error: string };

/**
 * Pick one master folio for a collection bill.
 * An existing master in the list is kept. Otherwise the first folio becomes the master.
 * Two different masters are refused so a party bill is not merged by accident.
 */
export function planCollectionMaster(
  folios: CollectionFolioLink[],
): CollectionMasterPlan {
  const ordered: CollectionFolioLink[] = [];
  const seen = new Set<string>();
  for (const folio of folios) {
    const id = folio.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ordered.push({ ...folio, id });
  }
  if (ordered.length === 0) {
    return { ok: false, error: "Choose at least one stay." };
  }

  const roots = ordered.filter(
    (folio) => folio.folioType === "master" && !folio.masterFolioId,
  );
  if (roots.length > 1) {
    return {
      ok: false,
      error:
        "These stays already use different master bills. Combine stays that share one master, or stays that are not a master yet.",
    };
  }

  const masterId = roots[0]?.id ?? ordered[0].id;
  return {
    ok: true,
    masterId,
    attachIds: ordered.map((folio) => folio.id).filter((id) => id !== masterId),
  };
}
