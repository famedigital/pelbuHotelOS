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
  type FilterFn,
  type RowSelectionState,
  type SortingState,
  type Table as TanstackTable,
  type Updater,
} from "@tanstack/react-table";
import { ChevronDownIcon, ChevronUpIcon, ChevronsUpDownIcon } from "lucide-react";
import { useRouter } from "next/navigation";

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

export type DataTableDensity = "compact" | "comfortable" | "spacious";

const DENSITY_KEY = "innora.table.density";
const STRIPE_KEY = "innora.table.striped";

const DENSITY_CELL: Record<DataTableDensity, string> = {
  compact: "px-2 py-1 text-xs",
  comfortable: "px-3 py-2",
  spacious: "px-4 py-3.5",
};

const DENSITY_HEAD: Record<DataTableDensity, string> = {
  compact: "h-8 px-2 text-[10px]",
  comfortable: "h-10 px-3 text-xs",
  spacious: "h-12 px-4 text-xs",
};

function readDensity(): DataTableDensity {
  if (typeof window === "undefined") return "comfortable";
  const raw = window.localStorage.getItem(DENSITY_KEY);
  if (raw === "compact" || raw === "comfortable" || raw === "spacious") return raw;
  return "comfortable";
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
  /** When set, clicking a row navigates here (action cells still work independently). */
  getRowHref?: (row: TData) => string | undefined;
  /** When set, clicking a row invokes this callback (ignored if getRowHref also fires). */
  onRowClick?: (row: TData) => void;
  /**
   * Search the whole row. When set, only the first column is tested so the
   * function runs once per row (display columns have no accessor).
   */
  globalFilterFn?: FilterFn<TData>;
  /** Row height. Shared across tables via the desk preference. */
  density?: DataTableDensity;
  onDensityChange?: (density: DataTableDensity) => void;
  /** Checkbox column. Selected rows are reported through onSelectedRowsChange. */
  enableRowSelection?: boolean;
  /** Stable id so a checked row stays checked when the list reorders. */
  getRowId?: (originalRow: TData, index: number) => string;
  onSelectedRowsChange?: (rows: TData[]) => void;
  /** Change this to clear the current checks, for example after a bulk save. */
  selectionResetKey?: string | number;
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
  getRowHref,
  onRowClick,
  globalFilterFn,
  density: densityProp,
  onDensityChange,
  enableRowSelection = false,
  getRowId,
  onSelectedRowsChange,
  selectionResetKey,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = React.useState("");
  const onSelectedRowsChangeRef = React.useRef(onSelectedRowsChange);
  onSelectedRowsChangeRef.current = onSelectedRowsChange;
  const [densityState, setDensityState] = React.useState<DataTableDensity>("comfortable");
  const [striped, setStriped] = React.useState(false);
  const router = useRouter();
  const density = densityProp ?? densityState;

  React.useEffect(() => {
    if (densityProp) return;
    setDensityState(readDensity());
    setStriped(window.localStorage.getItem(STRIPE_KEY) === "1");
  }, [densityProp]);

  function chooseDensity(next: DataTableDensity) {
    window.localStorage.setItem(DENSITY_KEY, next);
    onDensityChange?.(next);
    if (!densityProp) setDensityState(next);
  }

  function chooseStriped(next: boolean) {
    window.localStorage.setItem(STRIPE_KEY, next ? "1" : "0");
    setStriped(next);
  }

  const resolvedColumns = React.useMemo(
    () => (enableRowSelection ? [selectionColumn<TData>(), ...columns] : columns),
    [columns, enableRowSelection],
  );

  const table = useReactTable({
    data,
    columns: resolvedColumns,
    state: { sorting, globalFilter, rowSelection },
    enableRowSelection,
    getRowId,
    onSortingChange: setSorting,
    onRowSelectionChange: (updater: Updater<RowSelectionState>) => {
      setRowSelection(updater);
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    ...(globalFilterFn
      ? {
          globalFilterFn,
          getColumnCanGlobalFilter: (column: { getIndex: () => number }) =>
            column.getIndex() === 0,
        }
      : {}),
  });

  const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original);
  const selectedSignature = table
    .getSelectedRowModel()
    .rows.map((row) => row.id)
    .join("\n");

  React.useEffect(() => {
    setRowSelection({});
  }, [selectionResetKey]);

  React.useEffect(() => {
    if (!enableRowSelection) return;
    onSelectedRowsChangeRef.current?.(selectedRows);
    // The signature is the change signal. selectedRows is the snapshot from that render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableRowSelection, selectedSignature]);

  return (
    <div className={cn("min-w-0 space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-end gap-2">
          {toolbar}
          <DensityControl
            density={density}
            striped={striped}
            onDensity={chooseDensity}
            onStriped={chooseStriped}
          />
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

      {mobileCards ? (
        <div className="space-y-3 md:hidden">
          {table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => {
              const href = getRowHref?.(row.original);
              const clickable = Boolean(href || onRowClick);
              return (
              <article
                key={row.id}
                className={cn(
                  "rounded-xl border border-border bg-card p-4 shadow-xs min-h-11",
                  clickable && "cursor-pointer active:bg-muted/40",
                )}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={
                  clickable
                    ? (e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest("a, button, input, select, textarea")) {
                          return;
                        }
                        if (href) router.push(href);
                        else onRowClick?.(row.original);
                      }
                    : undefined
                }
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (href) router.push(href);
                          else onRowClick?.(row.original);
                        }
                      }
                    : undefined
                }
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
              );
            })
          ) : (
            <p className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
              {emptyMessage}
            </p>
          )}
        </div>
      ) : null}

      <div
        className={cn(
          "w-full min-w-0 max-w-full rounded-lg border bg-card",
          mobileCards && "hidden md:block",
        )}
      >
        <Table className="w-max min-w-full">
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
                      "bg-[var(--ivory-deep)] font-semibold tracking-wide text-[var(--espresso-mute)] uppercase [&[data-sortable=true]]:cursor-pointer [&[data-sortable=true]]:select-none",
                      DENSITY_HEAD[density],
                      header.column.columnDef.meta?.headerClassName,
                    )}
                    data-sortable={header.column.getCanSort()}
                    onClick={(event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest("input, button, a, select, textarea, label")) {
                        return;
                      }
                      header.column.getToggleSortingHandler()?.(event);
                    }}
                  >
                    {header.isPlaceholder ? null : (
                      <span className="inline-flex items-center gap-1">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {header.column.getCanSort() ? (
                          <SortIcon dir={header.column.getIsSorted()} />
                        ) : null}
                      </span>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const href = getRowHref?.(row.original);
                const clickable = Boolean(href || onRowClick);
                return (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(
                    "group/row",
                    clickable && "cursor-pointer",
                    striped && "even:bg-[var(--ivory-deep)]/60",
                  )}
                  onClick={
                    clickable
                      ? (e) => {
                          const target = e.target as HTMLElement;
                          if (target.closest("a, button, input, select, textarea")) {
                            return;
                          }
                          if (href) router.push(href);
                          else onRowClick?.(row.original);
                        }
                      : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        DENSITY_CELL[density],
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
                );
              })
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

