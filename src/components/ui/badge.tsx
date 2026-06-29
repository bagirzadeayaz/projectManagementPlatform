import type { HTMLAttributes } from "react";

import { cn } from "../../utils/cn";

type BadgeVariant = "default" | "secondary" | "success" | "warning" | "destructive" | "info";

export function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
}) {
  return <span className={cn("ui-badge", `ui-badge-${variant}`, className)} {...props} />;
}
