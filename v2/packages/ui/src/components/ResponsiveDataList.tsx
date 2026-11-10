import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";
import { EmptyState } from "./EmptyState.js";
import { useIsPhone } from "../hooks/useMediaQuery.js";

type ResponsiveDataListProps<T> = {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onRowClick?: (row: T) => void;
  getRowId?: (row: T) => string;
  className?: string;
  /** Card primary line when phone. Defaults to first column cell. */
  renderCard?: (row: T) => ReactNode;
};

/** Table on md+; touch-friendly cellular cards on phone. */
export function ResponsiveDataList<T>({
  data,
  columns,
  emptyTitle,
  emptyDescription,
  emptyAction,
  onRowClick,
  getRowId,
  className,
  renderCard,
}: ResponsiveDataListProps<T>) {
  const isPhone = useIsPhone();
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
  });

  if (data.length === 0) {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
    );
  }

  if (isPhone) {
    return (
      <ul className={cn("m-0 grid list-none gap-2 p-0", className)}>
        {table.getRowModel().rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onRowClick?.(row.original)}
              className={cn(
                "hos-glass-card hos-btn-tactile flex min-h-[48px] w-full flex-col gap-1 p-3 text-left",
                onRowClick && "active:bg-[rgba(59,130,246,0.08)]",
              )}
            >
              {renderCard ? (
                renderCard(row.original)
              ) : (
                <>
                  <span className="text-sm font-semibold tracking-tight text-[var(--hos-ink)]">
                    {flexRender(
                      row.getVisibleCells()[0]?.column.columnDef.cell,
                      row.getVisibleCells()[0]!.getContext(),
                    )}
                  </span>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums text-[var(--hos-ink-3)]">
                    {row
                      .getVisibleCells()
                      .slice(1, 4)
                      .map((cell) => (
                        <span key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </span>
                      ))}
                  </div>
                </>
              )}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={cn("hos-table-shell hos-scrollbar-slim", className)}>
      <table className="hos-data">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id}>
                  {h.isPlaceholder
                    ? null
                    : flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              data-clickable={onRowClick ? "true" : undefined}
              onClick={() => onRowClick?.(row.original)}
              onKeyDown={(e) => {
                if (!onRowClick) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onRowClick(row.original);
                }
              }}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
