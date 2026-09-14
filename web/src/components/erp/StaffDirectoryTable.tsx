"use client";

import {
  StaffDossierDialog,
  type ManagerOption,
  type StaffConductRow,
  type StaffDocumentRow,
  type StaffDossierMember,
  type StaffPayComponentRow,
  type StaffPrivateProfile,
} from "@/components/erp/StaffDossierDialog";
import { StaffAvatar } from "@/components/erp/StaffAvatar";
import { Badge } from "@/components/ui/badge";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";

export type StaffDirectoryRow = StaffDossierMember & {
  photoPublicId: string | null;
};

/**
 * Prefer private-profile pass photo, then newest pass_photo document.
 * Directory always has a photoPublicId field (null → initials fallback).
 */
export function resolveStaffPhotoPublicId(
  staffId: string,
  privateProfiles: StaffPrivateProfile[],
  documents: StaffDocumentRow[],
): string | null {
  const profile = privateProfiles.find((row) => row.staffId === staffId);
  if (profile?.photoPublicId) return profile.photoPublicId;
  const pass = documents.find(
    (row) => row.staffId === staffId && row.docType === "pass_photo",
  );
  return pass?.cloudinaryPublicId ?? null;
}

const columns: ColumnDef<StaffDirectoryRow>[] = [
  {
    accessorKey: "fullName",
    header: () => <SortableHeader label="Staff member" />,
    cell: ({ row }) => (
      <div className="flex min-w-48 items-center gap-3">
        <StaffAvatar
          name={row.original.fullName}
          publicId={row.original.photoPublicId}
          size="md"
        />
        <div className="min-w-0">
          <p className="font-medium leading-tight">{row.original.fullName}</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {row.original.employeeCode}
          </p>
          <p className="text-xs text-muted-foreground capitalize">
            {row.original.positionTitle ??
              row.original.role.replaceAll("_", " ")}
          </p>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "department",
    header: () => <SortableHeader label="Department" />,
    cell: ({ row }) => (
      <span className="capitalize">
        {row.original.department ?? row.original.role.replaceAll("_", " ")}
      </span>
    ),
  },
  {
    accessorKey: "employmentType",
    header: () => <SortableHeader label="Employment" />,
    cell: ({ row }) => (
      <span className="capitalize">
        {row.original.employmentType.replaceAll("_", " ")}
      </span>
    ),
  },
  {
    id: "contact",
    accessorFn: (row) => `${row.phone ?? ""} ${row.email ?? ""}`,
    header: "Contact",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="min-w-40 text-xs">
        <p>{row.original.phone ?? "No phone"}</p>
        <p className="text-muted-foreground">{row.original.email ?? "No email"}</p>
      </div>
    ),
  },
  {
    id: "portal",
    accessorFn: (row) => (row.canLogin ? "ready" : "off"),
    header: () => <SortableHeader label="Staff app" />,
    cell: ({ row }) => (
      <div>
        <Badge variant={row.original.canLogin ? "default" : "outline"}>
          {row.original.canLogin ? "ready" : "off"}
        </Badge>
        {row.original.lastLoginAt ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Last login {row.original.lastLoginAt.slice(0, 10)}
          </p>
        ) : null}
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: () => <SortableHeader label="Status" />,
    cell: ({ row }) => (
      <Badge variant={row.original.status === "active" ? "default" : "outline"}>
        {row.original.status.replaceAll("_", " ")}
      </Badge>
    ),
  },
];

export function StaffDirectoryTable({
  data,
  privateProfiles,
  payComponents,
  documents,
  conduct,
  managers,
  departments = [],
  canEditModules = false,
}: {
  data: StaffDossierMember[];
  privateProfiles: StaffPrivateProfile[];
  payComponents: StaffPayComponentRow[];
  documents: StaffDocumentRow[];
  conduct: StaffConductRow[];
  managers: ManagerOption[];
  departments?: string[];
  canEditModules?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const directoryRows = useMemo<StaffDirectoryRow[]>(
    () =>
      data.map((row) => ({
        ...row,
        photoPublicId: resolveStaffPhotoPublicId(
          row.id,
          privateProfiles,
          documents,
        ),
      })),
    [data, privateProfiles, documents],
  );

  const member = useMemo(
    () => directoryRows.find((row) => row.id === selectedId) ?? null,
    [directoryRows, selectedId],
  );
  const profile = useMemo(
    () => privateProfiles.find((row) => row.staffId === selectedId) ?? null,
    [privateProfiles, selectedId],
  );
  const comps = useMemo(
    () => payComponents.filter((row) => row.staffId === selectedId),
    [payComponents, selectedId],
  );
  const docs = useMemo(
    () => documents.filter((row) => row.staffId === selectedId),
    [documents, selectedId],
  );
  const records = useMemo(
    () => conduct.filter((row) => row.staffId === selectedId),
    [conduct, selectedId],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={directoryRows}
        caption="Pelbu Suites staff directory"
        searchPlaceholder="Search staff, code, role, contact…"
        emptyMessage="No staff records. Add hires below."
        pageSize={20}
        onRowClick={(row) => setSelectedId(row.id)}
      />
      <StaffDossierDialog
        open={Boolean(member)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        member={member}
        privateProfile={profile}
        payComponents={comps}
        documents={docs}
        conduct={records}
        managers={managers}
        departments={departments}
        canEditModules={canEditModules}
      />
    </>
  );
}
