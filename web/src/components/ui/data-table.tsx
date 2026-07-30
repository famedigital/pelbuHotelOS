"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type Table as TanstackTable,
} from "@tanstack/react-table";
import { ChevronDownIcon, ChevronUpIcon, ChevronsUpDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Generic TanStack-powered data table on shadcn Table primitives.
 *
 * - Client-side sort (only on columns whose header is a button calling
 *   column.toggleSorting()) and pagination.
 * - Optional global filter (search box) when `searchable` is true.
 * - Designed for ERP list pages that already load all rows server-side.
 */
declare module "@tanstack/react-table" {
  // Allow column.meta to carry className overrides + a column-level searchPlaceholder.
  interface ColumnMeta<TData, TValue> {
    className?: string;
    headerClassName?: string;
  }
}

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Show the global search input above the table. Defaults to true. */
  searchable?: boolean;
  /** Placeholder for the global search. */
  searchPlaceholder?: string;
  /** Message rendered when the table has zero rows. */
  emptyMessage?: string;
  /** Accessible caption (rendered as sr-only <caption>). */
  caption?: string;
  /** Page size for client-side pagination. Defaults to 25. */
  pageSize?: number;
  /** Wrapper className. */
  className?: string;
  /** Right-side slot beside the search box (filters, exports, etc.). */
  toolbar?: React.ReactNode;
  /** Render rows as labelled cards below md. Defaults to true. */
  mobileCards?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchable = true,
  searchPlaceholder = "Search…",
  emptyMessage = "No records.",
  caption,
  pageSize = 25,
  className,
  toolbar,
  mobileCards = true,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  return (
    <div className={cn("space-y-3", className)}>
      {(searchable || toolbar) ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {toolbar}
          {searchable ? (
            <Input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 max-w-[260px]"
              aria-label="Search rows"
            />
          ) : null}
        </div>
      ) : null}

      {mobileCards ? (
        <div className="space-y-3 md:hidden">
          {table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <article
                key={row.id}
                className="rounded-xl border border-border bg-card p-4 shadow-xs"
              >
                <dl className="space-y-3">
                  {row.getVisibleCells().map((cell) => {
                    const header = cell.column.columnDef.header;
                    const label =
                      typeof header === "string"
                        ? header
                        : cell.column.id
                            .replace(/_/g, " ")
                            .replace(/^\w/, (letter) => letter.toUpperCase());
                    return (
                      <div
                        key={cell.id}
                        className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-3"
                      >
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {label}
                        </dt>
                        <dd className="min-w-0 text-sm text-foreground">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </article>
            ))
          ) : (
            <p className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
              {emptyMessage}
            </p>
          )}
        </div>
      ) : null}

      <div
        className={cn(
          "overflow-hidden rounded-lg border bg-card",
          mobileCards && "hidden md:block",
        )}
      >
        <Table>
          {caption ? (
            <caption className="sr-only">{caption}</caption>
          ) : null}
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "h-10 bg-muted/40 px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase [&[data-sortable=true]]:cursor-pointer [&[data-sortable=true]]:select-none",
                      header.column.columnDef.meta?.headerClassName,
                    )}
                    data-sortable={header.column.getCanSort()}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder ? null : (
                      <span className="inline-flex items-center gap-1">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        <SortIcon dir={header.column.getIsSorted()} />
                      </span>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "px-3 py-2.5",
                        cell.column.columnDef.meta?.className,
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-20 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination table={table} />
    </div>
  );
}

function SortIcon({ dir }: { dir: false | "asc" | "desc" }) {
  if (dir === "asc") {
    return <ChevronUpIcon className="size-3.5 text-accent" />;
  }
  if (dir === "desc") {
    return <ChevronDownIcon className="size-3.5 text-accent" />;
  }
  return <ChevronsUpDownIcon className="size-3 opacity-40" />;
}

function DataTablePagination<TData>({
  table,
}: {
  table: TanstackTable<TData>;
}) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const total = table.getFilteredRowModel().rows.length;
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, total);

  // Hide pagination entirely if everything fits a single page.
  if (total <= pageSize) {
    return (
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {total} {total === 1 ? "row" : "rows"}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
      <p aria-live="polite">
        Showing <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span> of{" "}
        <span className="font-medium text-foreground">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Prev
        </Button>
        <span className="px-1">
          Page {pageIndex + 1} of {table.getPageCount()}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/** Helper to build a sortable header cell content. */
export function SortableHeader({ label }: { label: string }) {
  return <span>{label}</span>;
}
