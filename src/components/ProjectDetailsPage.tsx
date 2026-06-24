"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { useAuth } from "../hooks/useAuth";
import { useProjectUsers } from "../hooks/useProjectUsers";
import {
  deleteProject,
  generateProjectDescription,
  getProject,
  getTodayDateInputValue,
  isPastDeadline,
  PROJECT_STATUSES,
  updateProject,
  type Project,
} from "../services/project.service";
import type { ProjectUser } from "../services/user.service";
import { AuthForm } from "./AuthForm";

function canManageProjects(role: string) {
  return role.trim().toLowerCase() === "admin";
}

function getStatusClass(status: string) {
  return `project-status project-status-${status.toLowerCase()}`;
}

export function ProjectDetailsPage() {
  const params = useParams<{ projectId?: string | string[] }>();
  const router = useRouter();
  const { user } = useAuth();
  const { users, loading: usersLoading, error: usersError } = useProjectUsers(Boolean(user));
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [descriptionMessage, setDescriptionMessage] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("planned");
  const [deadline, setDeadline] = useState("");
  const [userIds, setUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [deadlineError, setDeadlineError] = useState<string | null>(null);
  const [usersSelectionError, setUsersSelectionError] = useState<string | null>(null);
  const minimumDeadline = getTodayDateInputValue();
  const canDelete = user ? canManageProjects(user.role) : false;
  const isProjectUser = Boolean(user && project?.userIds.includes(user.uid));
  const canEdit = canDelete || isProjectUser;
  const canEditUsers = canDelete;
  const normalizedUserSearch = userSearch.trim().toLowerCase();
  const filteredUsers = normalizedUserSearch
    ? users.filter((projectUser) =>
        `${projectUser.name} ${projectUser.email}`.toLowerCase().includes(normalizedUserSearch),
      )
    : users;
  const selectedProjectUsers =
    project?.userIds
      .map((projectUserId) => users.find((projectUser) => projectUser.uid === projectUserId))
      .filter((projectUser): projectUser is ProjectUser => Boolean(projectUser)) ?? [];

  useEffect(() => {
    if (!user || !projectId) {
      return;
    }

    let active = true;

    const loadProject = async () => {
      setLoading(true);
      setError(null);

      try {
        const loadedProject = await getProject(projectId);

        if (!active) {
          return;
        }

        if (!loadedProject) {
          setProject(null);
          setError("Project not found.");
          return;
        }

        setProject(loadedProject);
        setName(loadedProject.name);
        setDescriptionMessage("");
        setDescription(loadedProject.description);
        setStatus(loadedProject.status);
        setDeadline(loadedProject.deadline);
        setUserIds(loadedProject.userIds);
      } catch (projectError) {
        if (active) {
          setError(projectError instanceof Error ? projectError.message : "Could not load project.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadProject();

    return () => {
      active = false;
    };
  }, [projectId, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!project || !canEdit) {
      return;
    }

    setDeadlineError(null);
    setUsersSelectionError(null);
    setError(null);

    if (isPastDeadline(deadline)) {
      setDeadlineError("Deadline cannot be in the past.");
      return;
    }

    if (canEditUsers && userIds.length === 0) {
      setUsersSelectionError("Select at least one user for this project.");
      return;
    }

    const update = {
      name: name.trim() || "Untitled project",
      description: description.trim(),
      status: status.trim() || "active",
      deadline,
      userIds: canEditUsers ? userIds : project.userIds,
    };

    setSaving(true);

    try {
      await updateProject(project.id, update);
      setProject({ ...project, ...update });
      setEditing(false);
    } catch (projectError) {
      setError(projectError instanceof Error ? projectError.message : "Could not save project.");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateDescription = async () => {
    setGeneratingDescription(true);
    setGenerationError(null);

    try {
      const generatedDescription = await generateProjectDescription(name, descriptionMessage);
      setDescription(generatedDescription);
    } catch (descriptionError) {
      setGenerationError(
        descriptionError instanceof Error ? descriptionError.message : "Could not generate project description.",
      );
    } finally {
      setGeneratingDescription(false);
    }
  };

  const handleDelete = async () => {
    if (!project || !canDelete) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await deleteProject(project.id);
      router.push("/projects");
    } catch (projectError) {
      setError(projectError instanceof Error ? projectError.message : "Could not delete project.");
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const cancelEditing = () => {
    if (project) {
      setName(project.name);
      setDescriptionMessage("");
      setDescription(project.description);
      setStatus(project.status);
      setDeadline(project.deadline);
      setUserIds(project.userIds);
    }

    setDeadlineError(null);
    setUsersSelectionError(null);
    setGenerationError(null);
    setEditing(false);
  };

  const toggleProjectUser = (selectedUserId: string) => {
    if (!canEditUsers) {
      return;
    }

    setUsersSelectionError(null);
    setUserIds((currentUserIds) =>
      currentUserIds.includes(selectedUserId)
        ? currentUserIds.filter((currentUserId) => currentUserId !== selectedUserId)
        : [...currentUserIds, selectedUserId],
    );
  };

  if (!user) {
    return (
      <main className="auth-page">
        <AuthForm />
      </main>
    );
  }

  return (
    <main className="projects-page project-details-page">
      <header className="projects-header">
        <div>
          <p className="auth-kicker">Project details</p>
          <h1>{project?.name || "Project"}</h1>
          {project ? <p className={getStatusClass(project.status)}>{project.status}</p> : null}
        </div>
        <div className="projects-userbar">
          <Link className="nav-link" href="/projects">
            Projects
          </Link>
          {canEdit && project ? (
            <button className="auth-button" onClick={() => setEditing(true)} type="button">
              Edit
            </button>
          ) : null}
        </div>
      </header>

      {loading ? <section className="empty-state">Loading project...</section> : null}
      {error ? <p className="auth-message auth-message-error">{error}</p> : null}

      {!loading && project && !editing ? (
        <section className="project-detail-panel">
          <div className="project-detail-grid">
            <div>
              <p className="auth-kicker">Description</p>
              <p className="project-detail-description">{project.description || "No description provided."}</p>
            </div>
            <div className="project-detail-meta">
              <div>
                <span>Deadline</span>
                <strong>{project.deadline || "No deadline"}</strong>
              </div>
              <div>
                <span>Users</span>
                <strong>{selectedProjectUsers.length || project.userIds.length}</strong>
              </div>
            </div>
          </div>

          <div>
            <p className="auth-kicker">Users working on this project</p>
            {selectedProjectUsers.length > 0 ? (
              <div className="project-users-chips">
                {selectedProjectUsers.map((projectUser) => (
                  <span className="project-user-chip" key={projectUser.uid}>
                    {projectUser.name || projectUser.email}
                  </span>
                ))}
              </div>
            ) : (
              <p className="project-users-note">No users assigned.</p>
            )}
          </div>

          {canEdit ? (
            <div className="project-detail-actions">
              <button className="auth-button auth-button-secondary" onClick={() => setEditing(true)} type="button">
                Edit project
              </button>
              {canDelete ? (
                <button className="auth-button danger-button" onClick={() => setConfirmingDelete(true)} type="button">
                  Delete project
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {!loading && project && editing ? (
        <form className="personalization-form project-detail-edit-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>Name</span>
            <input onChange={(event) => setName(event.target.value)} required type="text" value={name} />
          </label>

          <label className="auth-field">
            <span>Status</span>
            <select
              className={`status-select status-select-${status}`}
              onChange={(event) => setStatus(event.target.value)}
              required
              value={status}
            >
              {PROJECT_STATUSES.map((projectStatus) => (
                <option key={projectStatus} value={projectStatus}>
                  {projectStatus}
                </option>
              ))}
            </select>
          </label>

          <label className="auth-field">
            <span>Deadline</span>
            <input
              min={minimumDeadline}
              onChange={(event) => {
                setDeadline(event.target.value);
                setDeadlineError(null);
              }}
              required
              type="date"
              value={deadline}
            />
          </label>

          <fieldset className="project-users-field">
            <legend>Users working on this project</legend>
            <label className="project-users-search">
              <span>Search users</span>
              <input
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Search by name or email"
                type="search"
                value={userSearch}
              />
            </label>
            {usersLoading ? <p className="project-users-note">Loading users...</p> : null}
            {!usersLoading && users.length === 0 ? <p className="project-users-note">No approved users found.</p> : null}
            {!usersLoading && users.length > 0 && filteredUsers.length === 0 ? (
              <p className="project-users-note">No users match your search.</p>
            ) : null}
            <div className="project-users-list">
              {filteredUsers.map((projectUser) => (
                <label className="project-user-option" key={projectUser.uid}>
                  <input
                    checked={userIds.includes(projectUser.uid)}
                    disabled={!canEditUsers}
                    onChange={() => toggleProjectUser(projectUser.uid)}
                    type="checkbox"
                  />
                  <span>{projectUser.name || projectUser.email}</span>
                  <small>{projectUser.email}</small>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="auth-field">
            <span>Message for AI description</span>
            <textarea
              maxLength={1000}
              onChange={(event) => setDescriptionMessage(event.target.value)}
              placeholder="Add goals, audience, features, or important details for the generated description"
              rows={4}
              value={descriptionMessage}
            />
            <div className="char-count">{`${descriptionMessage.length}/1000`}</div>
          </label>

          <label className="auth-field">
            <span className="field-label-row">
              Description
              <button
                className="inline-ai-button"
                disabled={generatingDescription || !name.trim()}
                onClick={handleGenerateDescription}
                type="button"
              >
                {generatingDescription ? "Generating..." : "Generate with AI"}
              </button>
            </span>
            <textarea onChange={(event) => setDescription(event.target.value)} maxLength={500} required rows={6} value={description} />
            <div className="char-count">
              {`${description?.length || 0}/500`}
            </div>
          </label>

          {generationError ? <p className="auth-message auth-message-error">{generationError}</p> : null}
          {deadlineError ? <p className="auth-message auth-message-error">{deadlineError}</p> : null}
          {usersSelectionError ? <p className="auth-message auth-message-error">{usersSelectionError}</p> : null}
          {usersError ? <p className="auth-message auth-message-error">{usersError}</p> : null}

          <div className="project-actions">
            <button className="auth-button auth-button-secondary" onClick={cancelEditing} type="button">
              Cancel
            </button>
            <button className="auth-button" disabled={saving} type="submit">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      ) : null}

      {!loading && !project && !error ? <section className="empty-state">Project not found.</section> : null}

      {confirmingDelete && project && canDelete ? (
        <div className="confirm-backdrop" role="presentation">
          <section aria-labelledby={`delete-${project.id}`} aria-modal="true" className="confirm-dialog" role="dialog">
            <div className="confirm-icon" aria-hidden="true">
              !
            </div>
            <div>
              <p className="auth-kicker">Delete project</p>
              <h2 id={`delete-${project.id}`}>Delete {project.name}?</h2>
              <p className="confirm-copy">
                This will remove the project from Database. This action cannot be undone from this screen.
              </p>
            </div>
            <div className="project-actions">
              <button className="auth-button auth-button-secondary" onClick={() => setConfirmingDelete(false)} type="button">
                Cancel
              </button>
              <button className="auth-button danger-button" disabled={deleting} onClick={handleDelete} type="button">
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
