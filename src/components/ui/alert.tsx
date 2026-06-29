import type { HTMLAttributes } from "react";

import { cn } from "../../utils/cn";

type AlertVariant = "default" | "destructive" | "success";

export function Alert({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLParagraphElement> & {
  variant?: AlertVariant;
}) {
  return <p className={cn("ui-alert", `ui-alert-${variant}`, className)} {...props} />;
}
