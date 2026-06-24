"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

import {
  type DbUser,
  loginWithEmail,
  logout,
  registerWithEmail,
  removeUserProfilePicture,
  resetPassword,
  updateUserPersonalization,
  uploadUserProfilePicture,
  type AuthCredentials,
  type UserPreferences,
} from "../firebase/auth";

type AuthAction = (credentials: AuthCredentials) => Promise<void>;

type AuthContextValue = {
  user: DbUser | null;
  busy: boolean;
  error: string | null;
  clearError: () => void;
  login: AuthAction;
  register: AuthAction;
  sendResetEmail: (email: string) => Promise<unknown>;
  signOut: () => Promise<void>;
  removeProfilePicture: () => Promise<void>;
  updatePersonalization: (update: { name: string; preferences?: Partial<UserPreferences>; photoFile?: File | null }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toFriendlyAuthError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Something went wrong. Please try again.";
  }

  const message = error.message;

  if (message.includes("auth/invalid-credential")) {
    return "Email or password is incorrect.";
  }

  if (message.includes("auth/email-already-in-use")) {
    return "An account with this email already exists.";
  }

  if (message.includes("auth/weak-password")) {
    return "Password should be at least 6 characters.";
  }

  if (message.includes("auth/invalid-email")) {
    return "Enter a valid email address.";
  }

  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DbUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAuthAction = async <Result,>(action: () => Promise<Result>) => {
    setBusy(true);
    setError(null);

    try {
      return await action();
    } catch (authError) {
      setError(toFriendlyAuthError(authError));
      throw authError;
    } finally {
      setBusy(false);
    }
  };

  const login: AuthAction = async (credentials) => {
    const profile = await runAuthAction(() => loginWithEmail(credentials));
    setUser(profile);
  };

  const register: AuthAction = async (credentials) => {
    await runAuthAction(() => registerWithEmail(credentials));
  };

  const sendResetEmail = (email: string) => runAuthAction(() => resetPassword(email));

  const signOut = async () => {
    await runAuthAction(logout);
    setUser(null);
  };

  const removeProfilePicture = async () => {
    if (!user) {
      throw new Error("Sign in before updating personalization.");
    }

    const updatedUser = await runAuthAction(() => removeUserProfilePicture(user));
    setUser(updatedUser);
  };

  useEffect(() => {
    document.documentElement.dataset.theme = user?.preferences.theme ?? "light";
    document.documentElement.lang = user?.preferences.language ?? "en";
  }, [user?.preferences.language, user?.preferences.theme]);

  const updatePersonalization = async (update: { name: string; preferences?: Partial<UserPreferences>; photoFile?: File | null }) => {
    if (!user) {
      throw new Error("Sign in before updating personalization.");
    }

    const updatedUser = await runAuthAction(async () => {
      const photoURL = update.photoFile ? await uploadUserProfilePicture(user, update.photoFile) : undefined;

      return updateUserPersonalization(user, {
        name: update.name,
        preferences: update.preferences,
        photoURL,
      });
    });
    setUser(updatedUser);
  };

  const value = useMemo(
    () => ({
      user,
      busy,
      error,
      clearError: () => setError(null),
      login,
      register,
      sendResetEmail,
      signOut,
      removeProfilePicture,
      updatePersonalization,
    }),
    [user, busy, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const auth = useContext(AuthContext);

  if (!auth) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return auth;
}