function DensityControl({
  density,
  striped,
  onDensity,
  onStriped,
}: {
  density: DataTableDensity;
  striped: boolean;
  onDensity: (density: DataTableDensity) => void;
  onStriped: (striped: boolean) => void;
}) {
  const options: Array<{ id: DataTableDensity; label: string }> = [
    { id: "compact", label: "Compact" },
    { id: "comfortable", label: "Comfortable" },
    { id: "spacious", label: "Spacious" },
  ];
  return (
    <div className="flex items-center gap-1">
      <div className="flex overflow-hidden rounded-md border border-[var(--brass-hairline)] bg-white" role="group" aria-label="Row size">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={density === option.id}
            className={cn(
              "h-8 px-2 text-xs",
              density === option.id
                ? "bg-[var(--espresso)] font-medium text-[var(--ivory)]"
                : "text-[var(--espresso-mute)] hover:bg-[var(--ivory-deep)]",
            )}
            onClick={() => onDensity(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-pressed={striped}
        className={cn(
          "h-8 rounded-md border px-2 text-xs",
          striped
            ? "border-[var(--espresso)] bg-[var(--ivory-deep)] font-medium text-[var(--espresso)]"
            : "border-[var(--brass-hairline)] bg-white text-[var(--espresso-mute)] hover:bg-[var(--ivory-deep)]",
        )}
        onClick={() => onStriped(!striped)}
      >
        Striped
      </button>
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

function selectionColumn<TData>(): ColumnDef<TData, unknown> {
  return {
    id: "select",
    enableSorting: false,
    header: ({ table }) => (
      <RowCheckBox
        checked={table.getIsAllRowsSelected()}
        indeterminate={
          table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()
        }
        onChange={table.getToggleAllRowsSelectedHandler()}
        label="Select all rows"
      />
    ),
    cell: ({ row }) => (
      <RowCheckBox
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
        label="Select row"
      />
    ),
    meta: { className: "w-10", headerClassName: "w-10" },
  };
}

function RowCheckBox({
  checked,
  indeterminate = false,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  label: string;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="size-4 shrink-0 accent-accent"
      checked={checked}
      onChange={onChange}
      aria-label={label}
    />
  );
}

/** Helper to build a sortable header cell content. */
export function SortableHeader({ label }: { label: string }) {
  return <span>{label}</span>;
}
