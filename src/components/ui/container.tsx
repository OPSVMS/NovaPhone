import clsx from "clsx";
import type { ComponentProps } from "react";

export type ContainerSize = "sm" | "md" | "lg" | "xl";

const widths: Record<ContainerSize, string> = {
  sm: "max-w-2xl", // 672 — forms, auth, reading
  md: "max-w-4xl", // 896 — dashboard content column
  lg: "max-w-6xl", // 1152 — default marketing / app shell
  xl: "max-w-7xl", // 1280 — wide grids
};

export type ContainerProps = ComponentProps<"div"> & { size?: ContainerSize };

/** Centered page column with responsive gutters (16px → 24px → 32px). */
export function Container({ size = "lg", className, ...props }: ContainerProps) {
  return <div className={clsx("mx-auto w-full px-4 sm:px-6 lg:px-8", widths[size], className)} {...props} />;
}
