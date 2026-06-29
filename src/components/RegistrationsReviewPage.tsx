"use client";

import { useState } from "react";
import Link from "next/link";

import { useAuth } from "../hooks/useAuth";
import { useProjectUsers } from "../hooks/useProjectUsers";
import { useProjects } from "../hooks/useProjects";
import type { Project } from "../services/project.service";
import { deleteProjectUser, type ProjectUser } from "../services/user.service";
import { getRoleLabel, getUserStatusLabel } from "../utils/labels";
import { PageHeader } from "./AppShell";
import { AuthForm } from "./AuthForm";
import { Alert } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button, buttonVariants } from "./ui/button";
import { Card } from "./ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { FieldLabel } from "./ui/field";
import { Select } from "./ui/select";
import { Separator } from "./ui/separator";

function canManageUsers(role: string) {
  return role.trim().toLowerCase() === "admin";
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
  users,
  projects,
  loading,
  projectsLoading,
  error,
  projectsError,
  onDeleteUser,
}: {
  currentUserId: string;
  users: ProjectUser[];
  projects: Project[];
  loading: boolean;
  projectsLoading: boolean;
  error: string | null;
  projectsError: string | null;
  onDeleteUser: (uid: string) => Promise<void>;
}) {
  const { language, t } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const selectedUser = users.find((activeUser) => activeUser.uid === selectedUserId);
  const selectedUserProjects = selectedUser
    ? projects.filter((project) => project.userIds.includes(selectedUser.uid))
    : [];

  const deleteSelectedUser = async () => {
    if (!selectedUser || selectedUser.uid === currentUserId) {
      return;
    }

    setDeletingUserId(selectedUser.uid);
    setDeleteError(null);
    setNotice(null);

    try {
      await onDeleteUser(selectedUser.uid);
      setSelectedUserId("");
      setConfirmingDelete(false);
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
        <p className="auth-kicker">{t("admin")}</p>
        <h2>{t("activeUsers")}</h2>
      </div>
      <Separator />

      <FieldLabel>
        <span>{t("user")}</span>
        <Select onChange={(event) => setSelectedUserId(event.target.value)} value={selectedUserId}>
          <option value="">{loading ? t("loading") : t("noUserSelected")}</option>
          {users.map((activeUser) => (
            <option key={activeUser.uid} value={activeUser.uid}>
              {activeUser.name || activeUser.email} - {activeUser.email}
            </option>
          ))}
        </Select>
      </FieldLabel>

      {!loading && users.length === 0 ? <p className="project-users-note">{t("noActiveUsers")}</p> : null}

      {!loading && users.length > 0 ? (
        <div className="admin-users-roster">
          {users.map((activeUser) => {
            const isSelected = activeUser.uid === selectedUserId;

            return (
              <button
                aria-pressed={isSelected}
                className="admin-user-row"
                key={activeUser.uid}
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
            );
          })}
        </div>
      ) : null}

      {selectedUser ? (
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
            <Button
              disabled={selectedUser.uid === currentUserId || deletingUserId === selectedUser.uid || selectedUser.role === "admin"}
              onClick={() => setConfirmingDelete(true)}
              type="button"
              variant="destructive"
            >
              {deletingUserId === selectedUser.uid ? t("deleting") : selectedUser.role === "admin" ? t("adminCannotBeDeleted") : t("deleteUser")}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {projectsError ? <Alert variant="destructive">{projectsError}</Alert> : null}
      {deleteError ? <Alert variant="destructive">{deleteError}</Alert> : null}
      {notice ? <Alert variant="success">{notice}</Alert> : null}

      <Dialog open={Boolean(confirmingDelete && selectedUser)}>
        {selectedUser ? (
          <DialogContent aria-labelledby={`delete-user-${selectedUser.uid}`}>
            <DialogHeader>
              <p className="auth-kicker">{t("deleteUser")}</p>
              <DialogTitle id={`delete-user-${selectedUser.uid}`}>{t("deleteUserQuestion", { name: selectedUser.name || selectedUser.email })}</DialogTitle>
              <DialogDescription>{t("deleteUserCopy")}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setConfirmingDelete(false)} type="button" variant="secondary">
                {t("cancel")}
              </Button>
              <Button disabled={deletingUserId === selectedUser.uid} onClick={deleteSelectedUser} type="button" variant="destructive">
                {deletingUserId === selectedUser.uid ? t("deleting") : t("delete")}
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
  const { users, loading: usersLoading, error: usersError, refresh: refreshUsers } = useProjectUsers(canManage);
  const {
    projects,
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
        eyebrow={t("admin")}
        subtitle={t("manageActiveUsers")}
        title={t("appUsers")}
      />

      <ActiveUsersPanel
        currentUserId={user.uid}
        error={usersError}
        loading={usersLoading}
        onDeleteUser={async (uid) => {
          await deleteProjectUser(uid);
          await refreshUsers();
          await refreshProjects();
        }}
        projects={projects}
        projectsError={projectsError}
        projectsLoading={projectsLoading}
        users={users}
      />
    </main>
  );
}
