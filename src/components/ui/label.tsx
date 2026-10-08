import clsx from "clsx";
import type { ComponentProps } from "react";

export type LabelProps = ComponentProps<"label"> & {
  /** Appends a subtle "(opcional)" hint. */
  optional?: boolean;
};

export function Label({ className, optional, children, ...props }: LabelProps) {
  return (
    <label
      className={clsx("inline-flex items-center gap-1.5 text-sm font-medium text-fg", className)}
      {...props}
    >
      {children}
      {optional ? <span className="font-normal text-subtle">(opcional)</span> : null}
    </label>
  );
}
