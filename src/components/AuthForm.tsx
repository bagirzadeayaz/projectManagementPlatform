"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "../hooks/useAuth";
import { isAdminRole } from "../utils/roles";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { SignOutConfirmDialog } from "./SignOutConfirmDialog";

function getHomePath(role?: string) {
  return role && isAdminRole(role) ? "/statistics" : "/projects";
}

export function AuthForm() {
  const router = useRouter();
  const { user, busy, error, t, clearError, signInWithMicrosoft, signOut } = useAuth();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [localBusy, setLocalBusy] = useState(false);
  const actionInFlightRef = useRef(false);
  const actionBusy = busy || localBusy;

  const handleMicrosoftSignIn = async () => {
    if (actionInFlightRef.current || busy) {
      return;
    }

    actionInFlightRef.current = true;
    setLocalBusy(true);
    clearError();

    try {
      const profile = await signInWithMicrosoft();
      router.push(getHomePath(profile.role));
    } catch {
      // The hook already formats and stores the visible error.
    } finally {
      actionInFlightRef.current = false;
      setLocalBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setConfirmingSignOut(false);
  };

  if (user) {
    return (
      <Card className="auth-card auth-card-signed-in">
        <CardHeader>
          <p className="auth-kicker">{t("signedIn")}</p>
          <h1>{user.name || t("welcome")}</h1>
          <p className="auth-muted">{user.email}</p>
        </CardHeader>
        <CardContent>
          <Button disabled={busy} onClick={() => setConfirmingSignOut(true)} type="button" variant="secondary">
            {busy ? t("logoutBusy") : t("logout")}
          </Button>
          <Button onClick={() => router.push(getHomePath(user.role))} type="button">
            {t("openProjects")}
          </Button>
        </CardContent>
        <SignOutConfirmDialog
          busy={busy}
          onCancel={() => setConfirmingSignOut(false)}
          onConfirm={() => void handleSignOut()}
          open={confirmingSignOut}
        />
      </Card>
    );
  }

  return (
    <Card className="auth-card">
      <CardContent className="auth-card-content">
        <div className="autoAuthAdmin" aria-hidden="true" />

        <div className="auth-header">
          <p className="auth-kicker">{t("workspace")}</p>
          <h1>{t("loginTitle")}</h1>
          <p className="auth-muted">{t("microsoftSignInCopy")}</p>
        </div>

        {error ? <Alert variant="destructive">{error}</Alert> : null}

        <Button className="auth-button microsoft-auth-button" disabled={actionBusy} onClick={handleMicrosoftSignIn} type="button">
          <span aria-hidden="true" className="microsoft-auth-mark">
            <span />
            <span />
            <span />
            <span />
          </span>
          {actionBusy ? t("loading") : t("continueWithMicrosoft")}
        </Button>
      </CardContent>
    </Card>
  );
}
