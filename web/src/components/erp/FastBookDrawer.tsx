"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentPicker, type BookableAgent } from "@/components/erp/AgentPicker";
import {
  CreditAgentPromotePanel,
  needsCreditPromote,
} from "@/components/erp/CreditAgentPromotePanel";
import { StaffPicker, type BookableStaff } from "@/components/erp/StaffPicker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useAgentCreditEligibilityNotify } from "@/hooks/use-agent-credit-eligibility-notify";
import { toast } from "sonner";

type Props = {
  agents: BookableAgent[];
  staff: BookableStaff[];
  defaultSoldByStaffId?: string;
  pending: boolean;
  open: boolean;
  onClose: () => void;
  hasQty: boolean;
  mealPlans: { code: string; name: string; blurb: string | null }[];
  defaultMealPlanCode: string;
  defaultGuestOrigin: string;
};

function DrawerBody({
  agents,
  staff,
  pending,
  hasQty,
  agentId,
  setAgentId,
  soldByStaffId,
  setSoldByStaffId,
  mealPlans,
  defaultMealPlanCode,
  defaultGuestOrigin,
}: {
  agents: BookableAgent[];
  staff: BookableStaff[];
  pending: boolean;
  hasQty: boolean;
  agentId: string;
  setAgentId: (v: string) => void;
  soldByStaffId: string;
  setSoldByStaffId: (v: string) => void;
  mealPlans: { code: string; name: string; blurb: string | null }[];
  defaultMealPlanCode: string;
  defaultGuestOrigin: string;
}) {
  const [phoneLater, setPhoneLater] = useState(false);
  /** Agent stays are almost always on credit; walk-in → cash. */
  const [paymentMode, setPaymentMode] = useState("cash");
  /** Local status patches after in-flow promote (directory → approved). */
  const [agentPatches, setAgentPatches] = useState<
    Record<string, BookableAgent>
  >({});

  const handleAgentChange = useCallback(
    (next: string) => {
      setAgentId(next);
      if (next) {
        setPaymentMode("on_credit");
      } else if (paymentMode === "on_credit") {
        setPaymentMode("cash");
      }
    },
    [paymentMode, setAgentId],
  );

  const displayAgents = useMemo(() => {
    return agents.map((a) => agentPatches[a.id] ?? a);
  }, [agents, agentPatches]);

  const extrasFromPromote = useMemo(
    () =>
      Object.values(agentPatches).filter(
        (p) => !agents.some((a) => a.id === p.id),
      ),
    [agentPatches, agents],
  );

  const pickerAgents = useMemo(
    () => [...displayAgents, ...extrasFromPromote],
    [displayAgents, extrasFromPromote],
  );

  const selectedAgent = useMemo(
    () => pickerAgents.find((a) => a.id === agentId) ?? null,
    [pickerAgents, agentId],
  );

  const blockCredit =
    needsCreditPromote(paymentMode, selectedAgent) && Boolean(agentId);

  useAgentCreditEligibilityNotify(paymentMode, selectedAgent, {
    enabled: Boolean(agentId),
  });

  const onPromoted = useCallback((agent: BookableAgent) => {
    setAgentPatches((prev) => ({ ...prev, [agent.id]: agent }));
  }, []);

  return (
    <div className="space-y-6 px-5 py-5 md:px-6 md:py-6">
      {!hasQty ? (
        <Alert variant="warning">
          <AlertDescription>
            Pick a room above to enable saving.
          </AlertDescription>
        </Alert>
      ) : null}

      <fieldset className="space-y-3" disabled={pending}>
        <legend className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Guest contact
        </legend>
        <div className="space-y-1.5">
          <Label htmlFor="contact_name">Guest / lead name</Label>
          <Input
            id="contact_name"
            type="text"
            name="contact_name"
            required
            autoComplete="off"
          />
        </div>
        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="contact_phone">Phone</Label>
            <Input
              id="contact_phone"
              type="tel"
              name="contact_phone"
              required={!phoneLater}
              disabled={phoneLater}
              inputMode="tel"
            />
            <label className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                name="phone_later"
                value="1"
                checked={phoneLater}
                onChange={(e) => setPhoneLater(e.target.checked)}
                className="size-3.5 accent-foreground"
              />
              Phone later — collect before settle
            </label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact_email">Email</Label>
            <Input
              id="contact_email"
              type="email"
              name="contact_email"
              inputMode="email"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" rows={2} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="promo_code">Promo code</Label>
          <Input
            id="promo_code"
            type="text"
            name="promo_code"
            placeholder="Optional · e.g. TIKTOK50"
            className="font-mono uppercase"
            autoComplete="off"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3" disabled={pending}>
        <legend className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Booked by
        </legend>
        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="source">Role</Label>
            <Select name="source" defaultValue="reservation" required>
              <SelectTrigger id="source">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="reservation">Reservation</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="mou_agent">MoU agent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guest_origin">Guest origin</Label>
            <Select
              name="guest_origin"
              defaultValue={defaultGuestOrigin}
              required
            >
              <SelectTrigger id="guest_origin">
                <SelectValue placeholder="Select origin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="international">
                  International tourist
                </SelectItem>
                <SelectItem value="regional">Regional (Indian / etc.)</SelectItem>
                <SelectItem value="official">Official / diplomatic</SelectItem>
                <SelectItem value="local">Local (Bhutanese)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Drives whether a guide is required.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meal_plan_code">Meal plan</Label>
            <Select
              name="meal_plan_code"
              defaultValue={defaultMealPlanCode}
              required
            >
              <SelectTrigger id="meal_plan_code">
                <SelectValue placeholder="Select meal plan" />
              </SelectTrigger>
              <SelectContent>
                {mealPlans.map((plan) => (
                  <SelectItem key={plan.code} value={plan.code}>
                    {plan.code} · {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Agent</Label>
            <AgentPicker
              name="agent_id"
              agents={pickerAgents}
              value={agentId}
              onValueChange={handleAgentChange}
              className="bg-background"
              creditMode
            />
            <p className="text-[11px] text-muted-foreground">
              Agent stays default to on credit. Walk-in clear → cash.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payment_mode">Payment</Label>
            <Select
              name="payment_mode"
              value={paymentMode}
              onValueChange={setPaymentMode}
            >
              <SelectTrigger id="payment_mode">
                <SelectValue placeholder="Select payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="on_credit">On credit</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="prepaid">Prepaid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {blockCredit && selectedAgent ? (
            <CreditAgentPromotePanel
              agent={selectedAgent}
              onPromoted={onPromoted}
              onUseCash={() => {
                setPaymentMode("cash");
                toast.message("Payment set to cash");
              }}
            />
          ) : null}
          {paymentMode === "on_credit" && !agentId ? (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Select an agent for on-credit stays.
            </p>
          ) : null}
          <div className="space-y-1.5">
            <Label>Sold by (staff)</Label>
            <StaffPicker
              name="sold_by_staff_id"
              staff={staff}
              value={soldByStaffId}
              onValueChange={setSoldByStaffId}
              className="bg-background"
            />
            <p className="text-[11px] text-muted-foreground">
              Incentive claim for who brought the guest or agent. Owner/GM
              approves later.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guide_number">Guide number</Label>
            <Input
              id="guide_number"
              type="text"
              name="guide_number"
              placeholder="Required for international tourists"
            />
            <p className="text-[11px] text-muted-foreground">
              Required for international tourists only.
            </p>
          </div>
        </div>
      </fieldset>

      <Button
        type="submit"
        variant="citrus"
        disabled={pending || !hasQty || blockCredit}
        className="h-11 w-full"
      >
        {pending
          ? "Saving…"
          : blockCredit
            ? "Approve trade partner above to save"
            : "Save booking"}
      </Button>
    </div>
  );
}

export function FastBookDrawer({
  agents,
  staff,
  defaultSoldByStaffId = "",
  pending,
  open,
  onClose,
  hasQty,
  mealPlans,
  defaultMealPlanCode,
  defaultGuestOrigin,
}: Props) {
  // Pickers are type-to-search Comboboxes; we mirror values into hidden form fields.
  const [agentId, setAgentId] = useState<string>("");
  const [soldByStaffId, setSoldByStaffId] = useState(defaultSoldByStaffId);

  useEffect(() => {
    setSoldByStaffId(defaultSoldByStaffId);
  }, [defaultSoldByStaffId]);

  // Switch between the desktop rail (static column in the form grid) and the
  // mobile bottom Sheet based on viewport. Only one body is rendered at a
  // time, so form fields are never duplicated in the DOM.
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const body = (
    <DrawerBody
      agents={agents}
      staff={staff}
      pending={pending}
      hasQty={hasQty}
      agentId={agentId}
      setAgentId={setAgentId}
      soldByStaffId={soldByStaffId}
      setSoldByStaffId={setSoldByStaffId}
      mealPlans={mealPlans}
      defaultMealPlanCode={defaultMealPlanCode}
      defaultGuestOrigin={defaultGuestOrigin}
    />
  );

  if (isDesktop) {
    return (
      <aside
        aria-label="Booking details"
        className="erp md:w-[360px] md:flex-shrink-0 md:self-start md:rounded-lg md:border md:bg-card"
      >
        {body}
      </aside>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      {/* portal={false} keeps the fieldset inside the parent <form> so the
          named inputs still submit. Sheet is bottom-anchored on mobile only. */}
      <SheetContent
        side="bottom"
        portal={false}
        className="erp max-h-[85vh] overflow-y-auto p-0 md:hidden"
      >
        <SheetHeader className="border-b">
          <SheetTitle className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Booking details
          </SheetTitle>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  );
}
