import { useEffect, useMemo, useState, useTransition } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Badge,
  Button,
  GlassElevated,
  GlassPanel,
  KpiCard,
  ModuleFrame,
  MorphTabsRoot,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@hos-v2/ui";
import {
  formatNu,
  folioBalance,
  listTourGroups,
  nightsBetween,
  useFrontOfficeStore,
  type GroupMeta,
  type MealPlan,
} from "../lib/front-office-store";

const MEALS: MealPlan[] = ["EP", "CP", "MAP", "AP"];

export function GroupsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const stays = useFrontOfficeStore((s) => s.stays);
  const groupMeta = useFrontOfficeStore((s) => s.groupMeta);
  const openStay = useFrontOfficeStore((s) => s.openStay);
  const checkInGroup = useFrontOfficeStore((s) => s.checkInGroup);
  const applyGroupMealPlan = useFrontOfficeStore((s) => s.applyGroupMealPlan);
  const upsertGroupMeta = useFrontOfficeStore((s) => s.upsertGroupMeta);

  const groups = useMemo(
    () => listTourGroups(stays, groupMeta),
    [stays, groupMeta],
  );

  const [selectedGroupId, setSelectedGroupId] = useState(
    () => searchParams.get("id") ?? groups[0]?.id ?? "grp-001",
  );
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"rooming" | "logistics" | "billing">(
    "rooming",
  );
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [, startTransition] = useTransition();

  const [newGroupName, setNewGroupName] = useState("");
  const [newAgency, setNewAgency] = useState("Yangphel Adventure Travel");
  const [newMealPlan, setNewMealPlan] = useState<MealPlan>("MAP");
  const [newGuide, setNewGuide] = useState("");
  const [newGuideTcr, setNewGuideTcr] = useState("");

  useEffect(() => {
    const q = searchParams.get("id");
    if (q) setSelectedGroupId(q);
  }, [searchParams]);

  useEffect(() => {
    if (!groups.some((g) => g.id === selectedGroupId) && groups[0]) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups, selectedGroupId]);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? groups[0];

  const filteredGroups = groups.filter((g) => {
    if (statusFilter !== "all" && g.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        g.name.toLowerCase().includes(q) ||
        g.agencyName.toLowerCase().includes(q) ||
        g.guideName.toLowerCase().includes(q) ||
        g.code.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalActiveGroups = groups.filter(
    (g) => g.status === "in_house" || g.status === "confirmed",
  ).length;
  const totalGroupPax = groups.reduce(
    (acc, g) => acc + (g.status !== "departed" ? g.totalPax : 0),
    0,
  );
  const totalRoomsSold = groups.reduce(
    (acc, g) => acc + (g.status !== "departed" ? g.roomsBooked : 0),
    0,
  );
  const totalReceivables = groups.reduce((acc, g) => acc + g.masterBalance, 0);

  const handleGroupCheckIn = () => {
    if (!selectedGroup) return;
    startTransition(() => {
      void checkInGroup(selectedGroup.id).then((res) => {
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success(`Checked in ${res.checkedIn} rooms`, {
          description:
            res.blocked.length > 0
              ? res.blocked.slice(0, 2).join(" · ")
              : `Guide ${selectedGroup.guideName} · master folio open`,
        });
      });
    });
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }
    const id = `grp-${crypto.randomUUID().slice(0, 8)}`;
    const meta: GroupMeta = {
      id,
      code: `TG-${Date.now().toString().slice(-4)}`,
      name: newGroupName.trim(),
      agencyName: newAgency,
      agencyContact: "+975-2-321234 · bookings@partner.bt",
      guideName: newGuide || "TBD (Tour Guide)",
      guideLicense: newGuideTcr || "TCR-PENDING",
      guidePhone: "+975-17000000",
      driverName: "Assigned at Gate",
      vehicleNo: "BP-Pending",
      driverDormBed: "Staff Dorm Bed #04",
      mealPlan: newMealPlan,
      depositPaid: 0,
      billingRule: "agency_room_meals",
      color: "#669df6",
    };
    upsertGroupMeta(meta);
    setSelectedGroupId(id);
    setIsNewGroupOpen(false);
    setNewGroupName("");
    toast.success(`Group created: ${meta.name}`, {
      description: "Add rooms via Fast Book with this group, or assign from StayView.",
    });
    navigate(`/groups?id=${id}`);
  };

  return (
    <ModuleFrame
      title="Tour Groups & Delegations"
      description="Live rooming from StayHub · guide logistics · party check-in · master folios"
      actions={
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              toast.info("DRC tourist manifest", {
                description: "Export uses in-house group passports from FO stays.",
              })
            }
            className="text-xs"
          >
            Print Tourist Manifest
          </Button>
          <Button
            size="sm"
            onClick={() => setIsNewGroupOpen(true)}
            className="text-xs font-medium"
          >
            + New Tour Group
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <KpiCard label="Active Groups" value={totalActiveGroups} delta="In-house & confirmed" />
          <KpiCard label="Group Pax" value={totalGroupPax} delta="Approx. 2 / room" />
          <KpiCard label="Group Rooms" value={totalRoomsSold} delta="Live FO stays" />
          <KpiCard
            label="Agency due"
            value={formatNu(totalReceivables)}
            delta="Master balances"
          />
        </div>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[320px_1fr]">
          <GlassPanel className="flex flex-col gap-2.5 p-3">
            <input
              type="search"
              placeholder="Search group, agency, guide…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="hos-input !min-h-10 !rounded-xl !text-[13px]"
            />
            <div className="flex gap-1 overflow-x-auto pb-0.5">
              {(["all", "in_house", "confirmed", "quote", "departed"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                    statusFilter === st
                      ? "bg-[var(--hos-primary)] text-white"
                      : "border border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink-2)]"
                  }`}
                >
                  {st === "all"
                    ? "All"
                    : st === "in_house"
                      ? "In-house"
                      : st.charAt(0).toUpperCase() + st.slice(1)}
                </button>
              ))}
            </div>

            <div className="hos-scrollbar-slim flex max-h-[min(60vh,520px)] flex-col gap-1.5 overflow-y-auto pr-0.5">
              {filteredGroups.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-[var(--hos-ink-3)]">
                  No groups match.
                </p>
              ) : (
                filteredGroups.map((grp) => {
                  const selected = grp.id === selectedGroup?.id;
                  return (
                    <button
                      key={grp.id}
                      type="button"
                      onClick={() => {
                        setSelectedGroupId(grp.id);
                        navigate(`/groups?id=${grp.id}`, { replace: true });
                      }}
                      className={`rounded-2xl border p-3 text-left transition-colors ${
                        selected
                          ? "border-[var(--hos-primary)] bg-[var(--hos-primary-container)] text-[var(--hos-primary-on-container)]"
                          : "border-[var(--hos-line)] bg-[var(--hos-cell)] hover:bg-[color-mix(in_srgb,var(--hos-primary)_6%,var(--hos-cell))]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{ background: grp.color }}
                              aria-hidden
                            />
                            <strong className="truncate text-[13px] font-medium text-[var(--hos-ink)]">
                              {grp.name}
                            </strong>
                          </div>
                          <p className="m-0 mt-0.5 truncate text-[11px] text-[var(--hos-ink-3)]">
                            {grp.agencyName}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--hos-ink)_6%,transparent)] px-2 py-0.5 text-[10px] font-medium capitalize text-[var(--hos-ink-2)]">
                          {grp.status.replace("_", " ")}
                        </span>
                      </div>
                      <div className="mt-2 flex justify-between text-[11px] text-[var(--hos-ink-3)]">
                        <span className="font-mono">
                          {grp.checkIn.slice(5)}→{grp.checkOut.slice(5)}
                        </span>
                        <span className="font-mono font-medium text-[var(--hos-ink)]">
                          {formatNu(grp.masterBalance)}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </GlassPanel>

          {selectedGroup ? (
            <GlassPanel className="flex flex-col gap-3 p-3 sm:p-4">
              <div className="flex flex-col gap-2 border-b border-[var(--hos-line)] pb-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: selectedGroup.color }}
                    />
                    <span className="font-mono text-[11px] font-medium text-[var(--hos-primary)]">
                      {selectedGroup.code}
                    </span>
                    <h2 className="m-0 text-[17px] font-medium text-[var(--hos-ink)]">
                      {selectedGroup.name}
                    </h2>
                  </div>
                  <p className="m-0 mt-1 text-[12px] text-[var(--hos-ink-3)]">
                    {selectedGroup.agencyName} · {selectedGroup.checkIn} →{" "}
                    {selectedGroup.checkOut} ({nightsBetween(selectedGroup.checkIn, selectedGroup.checkOut)}N) ·{" "}
                    <span className="font-medium text-[var(--hos-brass)]">
                      {selectedGroup.mealPlan}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <div className="flex rounded-full border border-[var(--hos-line)] bg-[var(--hos-cell)] p-0.5">
                    {MEALS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          void applyGroupMealPlan(selectedGroup.id, m).then((res) => {
                            if (!res.ok) toast.error(res.error);
                            else
                              toast.success(`Meal → ${m} on ${res.updated} rooms`);
                          });
                        }}
                        className={`rounded-full px-2.5 py-1.5 text-[11px] font-medium ${
                          selectedGroup.mealPlan === m
                            ? "bg-[var(--hos-primary)] text-white"
                            : "text-[var(--hos-ink-2)]"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  {selectedGroup.status !== "in_house" &&
                  selectedGroup.status !== "departed" ? (
                    <Button
                      size="sm"
                      className="!h-9 !rounded-full !px-3 text-[12px]"
                      onClick={handleGroupCheckIn}
                    >
                      Check in group
                    </Button>
                  ) : null}
                </div>
              </div>

              <MorphTabsRoot
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as typeof activeTab)}
                glowId="groupsTabGlow"
              >
                <TabsList className="border border-[var(--hos-line)] bg-[var(--hos-cell)]">
                  <TabsTrigger value="rooming" className="text-xs">
                    Rooming ({selectedGroup.members.length})
                  </TabsTrigger>
                  <TabsTrigger value="logistics" className="text-xs">
                    Guide & driver
                  </TabsTrigger>
                  <TabsTrigger value="billing" className="text-xs">
                    Bills
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="rooming" className="mt-3">
                  <div className="overflow-x-auto rounded-2xl border border-[var(--hos-line)] bg-[var(--hos-cell)]">
                    <table className="w-full text-left text-[12px]">
                      <thead>
                        <tr className="border-b border-[var(--hos-line)] text-[11px] text-[var(--hos-ink-3)]">
                          <th className="px-3 py-2 font-medium">Room</th>
                          <th className="px-3 py-2 font-medium">Guest</th>
                          <th className="px-3 py-2 font-medium">Meal</th>
                          <th className="px-3 py-2 text-right font-medium">Guest due</th>
                          <th className="px-3 py-2 text-right font-medium">Agency</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--hos-line)]">
                        {selectedGroup.members.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-3 py-8 text-center text-[var(--hos-ink-3)]"
                            >
                              No stays linked yet. Fast Book with this group or assign from StayView.
                            </td>
                          </tr>
                        ) : (
                          selectedGroup.members.map((m) => {
                            const personal = folioBalance(m, "personal");
                            const master = folioBalance(m, "master");
                            return (
                              <tr
                                key={m.id}
                                className="cursor-pointer hover:bg-[color-mix(in_srgb,var(--hos-primary)_6%,transparent)]"
                                onClick={() => openStay(m.id)}
                              >
                                <td className="px-3 py-2">
                                  <span className="rounded-md bg-[var(--hos-primary-container)] px-2 py-0.5 font-mono text-[11px] font-medium text-[var(--hos-primary-on-container)]">
                                    {m.roomNumber ?? "—"}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <strong className="font-medium text-[var(--hos-ink)]">
                                    {m.guestName}
                                  </strong>
                                  <span className="mt-0.5 block font-mono text-[10px] text-[var(--hos-ink-3)]">
                                    {m.confirmationNo} · {m.typeCode}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <span className="rounded-full bg-[color-mix(in_srgb,var(--hos-brass)_16%,transparent)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--hos-brass-ink)]">
                                    {m.mealPlan}
                                  </span>
                                </td>
                                <td
                                  className={`px-3 py-2 text-right font-mono tabular-nums ${
                                    personal > 0.5
                                      ? "text-[var(--hos-ruby)]"
                                      : "text-[var(--hos-emerald)]"
                                  }`}
                                >
                                  {formatNu(personal)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--hos-ink)]">
                                  {formatNu(master)}
                                </td>
                                <td className="px-3 py-2 capitalize text-[var(--hos-ink-2)]">
                                  {m.status.replace("_", " ")}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <p className="m-0 mt-2 text-[11px] text-[var(--hos-ink-3)]">
                    Tap a row to open StayHub.
                  </p>
                </TabsContent>

                <TabsContent value="logistics" className="mt-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <GlassElevated className="flex flex-col gap-2 p-3.5">
                      <div className="flex items-center justify-between">
                        <h3 className="m-0 text-[13px] font-medium text-[var(--hos-ink)]">
                          Tour guide
                        </h3>
                        <Badge tone="success" className="text-[10px]">
                          Verified
                        </Badge>
                      </div>
                      <dl className="m-0 space-y-1.5 text-[12px]">
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--hos-ink-3)]">Name</dt>
                          <dd className="m-0 font-medium text-[var(--hos-ink)]">
                            {selectedGroup.guideName}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--hos-ink-3)]">License</dt>
                          <dd className="m-0 font-mono text-[var(--hos-primary)]">
                            {selectedGroup.guideLicense}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--hos-ink-3)]">Phone</dt>
                          <dd className="m-0 text-[var(--hos-ink)]">
                            {selectedGroup.guidePhone}
                          </dd>
                        </div>
                      </dl>
                    </GlassElevated>
                    <GlassElevated className="flex flex-col gap-2 p-3.5">
                      <h3 className="m-0 text-[13px] font-medium text-[var(--hos-ink)]">
                        Driver & vehicle
                      </h3>
                      <dl className="m-0 space-y-1.5 text-[12px]">
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--hos-ink-3)]">Driver</dt>
                          <dd className="m-0 font-medium text-[var(--hos-ink)]">
                            {selectedGroup.driverName}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--hos-ink-3)]">Vehicle</dt>
                          <dd className="m-0 font-mono text-[var(--hos-ink)]">
                            {selectedGroup.vehicleNo}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--hos-ink-3)]">Dorm</dt>
                          <dd className="m-0 text-[var(--hos-brass)]">
                            {selectedGroup.driverDormBed}
                          </dd>
                        </div>
                      </dl>
                    </GlassElevated>
                  </div>
                </TabsContent>

                <TabsContent value="billing" className="mt-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <GlassElevated className="space-y-2 p-3.5">
                      <h3 className="m-0 text-[13px] font-medium text-[var(--hos-ink)]">
                        Agency master
                      </h3>
                      <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
                        Rule: agency pays room + meal plan; guests pay extras.
                      </p>
                      <div className="flex justify-between text-[12px]">
                        <span className="text-[var(--hos-ink-3)]">Charges posted</span>
                        <span className="font-mono text-[var(--hos-ink)]">
                          {formatNu(selectedGroup.masterFolioCharges)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[12px]">
                        <span className="text-[var(--hos-ink-3)]">Meta deposit</span>
                        <span className="font-mono text-[var(--hos-emerald)]">
                          − {formatNu(selectedGroup.depositPaid)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-[var(--hos-line)] pt-2 text-[13px] font-medium">
                        <span className="text-[var(--hos-ink)]">Open master due</span>
                        <span className="font-mono text-[var(--hos-primary)]">
                          {formatNu(selectedGroup.masterBalance)}
                        </span>
                      </div>
                    </GlassElevated>
                    <GlassElevated className="space-y-2 p-3.5">
                      <h3 className="m-0 text-[13px] font-medium text-[var(--hos-ink)]">
                        Guest incidentals
                      </h3>
                      <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
                        Personal streams across all rooms — settle in StayHub before checkout.
                      </p>
                      <div className="flex justify-between border-t border-[var(--hos-line)] pt-2 text-[13px] font-medium">
                        <span>Open guest due</span>
                        <span
                          className={`font-mono ${
                            selectedGroup.personalBalance > 0.5
                              ? "text-[var(--hos-ruby)]"
                              : "text-[var(--hos-emerald)]"
                          }`}
                        >
                          {formatNu(selectedGroup.personalBalance)}
                        </span>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-1 w-full !rounded-full text-[12px]"
                        onClick={() => {
                          const first = selectedGroup.members[0];
                          if (first) openStay(first.id);
                          else toast.message("No member stays yet");
                        }}
                      >
                        Open first stay in StayHub
                      </Button>
                    </GlassElevated>
                  </div>
                </TabsContent>
              </MorphTabsRoot>
            </GlassPanel>
          ) : null}
        </div>

        {isNewGroupOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--hos-ink)_45%,transparent)] p-4 backdrop-blur-sm">
            <GlassElevated className="flex w-full max-w-lg flex-col gap-3 border border-[var(--hos-line)] p-4 shadow-[var(--hos-elevated-shadow)]">
              <div className="flex items-center justify-between border-b border-[var(--hos-line)] pb-2">
                <h3 className="m-0 text-[15px] font-medium text-[var(--hos-ink)]">
                  New tour group
                </h3>
                <button
                  type="button"
                  onClick={() => setIsNewGroupOpen(false)}
                  className="text-[var(--hos-ink-3)]"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleCreateGroup} className="flex flex-col gap-2.5 text-[12px]">
                <label className="space-y-1">
                  <span className="font-medium text-[var(--hos-ink-2)]">Name</span>
                  <input
                    required
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="hos-input !min-h-10"
                    placeholder="e.g. Spring birding · 12 pax"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="font-medium text-[var(--hos-ink-2)]">Agency</span>
                    <select
                      value={newAgency}
                      onChange={(e) => setNewAgency(e.target.value)}
                      className="hos-input !min-h-10"
                    >
                      <option value="Yangphel Adventure Travel">Yangphel</option>
                      <option value="Druk Asia Tours & Treks">Druk Asia</option>
                      <option value="Bhutan Tourism Corp Ltd (BTCL)">BTCL</option>
                      <option value="Royal Thimphu College (Direct MoA)">RTC</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="font-medium text-[var(--hos-ink-2)]">Meal</span>
                    <select
                      value={newMealPlan}
                      onChange={(e) => setNewMealPlan(e.target.value as MealPlan)}
                      className="hos-input !min-h-10"
                    >
                      {MEALS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="font-medium text-[var(--hos-ink-2)]">Guide</span>
                    <input
                      value={newGuide}
                      onChange={(e) => setNewGuide(e.target.value)}
                      className="hos-input !min-h-10"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="font-medium text-[var(--hos-ink-2)]">TCR #</span>
                    <input
                      value={newGuideTcr}
                      onChange={(e) => setNewGuideTcr(e.target.value)}
                      className="hos-input !min-h-10"
                    />
                  </label>
                </div>
                <div className="flex justify-end gap-2 border-t border-[var(--hos-line)] pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsNewGroupOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm">
                    Create group
                  </Button>
                </div>
              </form>
            </GlassElevated>
          </div>
        ) : null}
      </div>
    </ModuleFrame>
  );
}
