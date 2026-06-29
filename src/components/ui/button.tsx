import type { ButtonHTMLAttributes } from "react";

import { cn } from "../../utils/cn";

type ButtonVariant = "default" | "secondary" | "destructive" | "ghost" | "link";
type ButtonSize = "default" | "sm" | "lg" | "icon";

export function buttonVariants({
  className,
  size = "default",
  variant = "default",
}: {
  className?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
} = {}) {
  return cn("ui-button", `ui-button-${variant}`, `ui-button-size-${size}`, className);
}

export function Button({
  className,
  size = "default",
  variant = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  return <button className={buttonVariants({ className, size, variant })} {...props} />;
}
