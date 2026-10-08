import clsx from "clsx";

export type SpinnerProps = {
  /** px. Default 16. */
  size?: number;
  className?: string;
  /** Screen-reader label. Default "Cargando". Pass null when a parent already announces it. */
  label?: string | null;
};

export function Spinner({ size = 16, className, label = "Cargando" }: SpinnerProps) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
      className={clsx("inline-flex shrink-0", className)}
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        className="animate-spin motion-reduce:animate-[spin_1.6s_linear_infinite]"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
