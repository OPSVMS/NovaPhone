import clsx from "clsx";
import type { ComponentProps } from "react";

export type CardVariant = "default" | "glass" | "outline" | "gradient";

const cardVariants: Record<CardVariant, string> = {
  default: "border border-border bg-surface shadow-card",
  glass: "glass shadow-card",
  outline: "border border-border bg-transparent",
  gradient: "border-gradient shadow-card",
};

export type CardProps = ComponentProps<"div"> & {
  variant?: CardVariant;
  /** Adds hover lift/border for clickable cards (wrap in a Link, or put a Link inside). */
  interactive?: boolean;
};

export function Card({ variant = "default", interactive, className, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        "relative rounded-card text-fg",
        cardVariants[variant],
        interactive &&
          "transition-[border-color,background-color,transform,box-shadow] duration-300 ease-out-expo hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-2 motion-reduce:hover:translate-y-0",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx("flex flex-col gap-1.5 p-5 sm:p-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return (
    <h3
      className={clsx("font-display text-lg font-semibold leading-tight tracking-tight text-fg", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={clsx("text-sm leading-relaxed text-muted", className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx("px-5 pb-5 sm:px-6 sm:pb-6", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={clsx(
        "flex items-center gap-3 border-t border-border px-5 py-4 sm:px-6",
        className,
      )}
      {...props}
    />
  );
}
