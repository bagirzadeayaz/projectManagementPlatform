import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

import { cn } from "../../utils/cn";

export function Tabs({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-tabs", className)} role="tablist" {...props} />;
}

export function TabsTrigger({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn("ui-tabs-trigger", className)} role="tab" type="button" {...props} />;
}
