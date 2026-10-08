import { useId, type ReactNode } from "react";
import clsx from "clsx";
import { Input, type InputProps } from "./input";
import { Label } from "./label";

export type FieldProps = InputProps & {
  label: ReactNode;
  /** Helper text under the input. Hidden while an error is shown. */
  hint?: ReactNode;
  /** Error message; sets aria-invalid and is announced to screen readers. */
  error?: string | null;
  optional?: boolean;
  /** Classes for the wrapper (the input itself takes `className`). */
  wrapperClassName?: string;
};

/** Label + Input + hint/error, fully wired (ids, aria-describedby, aria-invalid). */
export function Field({
  label,
  hint,
  error,
  optional,
  wrapperClassName,
  id,
  ...inputProps
}: FieldProps) {
  const autoId = useId();
  const inputId = id ?? `f-${autoId}`;
  const describedId = `${inputId}-desc`;
  const hasDesc = Boolean(error || hint);

  return (
    <div className={clsx("flex flex-col gap-2", wrapperClassName)}>
      <Label htmlFor={inputId} optional={optional}>
        {label}
      </Label>
      <Input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={hasDesc ? describedId : undefined}
        {...inputProps}
      />
      {error ? (
        <p id={describedId} role="alert" className="flex items-start gap-1.5 text-[13px] leading-snug text-danger">
          <svg aria-hidden viewBox="0 0 16 16" className="mt-px size-3.5 shrink-0" fill="currentColor">
            <path d="M8 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Zm0 3.25a.75.75 0 0 0-.75.75v3a.75.75 0 0 0 1.5 0v-3A.75.75 0 0 0 8 4.75Zm0 6.75a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75Z" />
          </svg>
          {error}
        </p>
      ) : hint ? (
        <p id={describedId} className="text-[13px] leading-snug text-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
