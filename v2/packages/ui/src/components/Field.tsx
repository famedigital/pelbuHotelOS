import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "../lib/cn.js";

export type FieldState = "default" | "error" | "success";

type FieldShellProps = {
  label: string;
  hint?: string;
  state?: FieldState;
  className?: string;
  children: ReactNode;
};

export function Field({
  label,
  hint,
  state = "default",
  className,
  children,
}: FieldShellProps) {
  return (
    <label
      className={cn("hos-field", className)}
      data-state={state}
    >
      <span>{label}</span>
      {children}
      {hint ? (
        <em
          className={cn(
            "not-italic text-[10px]",
            state === "error"
              ? "text-[var(--hos-ruby)]"
              : state === "success"
                ? "text-[var(--hos-emerald)]"
                : "text-[var(--hos-ink-3)]",
          )}
        >
          {hint}
        </em>
      ) : null}
    </label>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  state?: FieldState;
  className?: string;
  inputClassName?: string;
};

export function FieldInput({
  label,
  hint,
  state = "default",
  className,
  inputClassName,
  ...props
}: InputProps) {
  return (
    <Field label={label} hint={hint} state={state} className={className}>
      <input
        className={cn("hos-input", inputClassName)}
        data-state={state}
        aria-invalid={state === "error" || undefined}
        {...props}
      />
    </Field>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  state?: FieldState;
  className?: string;
  selectClassName?: string;
  children: ReactNode;
};

export function FieldSelect({
  label,
  hint,
  state = "default",
  className,
  selectClassName,
  children,
  ...props
}: SelectProps) {
  return (
    <Field label={label} hint={hint} state={state} className={className}>
      <select
        className={cn("hos-input", selectClassName)}
        data-state={state}
        aria-invalid={state === "error" || undefined}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  state?: FieldState;
  className?: string;
  textareaClassName?: string;
};

export function FieldTextarea({
  label,
  hint,
  state = "default",
  className,
  textareaClassName,
  ...props
}: TextAreaProps) {
  return (
    <Field label={label} hint={hint} state={state} className={className}>
      <textarea
        className={cn("hos-input", textareaClassName)}
        data-state={state}
        aria-invalid={state === "error" || undefined}
        {...props}
      />
    </Field>
  );
}
