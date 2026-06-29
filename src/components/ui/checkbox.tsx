import type { InputHTMLAttributes } from "react";

import { cn } from "../../utils/cn";

export function Checkbox({ className, type: _type, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("ui-checkbox", className)} type="checkbox" {...props} />;
}
