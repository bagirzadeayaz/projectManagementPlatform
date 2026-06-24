"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "../hooks/useAuth";
import { SignOutConfirmDialog } from "./SignOutConfirmDialog";

type AuthMode = "login" | "register";

const adminCredentials = {
  email: "bagirzadeayaz2005@gmail.com",
  password: "123456",
};

export function AuthForm() {
  const router = useRouter();
  const { user, busy, error, clearError, login, register, sendResetEmail, signOut } = useAuth();
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
      setPasswordError("Passwords do not match.");
      return;
    }

    const credentials = { email: email.trim(), password, name: name.trim() };

    try {
      if (isRegistering) {
        await register(credentials);
        setNotice("Account created.");
      } else {
        await login(credentials);
        setNotice("Signed in.");
      }

      router.push("/projects");
    } catch {
      // The hook already formats and stores the visible error.
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setNotice("Enter your email first.");
      return;
    }

    try {
      await sendResetEmail(email.trim());
      setNotice("Password reset email sent.");
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
      setNotice("Signed in.");
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
      <section className="auth-card auth-card-signed-in">
        <div>
          <p className="auth-kicker">Signed in</p>
          <h1>{user.name || "Welcome back"}</h1>
          <p className="auth-muted">{user.email}</p>
        </div>
        <button className="auth-button auth-button-secondary" disabled={busy} onClick={() => setConfirmingSignOut(true)} type="button">
          {busy ? "Signing out..." : "Sign out"}
        </button>
        <button className="auth-button" onClick={() => router.push("/projects")} type="button">
          Open projects
        </button>
        {confirmingSignOut ? (
          <SignOutConfirmDialog
            busy={busy}
            onCancel={() => setConfirmingSignOut(false)}
            onConfirm={() => void handleSignOut()}
          />
        ) : null}
      </section>
    );
  }

  return (
    <section className="auth-card">
      <button className="auth-button autoAuthAdmin" disabled={busy} type="button" onClick={handleAdminLogin}>
        {busy ? "Signing in..." : "Admin Panel"}
      </button>


      <div className="autoAuthAdmin" aria-hidden="true" />


      <div className="auth-header">
        <p className="auth-kicker">Project workspace</p>
        <h1>{isRegistering ? "Create account" : "Sign in"}</h1>
      </div>

      <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
        <button
          aria-selected={!isRegistering}
          className="auth-tab"
          onClick={() => switchMode("login")}
          role="tab"
          type="button"
        >
          Sign in
        </button>
        <button
          aria-selected={isRegistering}
          className="auth-tab"
          onClick={() => switchMode("register")}
          role="tab"
          type="button"
        >
          Register
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {isRegistering ? (
          <label className="auth-field">
            <span>Name</span>
            <input
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
              type="text"
              value={name}
              required
            />
          </label>
        ) : null}

        <label className="auth-field">
          <span>Email</span>
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>

        <label className="auth-field">
          <span>Password</span>
          <input
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
        </label>

        {isRegistering ? (
          <label className="auth-field">
            <span>Confirm password</span>
            <input
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
          </label>
        ) : null}

        {error ? <p className="auth-message auth-message-error">{error}</p> : null}
        {passwordError ? <p className="auth-message auth-message-error">{passwordError}</p> : null}
        {notice ? <p className="auth-message auth-message-success">{notice}</p> : null}

        <button className="auth-button" disabled={busy} type="submit">
          {busy ? "Please wait..." : isRegistering ? "Create account" : "Sign in"}
        </button>
      </form>

      {!isRegistering ? (
        <button className="auth-link-button" disabled={busy} onClick={handlePasswordReset} type="button">
          Reset password
        </button>
      ) : null}
    </section>
  );
}
