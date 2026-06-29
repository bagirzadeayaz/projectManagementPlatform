"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "./useAuth";
import { getProjectUsers, type ProjectUser } from "../services/user.service";

export function useProjectUsers(enabled = true) {
  const { t } = useAuth();
  const [users, setUsers] = useState<ProjectUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const loadedUsers = await getProjectUsers();
      setUsers(loadedUsers);
    } catch (usersError) {
      setError(usersError instanceof Error ? usersError.message : t("usersLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (enabled) {
      void loadUsers();
    }
  }, [enabled, loadUsers]);

  return {
    users,
    loading,
    error,
    refresh: loadUsers,
  };
}
