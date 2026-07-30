"use client";

import { Badge } from "@/components/ui/badge";
import { DataTable, SortableHeader } from "@/components/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";

export type StaffDirectoryRow = {
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
  canLogin: boolean;
  lastLoginAt: string | null;
};

const columns: ColumnDef<StaffDirectoryRow>[] = [
  {
    accessorKey: "employeeCode",
    header: () => <SortableHeader label="Code" />,
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.employeeCode}</span>
    ),
  },
  {
    accessorKey: "fullName",
    header: () => <SortableHeader label="Staff member" />,
    cell: ({ row }) => (
      <div className="min-w-44">
        <p className="font-medium">{row.original.fullName}</p>
        <p className="text-xs text-muted-foreground">
          {row.original.positionTitle ?? row.original.role.replaceAll("_", " ")}
        </p>
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

export function StaffDirectoryTable({ data }: { data: StaffDirectoryRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      caption="Pelbu Suites staff directory"
      searchPlaceholder="Search staff, code, role, contact…"
      emptyMessage="No staff records."
      pageSize={20}
    />
  );
}
