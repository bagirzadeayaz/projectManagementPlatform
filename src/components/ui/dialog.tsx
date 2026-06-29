import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../../utils/cn";

export function Dialog({
  children,
  open,
}: {
  children: ReactNode;
  open: boolean;
}) {
  return open ? children : null;
}

export function DialogContent({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <div className="ui-dialog-backdrop" role="presentation">
      <section aria-modal="true" className={cn("ui-dialog-content", className)} role="dialog" {...props} />
    </div>
  );
}

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-dialog-header", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("ui-dialog-title", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("ui-dialog-description", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-dialog-footer", className)} {...props} />;
}
