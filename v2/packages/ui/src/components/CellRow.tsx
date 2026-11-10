import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.js";

type CellRowProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  interactive?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
};

/** Single enterprise list cell — opaque, high-contrast, optional trailing action. */
export function CellRow({
  children,
  className,
  interactive,
  leading,
  trailing,
  ...rest
}: CellRowProps) {
  return (
    <div
      className={cn("hos-cell-row", className)}
      data-interactive={interactive ? "true" : undefined}
      {...rest}
    >
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">{children}</div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

type CellButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export function CellButton({
  children,
  className,
  leading,
  trailing,
  ...rest
}: CellButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "hos-cell-row hos-btn-tactile w-full border-0 text-left",
        className,
      )}
      data-interactive="true"
      {...rest}
    >
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">{children}</div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </button>
  );
}

type InsetListProps = HTMLAttributes<HTMLDivElement> & { children: ReactNode };

export function InsetList({ children, className, ...rest }: InsetListProps) {
  return (
    <div className={cn("hos-inset-list", className)} {...rest}>
      {children}
    </div>
  );
}
