"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "./button";

type NativeButtonProps = Omit<Extract<ComponentProps<typeof Button>, { href?: undefined }>, "type" | "href">;

export type SubmitButtonProps = NativeButtonProps & {
  /** Optional label while the form is pending (spinner is shown either way). */
  pendingText?: ReactNode;
};

/**
 * Submit button for `<form action={serverAction}>`. Must be rendered *inside* the form.
 * Shows a spinner and disables itself while the action is pending.
 */
export function SubmitButton({ children, pendingText, loading, disabled, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const busy = pending || loading;
  return (
    <Button {...props} type="submit" loading={busy && !pendingText} disabled={disabled || busy}>
      {busy && pendingText ? pendingText : children}
    </Button>
  );
}
