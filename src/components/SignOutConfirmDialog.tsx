"use client";

import { useAuth } from "../hooks/useAuth";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";

export function SignOutConfirmDialog({
  busy,
  onCancel,
  onConfirm,
  open,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
}) {
  const { t } = useAuth();

  return (
    <Dialog open={open}>
      <DialogContent className="signout-confirm-dialog" aria-labelledby="signout-confirm-title">
        <DialogHeader>
          <p className="auth-kicker">{t("logoutTitle")}</p>
          <DialogTitle id="signout-confirm-title">{t("logoutQuestion")}</DialogTitle>
          <DialogDescription>{t("logoutCopy")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button disabled={busy} onClick={onCancel} type="button" variant="secondary">
            {t("cancel")}
          </Button>
          <Button disabled={busy} onClick={onConfirm} type="button" variant="destructive">
            {busy ? t("logoutBusy") : t("logout")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
