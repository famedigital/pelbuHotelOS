"use client";

import {
  deleteStaffConductRecord,
  deleteStaffDocument,
  deleteStaffPayComponent,
  upsertStaffConductRecord,
  upsertStaffDocument,
  upsertStaffMember,
  upsertStaffPayComponent,
  upsertStaffPrivateProfile,
  upsertStaffRolesAccess,
  type HrActionState,
} from "@/app/actions/erp-hr";
import { setStaffPortalPin } from "@/app/actions/staff-auth";
import { CloudinaryPicker } from "@/components/erp/CloudinaryPicker";
import { StaffAvatar } from "@/components/erp/StaffAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  cloudinaryMediaThumbUrl,
  cloudinaryOriginalUrl,
  cloudinaryUrl,
} from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import {
  CheckIcon,
  ExternalLinkIcon,
  KeyRoundIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useActionState,
  useEffect,
  useMemo,
  useState,
} from "react";

const selectClass =
  "flex h-11 w-full min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const STEPS = [
  { id: "profile", label: "Profile" },
  { id: "access", label: "Access" },
  { id: "compensation", label: "Compensation" },
  { id: "documents", label: "Documents" },
  { id: "records", label: "Records" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

export type StaffDossierMember = {
  id: string;
  employeeCode: string;
  fullName: string;
  role: string;
  department: string | null;
  positionTitle: string | null;
  employmentType: string;
  phone: string | null;
  email: string | null;
  status: string;
  hiredOn: string | null;
  probationEndsOn: string | null;
  contractEndsOn: string | null;
  notes: string | null;
  managerId: string | null;
  accessLevel: string;
  deskRole: string | null;
  canAccessDesk: boolean;
  canLogin: boolean;
  pinSetAt: string | null;
  lastLoginAt: string | null;
};

export type StaffPrivateProfile = {
  staffId: string;
  cidNumber: string | null;
  dateOfBirth: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  taxIdentifier: string | null;
  providentFundNumber: string | null;
  baseWageBtn: number | null;
  healthContributionBtn: number | null;
  serviceChargeEligible: boolean;
  serviceChargeShareBtn: number | null;
  photoPublicId: string | null;
  paySchedule: string;
};

export type StaffPayComponentRow = {
  id: string;
  staffId: string;
  kind: string;
  code: string;
  label: string;
  amountBtn: number;
  taxable: boolean;
  isActive: boolean;
};

export type StaffDocumentRow = {
  id: string;
  staffId: string;
  docType: string;
  title: string;
  cloudinaryPublicId: string;
  resourceType: string;
  notes: string | null;
};

export type StaffConductRow = {
  id: string;
  staffId: string;
  kind: string;
  severity: string;
  title: string;
  body: string | null;
  recordedOn: string;
};

export type ManagerOption = {
  id: string;
  fullName: string;
  employeeCode: string;
};

const initialHr: HrActionState = { ok: false };
const pinInitial = {
  ok: false as boolean,
  error: undefined as string | undefined,
  message: undefined as string | undefined,
};

function dash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `Nu ${value.toLocaleString()}`;
}

function titleCase(value: string): string {
  return value.replaceAll("_", " ");
}

function Result({ state }: { state: { ok: boolean; error?: string; message?: string } }) {
  if (!state.error && !state.message) return null;
  return (
    <p
      className={`text-sm ${state.ok ? "text-emerald-700" : "text-destructive"}`}
      role="status"
    >
      {state.message ?? state.error}
    </p>
  );
}

/** Row hover actions: always visible on touch; fade in on md+ hover/focus. */
function RowActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
        className,
      )}
    >
      {children}
    </div>
  );
}

