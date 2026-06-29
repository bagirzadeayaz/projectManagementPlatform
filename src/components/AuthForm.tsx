"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "../hooks/useAuth";
import { languageNames, supportedLanguages, type Language } from "../utils/i18n";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { FieldLabel } from "./ui/field";
import { Input } from "./ui/input";
import { Select } from "./ui/select";
import { SignOutConfirmDialog } from "./SignOutConfirmDialog";

type AuthMode = "login" | "register";

const adminCredentials = {
  email: "bagirzadeayaz2005@gmail.com",
  password: "123456",
};

export function AuthForm() {
  const router = useRouter();
  const { user, busy, error, language, setLanguage, t, clearError, login, register, sendResetEmail, signOut } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  const isRegistering = mode === "register";

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setConfirmPassword("");
    setPasswordError(null);
    setNotice(null);
    clearError();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    setPasswordError(null);

    if (isRegistering && password !== confirmPassword) {
      setPasswordError(t("passwordMismatch"));
      return;
    }

    const credentials = { email: email.trim(), password, name: name.trim() };

    try {
      if (isRegistering) {
        await register(credentials);
      } else {
        await login(credentials);
      }

      router.push("/projects");
    } catch {
      // The hook already formats and stores the visible error.
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setNotice(t("enterEmailFirst"));
      return;
    }

    try {
      await sendResetEmail(email.trim());
      setNotice(t("passwordResetSent"));
    } catch {
      // The hook already formats and stores the visible error.
    }
  };

  const handleAdminLogin = async () => {
    setMode("login");
    setEmail(adminCredentials.email);
    setPassword(adminCredentials.password);
    setConfirmPassword("");
    setPasswordError(null);
    setNotice(null);
    clearError();

    try {
      await login(adminCredentials);
      router.push("/projects#admin-panel");
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
          <Button onClick={() => router.push("/projects")} type="button">
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
      <CardContent>

        <Button className="autoAuthAdmin" disabled={busy} type="button" onClick={handleAdminLogin}>
          {busy ? t("loading") : t("adminPanel")}
        </Button>

        <div className="autoAuthAdmin" aria-hidden="true" />

        <div className="auth-header">
          <p className="auth-kicker">{t("workspace")}</p>
          <h1>{isRegistering ? t("createAccount") : t("loginTitle")}</h1>
        </div>

        <div className="auth-tabs" role="tablist" aria-label={t("authMode")}>
          <Button
            aria-selected={!isRegistering}
            className="auth-tab"
            onClick={() => switchMode("login")}
            role="tab"
            type="button"
            variant="ghost"
          >
            {t("login")}
          </Button>
          <Button
            aria-selected={isRegistering}
            className="auth-tab"
            onClick={() => switchMode("register")}
            role="tab"
            type="button"
            variant="ghost"
          >
            {t("register")}
          </Button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegistering ? (
            <FieldLabel>
              <span>{t("name")}</span>
              <Input autoComplete="name" onChange={(event) => setName(event.target.value)} type="text" value={name} required />
            </FieldLabel>
          ) : null}

          <FieldLabel>
            <span>{t("email")}</span>
            <Input autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          </FieldLabel>

          <FieldLabel>
            <span>{t("password")}</span>
            <Input
              autoComplete={isRegistering ? "new-password" : "current-password"}
              minLength={6}
              onChange={(event) => {
                setPassword(event.target.value);
                setPasswordError(null);
              }}
              required
              type="password"
              value={password}
            />
          </FieldLabel>

          {isRegistering ? (
            <FieldLabel>
              <span>{t("confirmPassword")}</span>
              <Input
                autoComplete="new-password"
                minLength={6}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setPasswordError(null);
                }}
                required
                type="password"
                value={confirmPassword}
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

        {!isRegistering ? (
          <Button className="auth-link-button" disabled={busy} onClick={handlePasswordReset} type="button" variant="link">
            {t("forgotPassword")}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
