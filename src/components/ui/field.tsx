import type { LabelHTMLAttributes } from "react";

import { cn } from "../../utils/cn";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("ui-label", className)} {...props} />;
}

export function FieldLabel({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("ui-field", className)} {...props} />;
}
