"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "../hooks/useAuth";
import { useProjectUsers } from "../hooks/useProjectUsers";
import { useProjects } from "../hooks/useProjects";
import {
  generateProjectDescription,
  getTodayDateInputValue,
  isPastDeadline,
  PROJECT_STATUSES,
} from "../services/project.service";
import { AuthForm } from "./AuthForm";

function canManageProjects(role: string) {
  return role.trim().toLowerCase() === "admin";
}

export function NewProjectPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { users, loading: usersLoading, error: usersError } = useProjectUsers(Boolean(user));
  const { savingId, error, createProject } = useProjects();
  const [name, setName] = useState("");
  const [descriptionMessage, setDescriptionMessage] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("planned");
  const [deadline, setDeadline] = useState("");
  const [userIds, setUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [deadlineError, setDeadlineError] = useState<string | null>(null);
  const [usersSelectionError, setUsersSelectionError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const minimumDeadline = getTodayDateInputValue();
  const normalizedUserSearch = userSearch.trim().toLowerCase();
  const filteredUsers = normalizedUserSearch
    ? users.filter((projectUser) =>
        `${projectUser.name} ${projectUser.email}`.toLowerCase().includes(normalizedUserSearch),
      )
    : users;

  if (!user) {
    return (
      <main className="auth-page">
        <AuthForm />
      </main>
    );
  }

  if (!canManageProjects(user.role)) {
    return (
      <main className="projects-page personalization-page">
        <section className="empty-state">You do not have permission to add projects.</section>
        <Link className="nav-link" href="/projects">
          Back to projects
        </Link>
      </main>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDeadlineError(null);
    setUsersSelectionError(null);

    if (isPastDeadline(deadline)) {
      setDeadlineError("Deadline cannot be in the past.");
      return;
    }

    if (userIds.length === 0) {
      setUsersSelectionError("Select at least one user for this project.");
      return;
    }

    await createProject(
      {
        name: name.trim() || "Untitled project",
        description: description.trim(),
        status,
        deadline,
        userIds,
      },
      user.uid,
    );
    router.push("/projects");
  };

  const toggleProjectUser = (selectedUserId: string) => {
    setUsersSelectionError(null);
    setUserIds((currentUserIds) =>
      currentUserIds.includes(selectedUserId)
        ? currentUserIds.filter((currentUserId) => currentUserId !== selectedUserId)
        : [...currentUserIds, selectedUserId],
    );
  };

  const handleGenerateDescription = async () => {
    setGenerating(true);
    setGenerationError(null);

    try {
      const generatedDescription = await generateProjectDescription(name, descriptionMessage);
      setDescription(generatedDescription);
    } catch (descriptionError) {
      setGenerationError(
        descriptionError instanceof Error ? descriptionError.message : "Could not generate project description.",
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="projects-page personalization-page">
      <header className="projects-header">
        <div>
          <p className="auth-kicker">Admin</p>
          <h1>Add project</h1>
          <p className="projects-subtitle">Create a project in Firestore.</p>
        </div>
        <div className="projects-userbar">
          <Link className="nav-link" href="/projects">
            Projects
          </Link>
        </div>
      </header>

      <form className="personalization-form" onSubmit={handleSubmit}>
        <label className="auth-field">
          <span>Name</span>
          <input onChange={(event) => setName(event.target.value)} required type="text" value={name}/>
        </label>

        <label className="auth-field">
          <span>Status</span>
          <select className={`status-select status-select-${status}`} onChange={(event) => setStatus(event.target.value)} value={status}>
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
          {!usersLoading && users.length === 0 ? <p className="project-users-note">No users found.</p> : null}
          {!usersLoading && users.length > 0 && filteredUsers.length === 0 ? (
            <p className="project-users-note">No users match your search.</p>
          ) : null}
          <div className="project-users-list">
            {filteredUsers.map((projectUser) => (
              <label className="project-user-option" key={projectUser.uid}>
                <input
                  checked={userIds.includes(projectUser.uid)}
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
            <button className="inline-ai-button" disabled={generating || !name.trim()} onClick={handleGenerateDescription} type="button">
              {generating ? "Generating..." : "Generate with AI"}
            </button>
          </span>
          <textarea onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={5} value={description} required/>
          <div className="char-count">
              {`${description?.length || 0}/500`}
          </div>
        </label>

        {generationError ? <p className="auth-message auth-message-error">{generationError}</p> : null}
        {deadlineError ? <p className="auth-message auth-message-error">{deadlineError}</p> : null}
        {usersSelectionError ? <p className="auth-message auth-message-error">{usersSelectionError}</p> : null}
        {usersError ? <p className="auth-message auth-message-error">{usersError}</p> : null}
        {error ? <p className="auth-message auth-message-error">{error}</p> : null}

        <button className="auth-button" disabled={savingId === "new"} type="submit">
          {savingId === "new" ? "Creating..." : "Create project"}
        </button>
      </form>
    </main>
  );
}
