"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "./useAuth";
import { getPendingUsers, reviewPendingUser, type PendingUser } from "../services/registration.service";

export function usePendingUsers(enabled = true) {
  const { language } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPendingUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const loadedUsers = await getPendingUsers();
      setPendingUsers(loadedUsers);
    } catch (pendingError) {
      setError(
        pendingError instanceof Error
          ? pendingError.message
          : language === "az"
            ? "Gözləyən istifadəçiləri yükləmək mümkün olmadı."
            : "Could not load pending users.",
      );
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    if (enabled) {
      void loadPendingUsers();
    }
  }, [enabled, loadPendingUsers]);

  const reviewUser = async (pendingUserId: string, status: "approved" | "denied", reviewedBy: string) => {
    setReviewing(true);
    setError(null);

    try {
      await reviewPendingUser({ pendingUserId, status, reviewedBy });
      setPendingUsers((currentUsers) => currentUsers.filter((pendingUser) => pendingUser.id !== pendingUserId));
    } catch (pendingError) {
      setError(
        pendingError instanceof Error
          ? pendingError.message
          : language === "az"
            ? "Gözləyən istifadəçini yoxlamaq mümkün olmadı."
            : "Could not review the pending user.",
      );
      throw pendingError;
    } finally {
      setReviewing(false);
    }
  };

  return {
    pendingUsers,
    loading,
    reviewing,
    error,
    refresh: loadPendingUsers,
    reviewUser,
  };
}
