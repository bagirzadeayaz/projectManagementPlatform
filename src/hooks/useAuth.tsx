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
import {
  defaultLanguage,
  normalizeLanguage,
  translate,
  type Language,
  type TranslationKey,
} from "../utils/i18n";

type AuthAction = (credentials: AuthCredentials) => Promise<void>;

type AuthContextValue = {
  user: DbUser | null;
  busy: boolean;
  error: string | null;
  language: Language;
  clearError: () => void;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
  login: AuthAction;
  register: AuthAction;
  sendResetEmail: (email: string) => Promise<unknown>;
  signOut: () => Promise<void>;
  removeProfilePicture: () => Promise<void>;
  updatePersonalization: (update: { name: string; preferences?: Partial<UserPreferences>; photoFile?: File | null }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getStoredLanguage() {
  if (typeof window === "undefined") {
    return defaultLanguage;
  }

  return normalizeLanguage(window.localStorage.getItem("app-language"));
}

function toFriendlyAuthError(error: unknown, language: Language) {
  if (!(error instanceof Error)) {
    return language === "az" ? "Nəsə xəta baş verdi. Zəhmət olmasa, yenidən cəhd edin." : "Something went wrong. Please try again.";
  }

  const message = error.message;

  if (message.includes("auth/invalid-credential")) {
    return language === "az" ? "E-poçt və ya şifrə yanlışdır." : "Email or password is incorrect.";
  }

  if (message.includes("auth/email-already-in-use")) {
    return language === "az" ? "Bu e-poçtla artıq hesab mövcuddur." : "An account already exists with this email.";
  }

  if (message.includes("auth/weak-password")) {
    return language === "az" ? "Şifrə ən azı 6 simvol olmalıdır." : "Password must be at least 6 characters.";
  }

  if (message.includes("auth/invalid-email")) {
    return language === "az" ? "Düzgün e-poçt ünvanı daxil edin." : "Enter a valid email address.";
  }

  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DbUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguageState] = useState<Language>(defaultLanguage);

  const setLanguage = (nextLanguage: Language) => {
    const normalizedLanguage = normalizeLanguage(nextLanguage);

    setLanguageState(normalizedLanguage);

    if (typeof window !== "undefined") {
      window.localStorage.setItem("app-language", normalizedLanguage);
    }
  };

  useEffect(() => {
    setLanguage(getStoredLanguage());
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = user?.preferences.theme ?? "light";
    document.documentElement.lang = language;
  }, [language, user?.preferences.theme]);

  useEffect(() => {
    if (user?.preferences.language) {
      setLanguage(normalizeLanguage(user.preferences.language));
    }
  }, [user?.preferences.language]);

  const runAuthAction = async <Result,>(action: () => Promise<Result>) => {
    setBusy(true);
    setError(null);

    try {
      return await action();
    } catch (authError) {
      setError(toFriendlyAuthError(authError, language));
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
    await runAuthAction(() => registerWithEmail(credentials, language));
  };

  const sendResetEmail = (email: string) => runAuthAction(() => resetPassword(email));

  const signOut = async () => {
    await runAuthAction(logout);
    setUser(null);
  };

  const removeProfilePicture = async () => {
    if (!user) {
      throw new Error(language === "az" ? "Fərdiləşdirməni yeniləmək üçün əvvəlcə daxil olun." : "Sign in before updating personalization.");
    }

    const updatedUser = await runAuthAction(() => removeUserProfilePicture(user));
    setUser(updatedUser);
  };

  const updatePersonalization = async (update: { name: string; preferences?: Partial<UserPreferences>; photoFile?: File | null }) => {
    if (!user) {
      throw new Error(language === "az" ? "Fərdiləşdirməni yeniləmək üçün əvvəlcə daxil olun." : "Sign in before updating personalization.");
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
    setLanguage(normalizeLanguage(updatedUser.preferences.language));
  };

  const value = useMemo(
    () => ({
      user,
      busy,
      error,
      language,
      clearError: () => setError(null),
      setLanguage,
      t: (key: TranslationKey, replacements?: Record<string, string | number>) => translate(language, key, replacements),
      login,
      register,
      sendResetEmail,
      signOut,
      removeProfilePicture,
      updatePersonalization,
    }),
    [user, busy, error, language],
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