function SectionToolbar({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

function EmptyTableNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function EditPanel({
  title,
  onCancel,
  children,
}: {
  title: string;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 rounded-lg border border-sky-500/25 bg-sky-500/[0.04] p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{title}</h4>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5"
          onClick={onCancel}
        >
          <XIcon className="size-3.5" />
          Cancel
        </Button>
      </div>
      {children}
    </div>
  );
}

function KeyValueTable({
  rows,
  onEdit,
}: {
  rows: { label: string; value: React.ReactNode; mono?: boolean }[];
  onEdit?: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[34%] min-w-[7rem]">Field</TableHead>
            <TableHead>Value</TableHead>
            {onEdit ? <TableHead className="w-16 text-right"> </TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label} className="group">
              <TableCell className="whitespace-normal text-muted-foreground">
                {row.label}
              </TableCell>
              <TableCell
                className={cn(
                  "max-w-[18rem] truncate whitespace-normal sm:max-w-none",
                  row.mono && "font-mono text-xs",
                )}
              >
                {row.value}
              </TableCell>
              {onEdit ? (
                <TableCell className="text-right">
                  <RowActions>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Edit ${row.label}`}
                      onClick={onEdit}
                    >
                      <PencilIcon className="size-3.5" />
                    </Button>
                  </RowActions>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function stepComplete(
  id: StepId,
  member: StaffDossierMember,
  privateProfile: StaffPrivateProfile | null,
  payComponents: StaffPayComponentRow[],
  documents: StaffDocumentRow[],
  conduct: StaffConductRow[],
): boolean {
  switch (id) {
    case "profile":
      return Boolean(member.fullName && member.employeeCode && member.phone);
    case "access":
      return member.canLogin || Boolean(member.pinSetAt);
    case "compensation":
      return privateProfile?.baseWageBtn != null || payComponents.length > 0;
    case "documents":
      return documents.some((d) => d.docType === "pass_photo");
    case "records":
      return conduct.length > 0 || Boolean(member.hiredOn);
    default:
      return false;
  }
}

export function StaffDossierDialog({
  open,
  onOpenChange,
  member,
  privateProfile,
  payComponents,
  documents,
  conduct,
  managers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: StaffDossierMember | null;
  privateProfile: StaffPrivateProfile | null;
  payComponents: StaffPayComponentRow[];
  documents: StaffDocumentRow[];
  conduct: StaffConductRow[];
  managers: ManagerOption[];
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [step, setStep] = useState<StepId>("profile");

  useEffect(() => {
    if (open) setStep("profile");
  }, [open, member?.id]);

  if (!member) return null;

  const photoPublicId = resolveDossierPhotoPublicId(privateProfile, documents);

  const body = (
    <DossierBody
      member={member}
      privateProfile={privateProfile}
      payComponents={payComponents}
      documents={documents}
      conduct={conduct}
      managers={managers}
      step={step}
      setStep={setStep}
    />
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/*
          Override DialogContent defaults (max-w-[calc(100%-2rem)] / sm:max-w-lg).
          sm: max-w must be set at the sm: breakpoint so it wins over sm:max-w-lg.
        */}
        <DialogContent
          className={cn(
            "erp flex flex-col gap-0 overflow-hidden p-0",
            "h-[min(900px,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)]",
            "w-[calc(100vw-2rem)] max-w-[min(1200px,calc(100vw-2rem))]",
            "sm:max-w-[min(1200px,calc(100vw-2rem))]",
          )}
        >
          <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
            <div className="flex items-start gap-3">
              <StaffAvatar
                name={member.fullName}
                publicId={photoPublicId}
                size="lg"
              />
              <div className="min-w-0">
                <DialogTitle className="text-xl leading-tight">
                  {member.fullName}
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                    <span className="font-mono text-xs">{member.employeeCode}</span>
                    <span aria-hidden>·</span>
                    <span>{member.positionTitle ?? titleCase(member.role)}</span>
                    <Badge variant="outline" className="capitalize">
                      {titleCase(member.status)}
                    </Badge>
                  </div>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "erp flex w-full flex-col gap-0 overflow-hidden rounded-t-2xl p-0",
          /* Override bottom sheet h-auto / max-h-[90vh] defaults */
          "h-[95dvh] max-h-[95dvh]",
        )}
      >
        <SheetHeader className="shrink-0 border-b px-4 py-4 text-left">
          <div className="flex items-start gap-3">
            <StaffAvatar
              name={member.fullName}
              publicId={photoPublicId}
              size="md"
            />
            <div className="min-w-0">
              <SheetTitle className="text-lg leading-tight">
                {member.fullName}
              </SheetTitle>
              <SheetDescription asChild>
                <div className="mt-1 text-sm text-muted-foreground">
                  <span className="font-mono text-xs">{member.employeeCode}</span>
                  {" · "}
                  {titleCase(member.role)}
                </div>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  );
}

/** Prefer profile photo_public_id, else latest pass_photo document. */
export function resolveDossierPhotoPublicId(
  privateProfile: StaffPrivateProfile | null | undefined,
  documents: StaffDocumentRow[],
): string | null {
  if (privateProfile?.photoPublicId) return privateProfile.photoPublicId;
  const pass = documents.find((row) => row.docType === "pass_photo");
  return pass?.cloudinaryPublicId ?? null;
}

function DossierBody({
  member,
  privateProfile,
  payComponents,
  documents,
  conduct,
  managers,
  step,
  setStep,
}: {
  member: StaffDossierMember;
  privateProfile: StaffPrivateProfile | null;
  payComponents: StaffPayComponentRow[];
  documents: StaffDocumentRow[];
  conduct: StaffConductRow[];
  managers: ManagerOption[];
  step: StepId;
  setStep: (step: StepId) => void;
}) {
  const completion = useMemo(() => {
    const map = {} as Record<StepId, boolean>;
    for (const s of STEPS) {
      map[s.id] = stepComplete(
        s.id,
        member,
        privateProfile,
        payComponents,
        documents,
        conduct,
      );
    }
    return map;
  }, [member, privateProfile, payComponents, documents, conduct]);

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      {/* Mobile: horizontal chips */}
      <nav
        className="shrink-0 overflow-x-auto border-b px-3 py-2 md:hidden"
        aria-label="Dossier sections"
      >
        <div className="flex min-w-max gap-1.5">
          {STEPS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStep(item.id)}
              className={cn(
                "inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm whitespace-nowrap transition-colors",
                step === item.id
                  ? "bg-sky-600 text-white"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted",
              )}
            >
              {completion[item.id] ? (
                <CheckIcon className="size-3.5 shrink-0 opacity-90" aria-hidden />
              ) : null}
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* md+: left vertical rail stays put while right pane scrolls */}
      <nav
        className="hidden w-48 shrink-0 self-stretch flex-col border-r bg-muted/20 md:flex lg:w-52"
        aria-label="Dossier sections"
      >
        <div className="sticky top-0 flex flex-col gap-0.5 p-2">
          <p className="px-2.5 py-2 text-[10px] font-semibold tracking-[0.14em] text-sky-700 uppercase">
            Sections
          </p>
          {STEPS.map((item) => {
            const active = step === item.id;
            const done = completion[item.id];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setStep(item.id)}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-md px-2.5 text-left text-sm transition-colors",
                  active
                    ? "bg-sky-600 text-white shadow-sm"
                    : "text-foreground/80 hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                    active
                      ? "border-white/40 bg-white/15"
                      : done
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                        : "border-muted-foreground/25 text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {done ? <CheckIcon className="size-3" /> : null}
                </span>
                <span className="truncate font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-4 md:px-6">
        {step === "profile" ? (
          <ProfileStep member={member} managers={managers} />
        ) : null}
        {step === "access" ? <AccessStep member={member} /> : null}
        {step === "compensation" ? (
          <CompensationStep
            member={member}
            privateProfile={privateProfile}
            payComponents={payComponents}
          />
        ) : null}
        {step === "documents" ? (
          <DocumentsStep
            member={member}
            documents={documents}
            privateProfile={privateProfile}
          />
        ) : null}
        {step === "records" ? (
          <RecordsStep member={member} conduct={conduct} />
        ) : null}
      </div>
    </div>
  );
}

/* ─── Profile ─────────────────────────────────────────────────────────── */

function ProfileStep({
  member,
  managers,
}: {
  member: StaffDossierMember;
  managers: ManagerOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(upsertStaffMember, initialHr);
  useActionToast(state, { successMessage: "Profile saved" });
  useEffect(() => {
    if (state.ok) {
      setEditing(false);
      router.refresh();
    }
  }, [state.ok, router]);

  const managerLabel =
    managers.find((m) => m.id === member.managerId)?.fullName ??
    (member.managerId ? "—" : "— none —");

  const rows = [
    { label: "Employee code", value: member.employeeCode, mono: true },
    { label: "Full name", value: member.fullName },
    { label: "Operational role", value: titleCase(member.role) },
    { label: "Department", value: dash(member.department) },
    { label: "Position", value: dash(member.positionTitle) },
    { label: "Employment", value: titleCase(member.employmentType) },
    {
      label: "Status",
      value: (
        <Badge variant="outline" className="capitalize">
          {titleCase(member.status)}
        </Badge>
      ),
    },
    { label: "Phone", value: dash(member.phone) },
    { label: "Email", value: dash(member.email) },
    { label: "Hired on", value: dash(member.hiredOn) },
    { label: "Probation ends", value: dash(member.probationEndsOn) },
    { label: "Contract ends", value: dash(member.contractEndsOn) },
    { label: "Reports to", value: managerLabel },
    {
      label: "Notes",
      value: member.notes ? (
        <span className="line-clamp-3 whitespace-pre-wrap">{member.notes}</span>
      ) : (
        "—"
      ),
    },
  ];

  return (
    <div>
      <SectionToolbar
        title="Profile"
        description="Identity and employment details"
      >
        {!editing ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => setEditing(true)}
          >
            <PencilIcon className="size-3.5" />
            Edit
          </Button>
        ) : null}
      </SectionToolbar>

      {editing ? (
        <EditPanel title="Edit profile" onCancel={() => setEditing(false)}>
          <form action={action} className="space-y-3">
            <input type="hidden" name="id" value={member.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Employee code" htmlFor="d_employee_code">
                <Input
                  id="d_employee_code"
                  name="employee_code"
                  defaultValue={member.employeeCode}
                  required
                  className="h-11"
                />
              </Field>
              <Field label="Full name" htmlFor="d_full_name">
                <Input
                  id="d_full_name"
                  name="full_name"
                  defaultValue={member.fullName}
                  required
                  className="h-11"
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Operational role" htmlFor="d_role">
                <select
                  id="d_role"
                  name="role_label"
                  defaultValue={member.role}
                  className={selectClass}
                >
                  <RoleOptions />
                </select>
              </Field>
              <Field label="Department" htmlFor="d_department">
                <Input
                  id="d_department"
                  name="department"
                  defaultValue={member.department ?? ""}
                  className="h-11"
                />
              </Field>
              <Field label="Position" htmlFor="d_position">
                <Input
                  id="d_position"
                  name="position_title"
                  defaultValue={member.positionTitle ?? ""}
                  className="h-11"
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Employment" htmlFor="d_employment">
                <select
                  id="d_employment"
                  name="employment_type"
                  defaultValue={member.employmentType}
                  className={selectClass}
                >
                  <option value="full_time">Full-time</option>
                  <option value="part_time">Part-time</option>
                  <option value="casual">Casual</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </select>
              </Field>
              <Field label="Status" htmlFor="d_status">
                <select
                  id="d_status"
                  name="status"
                  defaultValue={member.status}
                  className={selectClass}
                >
                  <option value="active">Active</option>
                  <option value="on_leave">On leave</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                  <option value="terminated">Terminated</option>
                </select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Phone" htmlFor="d_phone">
                <Input
                  id="d_phone"
                  name="phone"
                  type="tel"
                  defaultValue={member.phone ?? ""}
                  className="h-11"
                />
              </Field>
              <Field label="Email" htmlFor="d_email">
                <Input
                  id="d_email"
                  name="email"
                  type="email"
                  defaultValue={member.email ?? ""}
                  className="h-11"
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Hired on" htmlFor="d_hired">
                <Input
                  id="d_hired"
                  name="hired_on"
                  type="date"
                  defaultValue={member.hiredOn ?? ""}
                  className="h-11"
                />
              </Field>
              <Field label="Probation ends" htmlFor="d_probation">
                <Input
                  id="d_probation"
                  name="probation_ends_on"
                  type="date"
                  defaultValue={member.probationEndsOn ?? ""}
                  className="h-11"
                />
              </Field>
              <Field label="Contract ends" htmlFor="d_contract">
                <Input
                  id="d_contract"
                  name="contract_ends_on"
                  type="date"
                  defaultValue={member.contractEndsOn ?? ""}
                  className="h-11"
                />
              </Field>
            </div>
            <Field label="Reports to" htmlFor="d_manager">
              <select
                id="d_manager"
                name="manager_id"
                defaultValue={member.managerId ?? ""}
                className={selectClass}
              >
                <option value="">— none —</option>
                {managers
                  .filter((m) => m.id !== member.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.employeeCode} · {m.fullName}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Notes" htmlFor="d_notes">
              <Textarea
                id="d_notes"
                name="notes"
                rows={3}
                defaultValue={member.notes ?? ""}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Result state={state} />
              <Button
                type="submit"
                variant="citrus"
                className="h-11 min-w-[8rem]"
                disabled={pending}
              >
                {pending ? "Saving…" : "Save profile"}
              </Button>
            </div>
          </form>
        </EditPanel>
      ) : (
        <KeyValueTable rows={rows} onEdit={() => setEditing(true)} />
      )}
    </div>
  );
}

/* ─── Access ──────────────────────────────────────────────────────────── */

function AccessStep({ member }: { member: StaffDossierMember }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [resetPin, setResetPin] = useState(false);
  const [accessState, accessAction, accessPending] = useActionState(
    upsertStaffRolesAccess,
    initialHr,
  );
  const [pinState, pinAction, pinPending] = useActionState(setStaffPortalPin, pinInitial);
  useActionToast(accessState, { successMessage: "Access saved" });
  useActionToast(pinState, { successMessage: "PIN saved" });
  useEffect(() => {
    if (accessState.ok) {
      setEditing(false);
      router.refresh();
    }
  }, [accessState.ok, router]);
  useEffect(() => {
    if (pinState.ok) {
      setResetPin(false);
      router.refresh();
    }
  }, [pinState.ok, router]);

  const rows = [
    { label: "Operational role", value: titleCase(member.role) },
    { label: "HR access level", value: titleCase(member.accessLevel) },
    {
      label: "Hotel desk (/erp)",
      value: (
        <Badge variant={member.canAccessDesk ? "default" : "outline"}>
          {member.canAccessDesk ? "on" : "off"}
        </Badge>
      ),
    },
    {
      label: "Desk RBAC role",
      value: member.deskRole ? titleCase(member.deskRole) : "—",
    },
    {
      label: "Staff app portal",
      value: (
        <Badge variant={member.canLogin ? "default" : "outline"}>
          {member.canLogin ? "ready" : "off"}
        </Badge>
      ),
    },
    {
      label: "PIN status",
      value: member.pinSetAt ? `Set ${member.pinSetAt.slice(0, 10)}` : "Not set",
    },
    {
      label: "Last login",
      value: member.lastLoginAt ? member.lastLoginAt.slice(0, 10) : "—",
    },
  ];

  return (
    <div>
      <SectionToolbar
        title="Access"
        description="Roles, desk dual-auth, and portal PIN"
      >
        {!editing && !resetPin ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => {
                setResetPin(false);
                setEditing(true);
              }}
            >
              <PencilIcon className="size-3.5" />
              Edit access
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => {
                setEditing(false);
                setResetPin(true);
              }}
            >
              <KeyRoundIcon className="size-3.5" />
              Reset PIN
            </Button>
          </>
        ) : null}
      </SectionToolbar>

      {editing ? (
        <EditPanel
          title="Edit access"
          onCancel={() => setEditing(false)}
        >
          <form action={accessAction} className="space-y-3">
            <input type="hidden" name="staff_id" value={member.id} />
            <Field label="Operational role" htmlFor="a_role">
              <select
                id="a_role"
                name="role_label"
                defaultValue={member.role}
                className={selectClass}
              >
                <RoleOptions />
              </select>
            </Field>
            <Field label="HR access level" htmlFor="a_access">
              <select
                id="a_access"
                name="access_level"
                defaultValue={member.accessLevel}
                className={selectClass}
              >
                <option value="employee">Employee</option>
                <option value="supervisor">Supervisor</option>
                <option value="hr_admin">HR admin</option>
                <option value="payroll_admin">Payroll admin</option>
                <option value="owner">Owner</option>
              </select>
            </Field>
            <label className="flex min-h-11 items-start gap-3 rounded-md border bg-background px-3 py-3 text-sm">
              <input
                type="checkbox"
                name="can_access_desk"
                defaultChecked={member.canAccessDesk}
                className="mt-1 size-4 rounded border"
              />
              <span>
                <span className="font-medium">Allow hotel desk (/erp)</span>
                <span className="mt-1 block text-muted-foreground">
                  Employee-code + PIN dual-auth. Shared DESK_PIN still works.
                </span>
              </span>
            </label>
            <Field label="Desk RBAC role" htmlFor="a_desk_role">
              <select
                id="a_desk_role"
                name="desk_role"
                defaultValue={member.deskRole ?? ""}
                className={selectClass}
              >
                <option value="">— none —</option>
                <option value="front_desk">Front desk</option>
                <option value="cashier">Cashier</option>
                <option value="gm">GM</option>
                <option value="hk">Housekeeping</option>
                <option value="owner">Owner</option>
              </select>
            </Field>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Result state={accessState} />
              <Button
                type="submit"
                variant="citrus"
                className="h-11 min-w-[8rem]"
                disabled={accessPending}
              >
                {accessPending ? "Saving…" : "Save access"}
              </Button>
            </div>
          </form>
        </EditPanel>
      ) : null}

      {resetPin ? (
        <EditPanel title="Reset portal PIN" onCancel={() => setResetPin(false)}>
          <form action={pinAction} className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Auth remains employee code + PIN. PINs live only in Supabase Auth.
            </p>
            <input type="hidden" name="staff_id" value={member.id} />
            <input
              type="hidden"
              name="can_access_desk"
              value={member.canAccessDesk ? "on" : ""}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="New PIN (4–8 digits)" htmlFor="pin_new">
                <Input
                  id="pin_new"
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  minLength={4}
                  maxLength={8}
                  required
                  className="h-11"
                />
              </Field>
              <Field label="Confirm PIN" htmlFor="pin_confirm">
                <Input
                  id="pin_confirm"
                  name="confirm_pin"
                  type="password"
                  inputMode="numeric"
                  minLength={4}
                  maxLength={8}
                  required
                  className="h-11"
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Result state={pinState} />
              <Button
                type="submit"
                variant="outline"
                className="h-11 min-w-[8rem]"
                disabled={pinPending}
              >
                {pinPending ? "Saving…" : "Set PIN"}
              </Button>
            </div>
          </form>
        </EditPanel>
      ) : null}

      {!editing && !resetPin ? (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[34%]">Field</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="w-24 text-right"> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.label} className="group">
                  <TableCell className="text-muted-foreground">{row.label}</TableCell>
                  <TableCell className="whitespace-normal">{row.value}</TableCell>
                  <TableCell className="text-right">
                    <RowActions>
                      {row.label === "PIN status" || row.label === "Staff app portal" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 px-2 text-xs"
                          onClick={() => setResetPin(true)}
                        >
                          <KeyRoundIcon className="size-3.5" />
                          Reset PIN
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={`Edit ${row.label}`}
                          onClick={() => setEditing(true)}
                        >
                          <PencilIcon className="size-3.5" />
                        </Button>
                      )}
                    </RowActions>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}

/* ─── Compensation ────────────────────────────────────────────────────── */

function CompensationStep({
  member,
  privateProfile,
  payComponents,
}: {
  member: StaffDossierMember;
  privateProfile: StaffPrivateProfile | null;
  payComponents: StaffPayComponentRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [profileState, profileAction, profilePending] = useActionState(
    upsertStaffPrivateProfile,
    initialHr,
  );
  const [compState, compAction, compPending] = useActionState(
    upsertStaffPayComponent,
    initialHr,
  );
  const [delState, delAction] = useActionState(deleteStaffPayComponent, initialHr);
  useActionToast(profileState, { successMessage: "Compensation saved" });
  useActionToast(compState, { successMessage: "Allowance saved" });
  useActionToast(delState, { successMessage: "Component removed" });
  useEffect(() => {
    if (profileState.ok) {
      setEditing(false);
      router.refresh();
    }
  }, [profileState.ok, router]);
  useEffect(() => {
    if (compState.ok) {
      setAdding(false);
      router.refresh();
    }
  }, [compState.ok, router]);
  useEffect(() => {
    if (delState.ok) router.refresh();
  }, [delState.ok, router]);

  const payRows = [
    { label: "Base wage", value: money(privateProfile?.baseWageBtn) },
    {
      label: "Pay schedule",
      value: titleCase(privateProfile?.paySchedule ?? "monthly"),
    },
    {
      label: "Health contribution (HC)",
      value: money(privateProfile?.healthContributionBtn),
    },
    {
      label: "Service charge eligible",
      value: privateProfile?.serviceChargeEligible ? "Yes" : "No",
    },
    {
      label: "SC fixed share",
      value: money(privateProfile?.serviceChargeShareBtn),
    },
    { label: "PF number", value: dash(privateProfile?.providentFundNumber) },
    { label: "Tax ID", value: dash(privateProfile?.taxIdentifier) },
    { label: "Bank name", value: dash(privateProfile?.bankName) },
    {
      label: "Account number",
      value: dash(privateProfile?.bankAccountNumber),
      mono: true,
    },
    { label: "CID number", value: dash(privateProfile?.cidNumber), mono: true },
    { label: "Date of birth", value: dash(privateProfile?.dateOfBirth) },
    {
      label: "Address",
      value: privateProfile?.address ? (
        <span className="line-clamp-2 whitespace-pre-wrap">{privateProfile.address}</span>
      ) : (
        "—"
      ),
    },
    {
      label: "Emergency contact",
      value: dash(privateProfile?.emergencyContactName),
    },
    {
      label: "Emergency phone",
      value: dash(privateProfile?.emergencyContactPhone),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <SectionToolbar
          title="Compensation & private file"
          description="Wage, PF, HC/SC, bank — money-desk sensitive"
        >
          {!editing ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => setEditing(true)}
            >
              <PencilIcon className="size-3.5" />
              Edit
            </Button>
          ) : null}
        </SectionToolbar>

        {editing ? (
          <EditPanel
            title="Edit compensation"
            onCancel={() => setEditing(false)}
          >
            <form action={profileAction} className="space-y-3">
              <input type="hidden" name="staff_id" value={member.id} />
              <input
                type="hidden"
                name="photo_public_id"
                value={privateProfile?.photoPublicId ?? ""}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Base wage (Nu)" htmlFor="c_wage">
                  <Input
                    id="c_wage"
                    name="base_wage_btn"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={privateProfile?.baseWageBtn ?? ""}
                    className="h-11"
                  />
                </Field>
                <Field label="Pay schedule" htmlFor="c_schedule">
                  <select
                    id="c_schedule"
                    name="pay_schedule"
                    defaultValue={privateProfile?.paySchedule ?? "monthly"}
                    className={selectClass}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="fortnightly">Fortnightly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Health contribution HC (Nu)" htmlFor="c_hc">
                  <Input
                    id="c_hc"
                    name="health_contribution_btn"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={privateProfile?.healthContributionBtn ?? ""}
                    className="h-11"
                  />
                </Field>
                <Field label="SC fixed share (Nu)" htmlFor="c_sc_share">
                  <Input
                    id="c_sc_share"
                    name="service_charge_share_btn"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={privateProfile?.serviceChargeShareBtn ?? ""}
                    className="h-11"
                  />
                </Field>
              </div>
              <label className="flex min-h-11 items-start gap-3 rounded-md border bg-background px-3 py-3 text-sm">
                <input
                  type="checkbox"
                  name="service_charge_eligible"
                  defaultChecked={privateProfile?.serviceChargeEligible ?? false}
                  className="mt-1 size-4 rounded border"
                />
                <span>
                  <span className="font-medium">Service-charge eligible (SC)</span>
                  <span className="mt-1 block text-muted-foreground">
                    Include in SC distribution; optional fixed share above.
                  </span>
                </span>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="PF number" htmlFor="c_pf">
                  <Input
                    id="c_pf"
                    name="provident_fund_number"
                    defaultValue={privateProfile?.providentFundNumber ?? ""}
                    className="h-11"
                  />
                </Field>
                <Field label="Tax ID" htmlFor="c_tax">
                  <Input
                    id="c_tax"
                    name="tax_identifier"
                    defaultValue={privateProfile?.taxIdentifier ?? ""}
                    className="h-11"
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Bank name" htmlFor="c_bank">
                  <Input
                    id="c_bank"
                    name="bank_name"
                    defaultValue={privateProfile?.bankName ?? ""}
                    className="h-11"
                  />
                </Field>
                <Field label="Account number" htmlFor="c_acct">
                  <Input
                    id="c_acct"
                    name="bank_account_number"
                    defaultValue={privateProfile?.bankAccountNumber ?? ""}
                    className="h-11"
                  />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="CID number" htmlFor="c_cid">
                  <Input
                    id="c_cid"
                    name="cid_number"
                    defaultValue={privateProfile?.cidNumber ?? ""}
                    className="h-11"
                  />
                </Field>
                <Field label="Date of birth" htmlFor="c_dob">
                  <Input
                    id="c_dob"
                    name="date_of_birth"
                    type="date"
                    defaultValue={privateProfile?.dateOfBirth ?? ""}
                    className="h-11"
                  />
                </Field>
              </div>
              <Field label="Address" htmlFor="c_address">
                <Textarea
                  id="c_address"
                  name="address"
                  rows={2}
                  defaultValue={privateProfile?.address ?? ""}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Emergency contact" htmlFor="c_ec_name">
                  <Input
                    id="c_ec_name"
                    name="emergency_contact_name"
                    defaultValue={privateProfile?.emergencyContactName ?? ""}
                    className="h-11"
                  />
                </Field>
                <Field label="Emergency phone" htmlFor="c_ec_phone">
                  <Input
                    id="c_ec_phone"
                    name="emergency_contact_phone"
                    defaultValue={privateProfile?.emergencyContactPhone ?? ""}
                    className="h-11"
                  />
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Result state={profileState} />
                <Button
                  type="submit"
                  variant="citrus"
                  className="h-11 min-w-[8rem]"
                  disabled={profilePending}
                >
                  {profilePending ? "Saving…" : "Save compensation"}
                </Button>
              </div>
            </form>
          </EditPanel>
        ) : (
          <KeyValueTable rows={payRows} onEdit={() => setEditing(true)} />
        )}
      </div>

      <div>
        <SectionToolbar
          title="Recurring allowances"
          description="Earnings and deductions applied each pay cycle"
        >
          {!adding ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => setAdding(true)}
            >
              <PlusIcon className="size-3.5" />
              Add
            </Button>
          ) : null}
        </SectionToolbar>

        {adding ? (
          <EditPanel title="Add pay component" onCancel={() => setAdding(false)}>
            <form action={compAction} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="staff_id" value={member.id} />
              <Field label="Kind" htmlFor="pc_kind">
                <select
                  id="pc_kind"
                  name="kind"
                  className={selectClass}
                  defaultValue="earning"
                >
                  <option value="earning">Earning</option>
                  <option value="deduction">Deduction</option>
                </select>
              </Field>
              <Field label="Code" htmlFor="pc_code">
                <Input
                  id="pc_code"
                  name="code"
                  required
                  className="h-11"
                  placeholder="HRA"
                />
              </Field>
              <Field label="Label" htmlFor="pc_label">
                <Input id="pc_label" name="label" required className="h-11" />
              </Field>
              <Field label="Amount Nu" htmlFor="pc_amount">
                <Input
                  id="pc_amount"
                  name="amount_btn"
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  className="h-11"
                />
              </Field>
              <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  name="taxable"
                  defaultChecked
                  className="size-4 rounded border"
                />
                Taxable
              </label>
              <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                <Result state={compState} />
                <Button
                  type="submit"
                  variant="outline"
                  className="h-11"
                  disabled={compPending}
                >
                  {compPending ? "Adding…" : "Add component"}
                </Button>
              </div>
            </form>
          </EditPanel>
        ) : null}

        {payComponents.length === 0 ? (
          <EmptyTableNote>No active pay components.</EmptyTableNote>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Code</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Taxable</TableHead>
                  <TableHead className="w-14 text-right"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payComponents.map((row) => (
                  <TableRow key={row.id} className="group">
                    <TableCell className="font-mono text-xs">{row.code}</TableCell>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className="capitalize">{row.kind}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(row.amountBtn)}
                    </TableCell>
                    <TableCell>{row.taxable ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-right">
                      <RowActions>
                        <form action={delAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="staff_id" value={member.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            aria-label={`Remove ${row.label}`}
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        </form>
                      </RowActions>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <Result state={delState} />
      </div>
    </div>
  );
}

/* ─── Documents ───────────────────────────────────────────────────────── */

const DOC_SLOT_DEFAULTS: Record<string, string> = {
  pass_photo: "Pass photo",
  cv: "CV",
  cid: "CID",
  other_id: "Other ID",
  other: "Document",
};

type DocSlotId = "pass_photo" | "cv" | "cid";

type DocPickerTarget = {
  docType: string;
  replaceId?: string;
  acceptPdf: boolean;
  /** Quick slots auto-save on pick; manual form only fills fields. */
  mode: "quick" | "form";
};

function documentOpenUrl(doc: StaffDocumentRow): string | null {
  if (
    doc.docType === "cv" ||
    doc.resourceType === "raw" ||
    doc.cloudinaryPublicId.toLowerCase().includes(".pdf") ||
    doc.title.toLowerCase().includes("pdf")
  ) {
    return cloudinaryOriginalUrl(doc.cloudinaryPublicId, "pdf");
  }
  if (doc.resourceType === "image") {
    return cloudinaryUrl(doc.cloudinaryPublicId, { width: 1600, crop: "limit" });
  }
  return (
    cloudinaryOriginalUrl(doc.cloudinaryPublicId) ??
    cloudinaryUrl(doc.cloudinaryPublicId)
  );
}

function DocumentsStep({
  member,
  documents,
  privateProfile,
}: {
  member: StaffDossierMember;
  documents: StaffDocumentRow[];
  privateProfile: StaffPrivateProfile | null;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [state, action, pending] = useActionState(upsertStaffDocument, initialHr);
  const [delState, delAction] = useActionState(deleteStaffDocument, initialHr);
  const [picker, setPicker] = useState<DocPickerTarget | null>(null);
  const [publicId, setPublicId] = useState("");
  const [resourceType, setResourceType] = useState("image");
  const [formDocType, setFormDocType] = useState("other");
  useActionToast(state, { successMessage: "Document saved" });
  useActionToast(delState, { successMessage: "Document removed" });
  useEffect(() => {
    if (state.ok) {
      setAdding(false);
      setPublicId("");
      setPicker(null);
      router.refresh();
    }
  }, [state.ok, router]);
  useEffect(() => {
    if (delState.ok) router.refresh();
  }, [delState.ok, router]);

  const byType = useMemo(() => {
    const map = new Map<string, StaffDocumentRow>();
    for (const doc of documents) {
      if (!map.has(doc.docType)) map.set(doc.docType, doc);
    }
    return map;
  }, [documents]);

  const passDoc = byType.get("pass_photo") ?? null;
  const cvDoc = byType.get("cv") ?? null;
  const cidDoc = byType.get("cid") ?? null;
  const photoPublicId =
    privateProfile?.photoPublicId ?? passDoc?.cloudinaryPublicId ?? null;

  function saveQuick(docType: string, cloudinaryId: string, resType: string, replaceId?: string) {
    const fd = new FormData();
    fd.set("staff_id", member.id);
    fd.set("doc_type", docType);
    fd.set("cloudinary_public_id", cloudinaryId);
    fd.set("resource_type", resType);
    fd.set("title", DOC_SLOT_DEFAULTS[docType] ?? "Document");
    if (replaceId) fd.set("id", replaceId);
    startTransition(() => {
      action(fd);
    });
  }

  function openQuickSlot(docType: DocSlotId, existing: StaffDocumentRow | null) {
    setPicker({
      docType,
      replaceId: existing?.id,
      acceptPdf: docType !== "pass_photo",
      mode: "quick",
    });
  }

  const slots: {
    id: DocSlotId;
    label: string;
    hint: string;
    doc: StaffDocumentRow | null;
    acceptPdf: boolean;
  }[] = [
    {
      id: "pass_photo",
      label: "Pass photo",
      hint: "Shown in staff directory",
      doc: passDoc,
      acceptPdf: false,
    },
    {
      id: "cv",
      label: "CV",
      hint: "PDF or image",
      doc: cvDoc,
      acceptPdf: true,
    },
    {
      id: "cid",
      label: "CID / ID",
      hint: "National ID scan",
      doc: cidDoc,
      acceptPdf: true,
    },
  ];

  return (
    <div className="space-y-5">
      <SectionToolbar
        title="Documents"
        description="Pass photo feeds the directory. CV and CID stay on the personnel file."
      >
        {!adding ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => {
              setFormDocType("other");
              setPublicId("");
              setAdding(true);
            }}
          >
            <PlusIcon className="size-3.5" />
            Other file
          </Button>
        ) : null}
      </SectionToolbar>

      <div className="grid gap-3 sm:grid-cols-3">
        {slots.map((slot) => {
          const openUrl = slot.doc ? documentOpenUrl(slot.doc) : null;
          const onFile = Boolean(slot.doc);
          return (
            <div
              key={slot.id}
              className="flex flex-col gap-3 rounded-lg border bg-card p-3"
            >
              <div className="flex items-start gap-3">
                {slot.id === "pass_photo" ? (
                  <StaffAvatar
                    name={member.fullName}
                    publicId={photoPublicId}
                    size="lg"
                  />
                ) : slot.doc?.resourceType === "image" &&
                  cloudinaryMediaThumbUrl(slot.doc.cloudinaryPublicId, "image") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      cloudinaryMediaThumbUrl(
                        slot.doc.cloudinaryPublicId,
                        "image",
                        { width: 112, height: 112, crop: "fill" },
                      ) ?? undefined
                    }
                    alt=""
                    className="size-14 shrink-0 rounded-md object-cover ring-1 ring-border"
                  />
                ) : (
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-medium tracking-wide text-muted-foreground uppercase ring-1 ring-border">
                    {onFile ? "File" : "—"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{slot.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{slot.hint}</p>
                  <p
                    className={cn(
                      "mt-1 text-xs font-medium",
                      onFile ? "text-emerald-700" : "text-muted-foreground",
                    )}
                  >
                    {onFile ? "On file" : "Missing"}
                  </p>
                </div>
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={onFile ? "outline" : "citrus"}
                  size="sm"
                  className="h-10 min-w-[6.5rem] flex-1"
                  disabled={pending}
                  onClick={() => openQuickSlot(slot.id, slot.doc)}
                >
                  {pending && picker?.docType === slot.id
                    ? "Saving…"
                    : onFile
                      ? "Replace"
                      : "Upload"}
                </Button>
                {openUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-10"
                    asChild
                  >
                    <a
                      href={openUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open
                    </a>
                  </Button>
                ) : null}
                {slot.doc ? (
                  <form action={delAction}>
                    <input type="hidden" name="id" value={slot.doc.id} />
                    <input type="hidden" name="staff_id" value={member.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="h-10 text-destructive hover:text-destructive"
                    >
                      Remove
                    </Button>
                  </form>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <Result state={state} />
      <Result state={delState} />

      {adding ? (
        <EditPanel title="Upload other document" onCancel={() => setAdding(false)}>
          <form action={action} className="space-y-3">
            <input type="hidden" name="staff_id" value={member.id} />
            <input type="hidden" name="cloudinary_public_id" value={publicId} />
            <input type="hidden" name="resource_type" value={resourceType} />
            <Field label="Document type" htmlFor="doc_type">
              <select
                id="doc_type"
                name="doc_type"
                className={selectClass}
                value={formDocType}
                onChange={(e) => setFormDocType(e.target.value)}
              >
                <option value="other_id">Other ID</option>
                <option value="other">Other</option>
                <option value="cid">CID (additional)</option>
                <option value="cv">CV (replace)</option>
                <option value="pass_photo">Pass photo (replace)</option>
              </select>
            </Field>
            <Field label="Title" htmlFor="doc_title">
              <Input
                key={formDocType}
                id="doc_title"
                name="title"
                className="h-11"
                placeholder={DOC_SLOT_DEFAULTS[formDocType] ?? "Document"}
                defaultValue={DOC_SLOT_DEFAULTS[formDocType] ?? ""}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() =>
                  setPicker({
                    docType: formDocType,
                    acceptPdf: formDocType !== "pass_photo",
                    mode: "form",
                  })
                }
              >
                {publicId ? "Change file" : "Upload file"}
              </Button>
              {publicId ? (
                <span className="max-w-[14rem] truncate text-xs text-muted-foreground">
                  File selected
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Photo or PDF via Cloudinary
                </span>
              )}
            </div>
            <Field label="Notes" htmlFor="doc_notes">
              <Textarea id="doc_notes" name="notes" rows={2} />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="submit"
                variant="citrus"
                className="h-11"
                disabled={pending || !publicId}
              >
                {pending ? "Saving…" : "Save document"}
              </Button>
            </div>
          </form>
        </EditPanel>
      ) : null}

      {documents.length > 0 ? (
        <div>
          <SectionToolbar
            title="All files"
            description={`${documents.length} on file — open or delete any.`}
          />
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12"> </TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden sm:table-cell">Notes</TableHead>
                  <TableHead className="w-20 text-right"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => {
                  const openUrl = documentOpenUrl(doc);
                  const thumb =
                    doc.resourceType === "image"
                      ? cloudinaryMediaThumbUrl(doc.cloudinaryPublicId, "image", {
                          width: 72,
                          height: 72,
                          crop: "fill",
                        })
                      : null;
                  return (
                    <TableRow key={doc.id} className="group">
                      <TableCell>
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb}
                            alt=""
                            className="size-9 rounded object-cover"
                          />
                        ) : (
                          <div className="flex size-9 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                            file
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="capitalize">
                        {titleCase(doc.docType)}
                      </TableCell>
                      <TableCell className="max-w-[12rem] truncate font-medium">
                        {doc.title}
                      </TableCell>
                      <TableCell className="hidden max-w-[10rem] truncate text-muted-foreground sm:table-cell">
                        {dash(doc.notes)}
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActions>
                          {openUrl ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              asChild
                            >
                              <a
                                href={openUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Open ${doc.title}`}
                              >
                                <ExternalLinkIcon className="size-3.5" />
                              </a>
                            </Button>
                          ) : null}
                          <form action={delAction}>
                            <input type="hidden" name="id" value={doc.id} />
                            <input
                              type="hidden"
                              name="staff_id"
                              value={member.id}
                            />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive hover:text-destructive"
                              aria-label={`Delete ${doc.title}`}
                            >
                              <Trash2Icon className="size-3.5" />
                            </Button>
                          </form>
                        </RowActions>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      <CloudinaryPicker
        open={Boolean(picker)}
        onOpenChange={(open) => {
          if (!open) setPicker(null);
        }}
        title={
          picker?.docType === "pass_photo"
            ? "Upload pass photo"
            : picker?.docType === "cv"
              ? "Upload CV"
              : picker?.docType === "cid"
                ? "Upload CID / ID"
                : "Staff document"
        }
        description={
          picker?.docType === "pass_photo"
            ? "Face-forward photo used in the staff directory and dossier header."
            : "Upload a scan or pick an existing file. Saved to the personnel file."
        }
        uploadFolder="pelbu/hr/staff-docs"
        acceptPdf={picker?.acceptPdf ?? true}
        acceptVideo={false}
        initialTab="upload"
        onSelect={(id, meta) => {
          const resType = meta?.resourceType ?? "image";
          if (picker?.mode === "quick" && picker.docType) {
            saveQuick(picker.docType, id, resType, picker.replaceId);
            setPicker(null);
            return;
          }
          setPublicId(id);
          setResourceType(resType);
          setPicker(null);
        }}
      />
    </div>
  );
}

/* ─── Records ─────────────────────────────────────────────────────────── */

function RecordsStep({
  member,
  conduct,
}: {
  member: StaffDossierMember;
  conduct: StaffConductRow[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [state, action, pending] = useActionState(upsertStaffConductRecord, initialHr);
  const [delState, delAction] = useActionState(deleteStaffConductRecord, initialHr);
  useActionToast(state, { successMessage: "Record saved" });
  useActionToast(delState, { successMessage: "Record removed" });
  useEffect(() => {
    if (state.ok) {
      setAdding(false);
      router.refresh();
    }
  }, [state.ok, router]);
  useEffect(() => {
    if (delState.ok) router.refresh();
  }, [delState.ok, router]);

  const employmentRows = [
    { event: "Hired", date: member.hiredOn },
    { event: "Probation ends", date: member.probationEndsOn },
    { event: "Contract ends", date: member.contractEndsOn },
  ].filter((r) => r.date);

  return (
    <div className="space-y-6">
      <div>
        <SectionToolbar
          title="Employment timeline"
          description="Key dates from the staff profile"
        />
        {employmentRows.length === 0 ? (
          <EmptyTableNote>No employment dates recorded yet.</EmptyTableNote>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Event</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employmentRows.map((row) => (
                  <TableRow key={row.event}>
                    <TableCell className="font-medium">{row.event}</TableCell>
                    <TableCell className="tabular-nums">{row.date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div>
        <SectionToolbar
          title="Conduct"
          description="Merits and warnings on the personnel file"
        >
          {!adding ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => setAdding(true)}
            >
              <PlusIcon className="size-3.5" />
              Add merit / warning
            </Button>
          ) : null}
        </SectionToolbar>

        {adding ? (
          <EditPanel
            title="Add merit or warning"
            onCancel={() => setAdding(false)}
          >
            <form action={action} className="space-y-3">
              <input type="hidden" name="staff_id" value={member.id} />
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Kind" htmlFor="rec_kind">
                  <select
                    id="rec_kind"
                    name="kind"
                    className={selectClass}
                    defaultValue="merit"
                  >
                    <option value="merit">Merit</option>
                    <option value="warning">Warning</option>
                  </select>
                </Field>
                <Field label="Severity" htmlFor="rec_sev">
                  <select
                    id="rec_sev"
                    name="severity"
                    className={selectClass}
                    defaultValue="note"
                  >
                    <option value="note">Note</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </Field>
                <Field label="Date" htmlFor="rec_on">
                  <Input
                    id="rec_on"
                    name="recorded_on"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className="h-11"
                  />
                </Field>
              </div>
              <Field label="Title" htmlFor="rec_title">
                <Input id="rec_title" name="title" required className="h-11" />
              </Field>
              <Field label="Details" htmlFor="rec_body">
                <Textarea id="rec_body" name="body" rows={3} />
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <Result state={state} />
                <Button
                  type="submit"
                  variant="citrus"
                  className="h-11"
                  disabled={pending}
                >
                  {pending ? "Saving…" : "Add record"}
                </Button>
              </div>
            </form>
          </EditPanel>
        ) : null}

        {conduct.length === 0 ? (
          <EmptyTableNote>No merits or warnings yet.</EmptyTableNote>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Date</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden md:table-cell">Details</TableHead>
                  <TableHead className="w-12 text-right"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conduct.map((row) => (
                  <TableRow key={row.id} className="group">
                    <TableCell className="tabular-nums whitespace-nowrap">
                      {row.recordedOn}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.kind === "warning" ? "destructive" : "default"}
                        className="capitalize"
                      >
                        {row.kind}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{row.severity}</TableCell>
                    <TableCell className="max-w-[10rem] truncate font-medium">
                      {row.title}
                    </TableCell>
                    <TableCell className="hidden max-w-[14rem] truncate text-muted-foreground md:table-cell">
                      {dash(row.body)}
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActions>
                        <form action={delAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="staff_id" value={member.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            aria-label={`Remove ${row.title}`}
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        </form>
                      </RowActions>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <Result state={delState} />
      </div>
    </div>
  );
}

/* ─── Shared form bits ────────────────────────────────────────────────── */

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function RoleOptions() {
  return (
    <>
      <option value="front_desk">Front desk</option>
      <option value="reservation">Reservation</option>
      <option value="fnb">F&amp;B</option>
      <option value="kitchen">Kitchen</option>
      <option value="housekeeping">Housekeeping</option>
      <option value="spa">Spa</option>
      <option value="security">Security</option>
      <option value="maintenance">Maintenance</option>
      <option value="manager">Manager</option>
      <option value="other">Other</option>
    </>
  );
}
