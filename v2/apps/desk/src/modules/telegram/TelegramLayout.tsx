import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { hermesOverview, type HermesOverview } from "../../lib/hermes-remote";
import { PairWizard } from "./PairWizard";
import { TelegramDeskFrame } from "./TelegramDeskFrame";
import { TelegramOverviewContext } from "./telegram-context";

export function TelegramLayout() {
  const [overview, setOverview] = useState<HermesOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [pairOpen, setPairOpen] = useState(false);
  const [autoPairTried, setAutoPairTried] = useState(false);

  const refresh = useCallback(async () => {
    const ov = await hermesOverview();
    if (ov.ok) setOverview(ov.data);
    else toast.error(ov.error);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (autoPairTried || !overview) return;
    if (overview.pairedChats === 0) {
      setPairOpen(true);
      setAutoPairTried(true);
    }
  }, [overview, autoPairTried]);

  return (
    <TelegramOverviewContext.Provider
      value={{ overview, setOverview, refresh }}
    >
      <TelegramDeskFrame
        busy={busy}
        onRefresh={() => {
          setBusy(true);
          void refresh().finally(() => setBusy(false));
        }}
        onPair={() => setPairOpen(true)}
      />
      <PairWizard
        open={pairOpen}
        onClose={() => setPairOpen(false)}
        onPaired={() => {
          void refresh();
        }}
      />
    </TelegramOverviewContext.Provider>
  );
}
