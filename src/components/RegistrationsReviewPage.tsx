"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { useAuth } from "../hooks/useAuth";
import { useProjectUsers } from "../hooks/useProjectUsers";
import { useProjects } from "../hooks/useProjects";
import type { Project, ProjectTask } from "../services/project.service";
import { deleteProjectUser, updateProjectUser, type ProjectUser, type ProjectUserUpdate } from "../services/user.service";
import { getRoleLabel, getUserStatusLabel } from "../utils/labels";
import { adminRole, isAdminRole, isSuperAdminRole, normalizeRole, superAdminRole, userRole } from "../utils/roles";
import { PageHeader } from "./AppShell";
import { AuthForm } from "./AuthForm";
import { Alert } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button, buttonVariants } from "./ui/button";
import { Card } from "./ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { FieldLabel } from "./ui/field";
import { Input } from "./ui/input";
import { Select } from "./ui/select";
import { Separator } from "./ui/separator";

function canManageUsers(role: string) {
  return isAdminRole(role);
}

function canDeleteManagedUser(targetUser: ProjectUser, currentUserId: string, currentUserRole: string) {
  if (targetUser.uid === currentUserId) {
    return false;
  }

  if (isSuperAdminRole(currentUserRole)) {
    return true;
  }

  return !isSuperAdminRole(targetUser.role);
}

function getUserDisplayName(projectUser: ProjectUser) {
  return projectUser.name || projectUser.email;
}

function getUserInitials(value: string) {
  const [first = "", second = ""] = value
    .split(/\s+|@/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase());

  return `${first}${second}` || "?";
}

function AdminUserAvatar({ projectUser }: { projectUser: ProjectUser }) {
  const [imageFailed, setImageFailed] = useState(false);
  const displayName = getUserDisplayName(projectUser);
  const showPhoto = Boolean(projectUser.photoURL && !imageFailed);

  return (
    <span className="project-member-avatar admin-user-avatar" aria-hidden="true">
      {showPhoto ? (
        <img alt="" src={projectUser.photoURL} onError={() => setImageFailed(true)} />
      ) : (
        <span>{getUserInitials(displayName)}</span>
      )}
    </span>
  );
}

