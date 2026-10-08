import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "inverse" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const base =
  "group/button relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap font-medium " +
  "transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 ease-out-expo " +
  "active:scale-[0.98] motion-reduce:active:scale-100 " +
  "disabled:pointer-events-none disabled:not-aria-busy:opacity-50 aria-disabled:pointer-events-none aria-disabled:not-aria-busy:opacity-50 aria-busy:cursor-progress " +
  "[&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary-hover " +
    "shadow-[inset_0_1px_0_0_rgb(255_255_255/0.2),0_8px_24px_-10px_rgb(118_82_240/0.75)] " +
    "hover:shadow-[inset_0_1px_0_0_rgb(255_255_255/0.25),0_10px_32px_-10px_rgb(132_102_244/0.9)]",
  secondary:
    "border border-border bg-surface-2 text-fg hover:border-border-strong hover:bg-surface-3 " +
    "shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04)]",
  outline: "border border-border-strong bg-transparent text-fg hover:bg-white/[0.04]",
  ghost: "bg-transparent text-muted hover:bg-white/[0.05] hover:text-fg",
  inverse: "bg-fg text-bg hover:bg-white shadow-[0_8px_24px_-12px_rgb(255_255_255/0.35)]",
  danger: "border border-danger/25 bg-danger/10 text-danger hover:border-danger/40 hover:bg-danger/15",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 rounded-[10px] px-3 text-sm [&_svg]:size-4",
  md: "h-11 rounded-control px-[18px] text-[15px] [&_svg]:size-[18px]",
  lg: "h-12 rounded-control px-6 text-base [&_svg]:size-5",
  icon: "size-11 rounded-control [&_svg]:size-5",
  "icon-sm": "size-9 rounded-[10px] [&_svg]:size-4",
};

/** Class builder, for styling non-button elements like a button. */
export function buttonVariants({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return clsx(base, variants[variant], sizes[size], fullWidth && "w-full", className);
}

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, keeps width, disables interaction. */
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
  children?: ReactNode;
};

type LinkButtonProps = CommonProps &
  Omit<ComponentProps<typeof Link>, keyof CommonProps> & {
    href: ComponentProps<typeof Link>["href"];
    disabled?: boolean;
  };

type NativeButtonProps = CommonProps &
  Omit<ComponentProps<"button">, keyof CommonProps> & {
    href?: undefined;
  };

export type ButtonProps = LinkButtonProps | NativeButtonProps;

function Content({ loading, children }: { loading?: boolean; children?: ReactNode }) {
  if (!loading) return <>{children}</>;
  return (
    <>
      <span className="invisible inline-flex items-center gap-2">{children}</span>
      <span className="absolute inset-0 flex items-center justify-center">
        <Spinner size={18} label={null} />
      </span>
    </>
  );
}

/**
 * Button. Renders a Next.js `<Link>` when `href` is passed, otherwise a `<button>`.
 * `type` defaults to "button" — pass `type="submit"` in forms (or use `<SubmitButton>`).
 */
export function Button(props: ButtonProps) {
  if (props.href !== undefined) {
    const { variant, size, loading, fullWidth, className, children, disabled, ...rest } = props;
    const inactive = disabled || loading;
    return (
      <Link
        {...rest}
        aria-disabled={inactive || undefined}
        aria-busy={loading || undefined}
        tabIndex={inactive ? -1 : rest.tabIndex}
        className={buttonVariants({ variant, size, fullWidth, className })}
      >
        <Content loading={loading}>{children}</Content>
      </Link>
    );
  }

  const { variant, size, loading, fullWidth, className, children, disabled, type, ...rest } =
    props;
  return (
    <button
      {...rest}
      type={type ?? "button"}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonVariants({ variant, size, fullWidth, className })}
    >
      <Content loading={loading}>{children}</Content>
    </button>
  );
}
