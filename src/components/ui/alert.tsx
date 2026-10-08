import clsx from "clsx";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

export type AlertVariant = "info" | "success" | "warning" | "error";

const styles: Record<AlertVariant, { box: string; icon: ReactNode }> = {
  info: { box: "border-lavender/20 bg-primary/[0.08] [&>svg]:text-lavender", icon: <Info aria-hidden /> },
  success: { box: "border-success/20 bg-success/[0.07] [&>svg]:text-success", icon: <CircleCheck aria-hidden /> },
  warning: { box: "border-warning/20 bg-warning/[0.07] [&>svg]:text-warning", icon: <TriangleAlert aria-hidden /> },
  error: { box: "border-danger/25 bg-danger/[0.08] [&>svg]:text-danger", icon: <CircleAlert aria-hidden /> },
};

export type AlertProps = {
  variant?: AlertVariant;
  title?: ReactNode;
  children?: ReactNode;
  /** Override the default icon; pass `null` to hide it. */
  icon?: ReactNode | null;
  /** Optional trailing action (e.g. a small Button). */
  action?: ReactNode;
  className?: string;
};

export function Alert({ variant = "info", title, children, icon, action, className }: AlertProps) {
  const s = styles[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={clsx(
        "flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm [&>svg]:mt-0.5 [&>svg]:size-[18px] [&>svg]:shrink-0",
        s.box,
        className,
      )}
    >
      {icon === undefined ? s.icon : icon}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title ? <p className="font-medium text-fg">{title}</p> : null}
        {children ? <div className="leading-relaxed text-muted">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}