function ActiveUsersPanel({
  currentUserId,
  currentUserRole,
  users,
  projects,
  tasksByProjectId,
  loading,
  projectsLoading,
  error,
  projectsError,
  onDeleteUser,
  onUpdateUser,
}: {
  currentUserId: string;
  currentUserRole: string;
  users: ProjectUser[];
  projects: Project[];
  tasksByProjectId: Record<string, ProjectTask[]>;
  loading: boolean;
  projectsLoading: boolean;
  error: string | null;
  projectsError: string | null;
  onDeleteUser: (uid: string) => Promise<void>;
  onUpdateUser: (uid: string, update: ProjectUserUpdate) => Promise<void>;
}) {
  const { language, t } = useAuth();
  const isCurrentUserSuperAdmin = isSuperAdminRole(currentUserRole);
  const panelLabel = isCurrentUserSuperAdmin ? t("superAdminPanel") : t("adminPanel");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [editingUserId, setEditingUserId] = useState("");
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [confirmingDeleteUserId, setConfirmingDeleteUserId] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("user");
  const selectedUser = users.find((activeUser) => activeUser.uid === selectedUserId);
  const editingUser = users.find((activeUser) => activeUser.uid === editingUserId);
  const deleteTargetUser = users.find((activeUser) => activeUser.uid === confirmingDeleteUserId);
  const normalizedUserSearch = userSearch.trim().toLowerCase();
  const filteredUsers = users.filter((activeUser) => {
    const normalizedUserRole = normalizeRole(activeUser.role);
    const matchesRole = !roleFilter || normalizedUserRole === roleFilter;
    const matchesSearch =
      !normalizedUserSearch ||
      activeUser.name.toLowerCase().includes(normalizedUserSearch) ||
      activeUser.email.toLowerCase().includes(normalizedUserSearch);

    return matchesRole && matchesSearch;
  });
  const selectedUserProjects = selectedUser
    ? projects.filter((project) =>
        project.userIds.includes(selectedUser.uid) ||
        (tasksByProjectId[project.id] ?? []).some((task) => task.userIds.includes(selectedUser.uid)),
      )
    : [];
  const canAssignSuperAdminRole = Boolean(
    editingUser && isCurrentUserSuperAdmin && editingUser.uid !== currentUserId,
  );
  const canChangeEditingUserRole = Boolean(
    editingUser &&
    editingUser.uid !== currentUserId &&
    (isCurrentUserSuperAdmin || !isSuperAdminRole(editingUser.role)),
  );

  useEffect(() => {
    setEditName(editingUser?.name ?? "");
    setEditEmail(editingUser?.email ?? "");
    setEditRole(normalizeRole(editingUser?.role ?? userRole));
    setEditError(null);
    setNotice(null);
  }, [editingUser?.uid]);

  const saveEditingUser = async () => {
    if (!editingUser) {
      return;
    }

    const nextEmail = editEmail.trim();

    if (!nextEmail) {
      setEditError(t("enterEmailFirst"));
      return;
    }

    setSavingUserId(editingUser.uid);
    setEditError(null);
    setDeleteError(null);
    setNotice(null);

    const update: ProjectUserUpdate = {
      email: nextEmail,
      name: editName.trim(),
    };

    if (canChangeEditingUserRole) {
      const nextRole = normalizeRole(editRole);

      if (nextRole === superAdminRole && !canAssignSuperAdminRole) {
        setEditError(t("notAllowedManageUsers"));
        setSavingUserId(null);
        return;
      }

      update.role = nextRole;
    }

    try {
      await onUpdateUser(editingUser.uid, update);
      setEditingUserId("");
      setNotice(t("userUpdated"));
    } catch (userError) {
      setEditError(userError instanceof Error ? userError.message : t("userUpdateFailed"));
    } finally {
      setSavingUserId(null);
    }
  };

  const deleteSelectedUser = async () => {
    if (!deleteTargetUser) {
      return;
    }

    if (!canDeleteManagedUser(deleteTargetUser, currentUserId, currentUserRole)) {
      setDeleteError(t("notAllowedManageUsers"));
      setConfirmingDeleteUserId("");
      return;
    }

    setDeletingUserId(deleteTargetUser.uid);
    setDeleteError(null);
    setNotice(null);

    try {
      await onDeleteUser(deleteTargetUser.uid);
      if (selectedUserId === deleteTargetUser.uid) {
        setSelectedUserId("");
      }
      if (editingUserId === deleteTargetUser.uid) {
        setEditingUserId("");
      }
      setConfirmingDeleteUserId("");
      setNotice(t("userDeleted"));
    } catch (userError) {
      setDeleteError(userError instanceof Error ? userError.message : t("userDeleteFailed"));
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <Card className="admin-panel">
      <div>
        <p className="auth-kicker">{panelLabel}</p>
        <h2>{t("activeUsers")}</h2>
      </div>
      <Separator />

      <div className="admin-user-filters">
        <FieldLabel>
          <span>{t("searchUsers")}</span>
          <Input
            onChange={(event) => setUserSearch(event.target.value)}
            placeholder={t("searchUsersPlaceholder")}
            type="search"
            value={userSearch}
          />
        </FieldLabel>
        <FieldLabel>
          <span>{t("role")}</span>
          <Select onChange={(event) => setRoleFilter(event.target.value)} value={roleFilter}>
            <option value="">{t("allRoles")}</option>
            <option value={userRole}>{getRoleLabel(userRole, language)}</option>
            <option value={adminRole}>{getRoleLabel(adminRole, language)}</option>
            <option value={superAdminRole}>{getRoleLabel(superAdminRole, language)}</option>
          </Select>
        </FieldLabel>
      </div>

      {!loading && users.length === 0 ? <p className="project-users-note">{t("noActiveUsers")}</p> : null}
      {!loading && users.length > 0 && filteredUsers.length === 0 ? (
        <p className="project-users-note">{t("noMatchingUsers")}</p>
      ) : null}

      {!loading && filteredUsers.length > 0 ? (
        <div className="admin-users-roster">
          {filteredUsers.map((activeUser) => {
            const isSelected = activeUser.uid === selectedUserId;
            const canDeleteUser = canDeleteManagedUser(activeUser, currentUserId, currentUserRole);

            return (
              <div className="admin-user-row-shell" key={activeUser.uid}>
                <button
                  aria-pressed={isSelected}
                  className="admin-user-row"
                  onClick={() => setSelectedUserId(activeUser.uid)}
                  type="button"
                >
                  <AdminUserAvatar projectUser={activeUser} />
                  <span>
                    <strong>{getUserDisplayName(activeUser)}</strong>
                    <small>{activeUser.email}</small>
                  </span>
                  <Badge variant="secondary">{getRoleLabel(activeUser.role, language)}</Badge>
                </button>
                <div className="admin-user-row-actions">
                  <Button
                    onClick={() => {
                      setEditingUserId(activeUser.uid);
                      setDeleteError(null);
                      setNotice(null);
                    }}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    {t("edit")}
                  </Button>
                  <Button
                    disabled={!canDeleteUser || deletingUserId === activeUser.uid}
                    onClick={() => {
                      setConfirmingDeleteUserId(activeUser.uid);
                      setDeleteError(null);
                      setNotice(null);
                    }}
                    size="sm"
                    type="button"
                    variant="destructive"
                  >
                    {deletingUserId === activeUser.uid ? t("deleting") : t("delete")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <Dialog open={Boolean(selectedUser)}>
        {selectedUser ? (
          <DialogContent
            aria-labelledby={`user-details-${selectedUser.uid}`}
            className="admin-user-dialog"
            onInteractOutside={() => setSelectedUserId("")}
          >
            <DialogHeader>
              <p className="auth-kicker">{t("user")}</p>
              <DialogTitle id={`user-details-${selectedUser.uid}`}>{selectedUser.name || t("unnamedUser")}</DialogTitle>
              <DialogDescription>{selectedUser.email}</DialogDescription>
            </DialogHeader>

            <div className="admin-user-details">
          <section className="admin-user-profile-card" aria-label={getUserDisplayName(selectedUser)}>
            <div className="admin-user-profile-header">
              <AdminUserAvatar projectUser={selectedUser} />
              <div>
                <p className="auth-kicker">{t("user")}</p>
                <h3>{selectedUser.name || t("unnamedUser")}</h3>
                <p>{selectedUser.email}</p>
              </div>
              <div className="admin-user-profile-badges">
                <Badge variant="secondary">{getRoleLabel(selectedUser.role, language)}</Badge>
                <Badge variant={selectedUser.status === "active" ? "success" : "secondary"}>
                  {getUserStatusLabel(selectedUser.status, language)}
                </Badge>
              </div>
            </div>

            <dl className="admin-user-data-grid">
              <div>
                <dt>{t("username")}</dt>
                <dd>{selectedUser.name || t("unnamedUser")}</dd>
              </div>
              <div>
                <dt>{t("email")}</dt>
                <dd>{selectedUser.email}</dd>
              </div>
              <div>
                <dt>{t("role")}</dt>
                <dd>{getRoleLabel(selectedUser.role, language)}</dd>
              </div>
              <div>
                <dt>{t("status")}</dt>
                <dd>{getUserStatusLabel(selectedUser.status, language)}</dd>
              </div>
              <div className="admin-user-data-full">
                <dt>{t("userId")}</dt>
                <dd>{selectedUser.uid}</dd>
              </div>
            </dl>
          </section>

          <section className="admin-user-project-panel">
            <div>
              <p className="auth-kicker">{t("projects")}</p>
              <h3>{t("projects")}</h3>
            </div>
            {projectsLoading ? <p className="project-users-note">{t("loadingProjects")}</p> : null}
            {!projectsLoading && selectedUserProjects.length === 0 ? (
              <p className="project-users-note">{t("userHasNoProjects")}</p>
            ) : null}
            {selectedUserProjects.length > 0 ? (
              <div className="admin-user-projects">
                {selectedUserProjects.map((project) => (
                  <Link className={buttonVariants({ size: "sm", variant: "secondary" })} href={`/projects/${project.id}`} key={project.id}>
                    {project.name}
                  </Link>
                ))}
              </div>
            ) : null}
          </section>

          <div className="admin-user-detail-actions">
            <Button onClick={() => setSelectedUserId("")} type="button" variant="secondary">
              {t("cancel")}
            </Button>
          </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {projectsError ? <Alert variant="destructive">{projectsError}</Alert> : null}
      {deleteError ? <Alert variant="destructive">{deleteError}</Alert> : null}
      {!editingUser && editError ? <Alert variant="destructive">{editError}</Alert> : null}
      {notice ? <Alert variant="success">{notice}</Alert> : null}

      <Dialog open={Boolean(editingUser)}>
        {editingUser ? (
          <DialogContent
            aria-labelledby={`edit-user-${editingUser.uid}`}
            className="admin-user-edit-dialog"
            onInteractOutside={() => {
              if (savingUserId !== editingUser.uid) {
                setEditingUserId("");
              }
            }}
          >
            <DialogHeader>
              <p className="auth-kicker">{t("editUser")}</p>
              <DialogTitle id={`edit-user-${editingUser.uid}`}>{editingUser.name || t("unnamedUser")}</DialogTitle>
              <DialogDescription>{editingUser.email}</DialogDescription>
            </DialogHeader>

            <div className="admin-user-edit-grid">
              <FieldLabel>
                <span>{t("username")}</span>
                <Input onChange={(event) => setEditName(event.target.value)} type="text" value={editName} />
              </FieldLabel>
              <FieldLabel>
                <span>{t("email")}</span>
                <Input onChange={(event) => setEditEmail(event.target.value)} required type="email" value={editEmail} />
              </FieldLabel>
              <FieldLabel>
                <span>{t("role")}</span>
                <Select
                  disabled={!canChangeEditingUserRole}
                  onChange={(event) => setEditRole(event.target.value)}
                  value={editRole}
                >
                  <option value={userRole}>{getRoleLabel(userRole, language)}</option>
                  <option value={adminRole}>{getRoleLabel(adminRole, language)}</option>
                  {canAssignSuperAdminRole || normalizeRole(editingUser.role) === superAdminRole ? (
                    <option value={superAdminRole}>{getRoleLabel(superAdminRole, language)}</option>
                  ) : null}
                </Select>
              </FieldLabel>
            </div>

            {editError ? <Alert variant="destructive">{editError}</Alert> : null}

            <DialogFooter>
              <Button
                disabled={savingUserId === editingUser.uid}
                onClick={() => setEditingUserId("")}
                type="button"
                variant="secondary"
              >
                {t("cancel")}
              </Button>
              <Button disabled={savingUserId === editingUser.uid} onClick={() => void saveEditingUser()} type="button">
                {savingUserId === editingUser.uid ? t("saving") : t("save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog open={Boolean(deleteTargetUser)}>
        {deleteTargetUser ? (
          <DialogContent aria-labelledby={`delete-user-${deleteTargetUser.uid}`}>
            <DialogHeader>
              <p className="auth-kicker">{t("deleteUser")}</p>
              <DialogTitle id={`delete-user-${deleteTargetUser.uid}`}>
                {t("deleteUserQuestion", { name: deleteTargetUser.name || deleteTargetUser.email })}
              </DialogTitle>
              <DialogDescription>{t("deleteUserCopy")}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setConfirmingDeleteUserId("")} type="button" variant="secondary">
                {t("cancel")}
              </Button>
              <Button disabled={deletingUserId === deleteTargetUser.uid} onClick={deleteSelectedUser} type="button" variant="destructive">
                {deletingUserId === deleteTargetUser.uid ? t("deleting") : t("delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </Card>
  );
}

export function RegistrationsReviewPage() {
  const { user, t } = useAuth();
  const canManage = user ? canManageUsers(user.role) : false;
  const panelLabel = user && isSuperAdminRole(user.role) ? t("superAdminPanel") : t("admin");
  const { users, loading: usersLoading, error: usersError, refresh: refreshUsers } = useProjectUsers(canManage);
  const {
    projects,
    tasksByProjectId,
    loading: projectsLoading,
    error: projectsError,
    refresh: refreshProjects,
  } = useProjects(canManage);

  if (!user) {
    return (
      <main className="auth-page">
        <AuthForm />
      </main>
    );
  }

  if (!canManage) {
    return (
      <main className="projects-page personalization-page">
        <section className="empty-state">{t("notAllowedManageUsers")}</section>
        <Link className={buttonVariants({ size: "sm", variant: "secondary" })} href="/projects">
          {t("backToProjects")}
        </Link>
      </main>
    );
  }

  return (
    <main className="projects-page personalization-page">
      <PageHeader
        actions={
          <Link className={buttonVariants({ size: "sm", variant: "secondary" })} href="/projects">
            {t("projects")}
          </Link>
        }
        eyebrow={panelLabel}
        subtitle={t("manageActiveUsers")}
        title={t("appUsers")}
      />

      <ActiveUsersPanel
        currentUserId={user.uid}
        currentUserRole={user.role}
        error={usersError}
        loading={usersLoading}
        onDeleteUser={async (uid) => {
          await deleteProjectUser(uid);
          await refreshUsers();
          await refreshProjects();
        }}
        onUpdateUser={async (uid, update) => {
          await updateProjectUser(uid, update);
          await refreshUsers();
          await refreshProjects();
        }}
        projects={projects}
        projectsError={projectsError}
        projectsLoading={projectsLoading}
        tasksByProjectId={tasksByProjectId}
        users={users}
      />
    </main>
  );
}
