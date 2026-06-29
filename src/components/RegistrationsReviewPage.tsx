"use client";

import { useState } from "react";
import Link from "next/link";

import { useAuth } from "../hooks/useAuth";
import { useProjectUsers } from "../hooks/useProjectUsers";
import { useProjects } from "../hooks/useProjects";
import type { Project } from "../services/project.service";
import { deleteProjectUser, type ProjectUser } from "../services/user.service";
import { AuthForm } from "./AuthForm";

function canManageUsers(role: string) {
  const normalizedRole = role.trim().toLowerCase();

  return normalizedRole === "admin";
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
      setNotice("User deleted from app data and removed from projects.");
    } catch (userError) {
      setDeleteError(userError instanceof Error ? userError.message : "Could not delete user.");
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <section className="admin-panel">
      <div>
        <p className="auth-kicker">Admin</p>
        <h2>Active users</h2>
      </div>

      <label className="auth-field">
        <span>User</span>
        <select onChange={(event) => setSelectedUserId(event.target.value)} value={selectedUserId}>
          <option value="">{loading ? "Loading..." : "Select active user"}</option>
          {users.map((activeUser) => (
            <option key={activeUser.uid} value={activeUser.uid}>
              {activeUser.name || activeUser.email} - {activeUser.email}
            </option>
          ))}
        </select>
      </label>

      {!loading && users.length === 0 ? <p className="project-users-note">No active users found.</p> : null}

      {selectedUser ? (
        <div className="admin-user-details">
          <div className="pending-user-preview">
            <p>Username: {selectedUser.name || "Unnamed user"}</p>
            <span>Email: {selectedUser.email}</span>
            <span>Role: {selectedUser.role}</span>
            <span>Status: {selectedUser.status}</span>
            <span>UID: {selectedUser.uid}</span>
          </div>

          <div>
            <p className="auth-kicker">Projects</p>
            {projectsLoading ? <p className="project-users-note">Loading projects...</p> : null}
            {!projectsLoading && selectedUserProjects.length === 0 ? (
              <p className="project-users-note">This user is not assigned to any projects.</p>
            ) : null}
            {selectedUserProjects.length > 0 ? (
              <div className="admin-user-projects">
                {selectedUserProjects.map((project) => (
                  <Link className="nav-link" href={`/projects/${project.id}`} key={project.id}>
                    {project.name}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <button
            className="auth-button danger-button"
            disabled={selectedUser.uid === currentUserId || deletingUserId === selectedUser.uid}
            onClick={() => setConfirmingDelete(true)}
            type="button"
          >
            {deletingUserId === selectedUser.uid ? "Deleting..." : selectedUser.role === "admin" ? "Cannot delete admin" : "Delete user"}
          </button>
        </div>
      ) : null}

      {error ? <p className="auth-message auth-message-error">{error}</p> : null}
      {projectsError ? <p className="auth-message auth-message-error">{projectsError}</p> : null}
      {deleteError ? <p className="auth-message auth-message-error">{deleteError}</p> : null}
      {notice ? <p className="auth-message auth-message-success">{notice}</p> : null}

      {confirmingDelete && selectedUser ? (
        <div className="confirm-backdrop" role="presentation">
          <section aria-labelledby={`delete-user-${selectedUser.uid}`} aria-modal="true" className="confirm-dialog" role="dialog">
            <div className="confirm-icon" aria-hidden="true">
              !
            </div>
            <div>
              <p className="auth-kicker">Delete user</p>
              <h2 id={`delete-user-${selectedUser.uid}`}>Delete {selectedUser.name || selectedUser.email}?</h2>
              <p className="confirm-copy">
                This removes their Firestore user profile and removes them from project member lists.
              </p>
            </div>
            <div className="project-actions">
              <button className="auth-button auth-button-secondary" onClick={() => setConfirmingDelete(false)} type="button">
                Cancel
              </button>
              <button className="auth-button danger-button" disabled={deletingUserId === selectedUser.uid} onClick={deleteSelectedUser} type="button">
                {deletingUserId === selectedUser.uid ? "Deleting..." : "Delete"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export function RegistrationsReviewPage() {
  const { user } = useAuth();
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
        <section className="empty-state">You do not have permission to manage users.</section>
        <Link className="nav-link" href="/projects">
          Back to projects
        </Link>
      </main>
    );
  }

  return (
    <main className="projects-page personalization-page">
      <header className="projects-header">
        <div>
          <p className="auth-kicker">Admin</p>
          <h1>Users</h1>
          <p className="projects-subtitle">Manage active app users.</p>
        </div>
        <div className="projects-userbar">
          <Link className="nav-link" href="/projects">
            Projects
          </Link>
        </div>
      </header>

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
