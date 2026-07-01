"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "../hooks/useAuth";
import { isAdminRole } from "../utils/roles";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { FieldLabel } from "./ui/field";
import { Input } from "./ui/input";
import { SignOutConfirmDialog } from "./SignOutConfirmDialog";
import { Tabs, TabsTrigger } from "./ui/tabs";

type AuthMode = "login" | "register";

function getHomePath(role?: string) {
  return role && isAdminRole(role) ? "/statistics" : "/projects";
}

export function AuthForm() {
  const router = useRouter();
  const { user, busy, error, t, clearError, login, register, sendResetEmail, signOut } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  const isRegistering = mode === "register";

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPasswordError(null);
    setNotice(null);
    clearError();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    setPasswordError(null);

    if (isRegistering && registerPassword !== registerConfirmPassword) {
      setPasswordError(t("passwordMismatch"));
      return;
    }

    try {
      if (isRegistering) {
        const credentials = {
          email: registerEmail.trim(),
          password: registerPassword,
          name: registerName.trim(),
        };

        await register(credentials);
        router.push("/projects");
      } else {
        const credentials = {
          email: loginEmail.trim(),
          password: loginPassword,
        };

        const profile = await login(credentials);
        router.push(getHomePath(profile?.role));
      }
    } catch {
      // The hook already formats and stores the visible error.
    }
  };

  const handlePasswordReset = async () => {
    if (!loginEmail.trim()) {
      setNotice(t("enterEmailFirst"));
      return;
    }

    try {
      await sendResetEmail(loginEmail.trim());
      setNotice(t("passwordResetSent"));
    } catch {
      // The hook already formats and stores the visible error.
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
          <h1>{isRegistering ? t("createAccount") : t("loginTitle")}</h1>
        </div>

        <Tabs className="auth-tabs" aria-label={t("authMode")}>
          <TabsTrigger
            aria-selected={!isRegistering}
            className="auth-tab"
            onClick={() => switchMode("login")}
          >
            {t("login")}
          </TabsTrigger>
          <TabsTrigger
            aria-selected={isRegistering}
            className="auth-tab"
            onClick={() => switchMode("register")}
          >
            {t("register")}
          </TabsTrigger>
        </Tabs>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegistering ? (
            <FieldLabel>
              <span>{t("name")}</span>
              <Input autoComplete="name" onChange={(event) => setRegisterName(event.target.value)} type="text" value={registerName} required />
            </FieldLabel>
          ) : null}

          <FieldLabel>
            <span>{t("email")}</span>
            <Input
              autoComplete="email"
              onChange={(event) => isRegistering ? setRegisterEmail(event.target.value) : setLoginEmail(event.target.value)}
              required
              type="email"
              value={isRegistering ? registerEmail : loginEmail}
            />
          </FieldLabel>

          <FieldLabel>
            <span>{t("password")}</span>
            <Input
              autoComplete={isRegistering ? "new-password" : "current-password"}
              minLength={6}
              onChange={(event) => {
                if (isRegistering) {
                  setRegisterPassword(event.target.value);
                } else {
                  setLoginPassword(event.target.value);
                }

                setPasswordError(null);
              }}
              required
              type="password"
              value={isRegistering ? registerPassword : loginPassword}
            />
          </FieldLabel>

          {isRegistering ? (
            <FieldLabel>
              <span>{t("confirmPassword")}</span>
              <Input
                autoComplete="new-password"
                minLength={6}
                onChange={(event) => {
                  setRegisterConfirmPassword(event.target.value);
                  setPasswordError(null);
                }}
                required
                type="password"
                value={registerConfirmPassword}
              />
            </FieldLabel>
          ) : null}

          {error ? <Alert variant="destructive">{error}</Alert> : null}
          {passwordError ? <Alert variant="destructive">{passwordError}</Alert> : null}
          {notice ? <Alert variant="success">{notice}</Alert> : null}

          <Button disabled={busy} type="submit">
            {busy ? t("loading") : isRegistering ? t("createAccount") : t("login")}
          </Button>
        </form>

        <div className="auth-secondary-actions">
          {!isRegistering ? (
            <Button className="auth-link-button" disabled={busy} onClick={handlePasswordReset} type="button" variant="link">
              {t("forgotPassword")}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
