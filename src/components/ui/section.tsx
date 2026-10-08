import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import { Container, type ContainerSize } from "./container";

export type SectionProps = ComponentProps<"section"> & {
  /** Container width. Pass `false` to render children without a Container. */
  container?: ContainerSize | false;
  /** Vertical rhythm. Default "md" (64px → 96px). */
  spacing?: "sm" | "md" | "lg";
};

const spacingClass = {
  sm: "py-10 sm:py-14",
  md: "py-16 sm:py-24",
  lg: "py-20 sm:py-32",
} as const;

export function Section({ container = "lg", spacing = "md", className, children, ...props }: SectionProps) {
  return (
    <section className={clsx("relative", spacingClass[spacing], className)} {...props}>
      {container === false ? children : <Container size={container}>{children}</Container>}
    </section>
  );
}

export type SectionHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  /** Heading level. Default h2. */
  as?: "h1" | "h2" | "h3";
  className?: string;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
  as: Heading = "h2",
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={clsx(
        "flex max-w-2xl flex-col gap-4",
        align === "center" ? "mx-auto items-center text-center" : "items-start text-left",
        className,
      )}
    >
      {eyebrow ? (
        <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-lavender">
          {eyebrow}
        </span>
      ) : null}
      <Heading className="font-display text-3xl font-semibold leading-[1.1] tracking-tight text-fg sm:text-4xl">
        {title}
      </Heading>
      {description ? <p className="text-base leading-relaxed text-muted sm:text-lg">{description}</p> : null}
    </div>
  );
}
