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
import { getProjectStatusLabel } from "../utils/labels";
import { AuthForm } from "./AuthForm";
import { Alert } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button, buttonVariants } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { FieldLabel } from "./ui/field";
import { Input } from "./ui/input";
import { Select } from "./ui/select";
import { Textarea } from "./ui/textarea";

function canManageProjects(role: string) {
  return role.trim().toLowerCase() === "admin";
}

function getStatusClass(status: string) {
  return `project-status project-status-${status.toLowerCase()}`;
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

function ProjectUserAvatar({ projectUser }: { projectUser: ProjectUser }) {
  const [imageFailed, setImageFailed] = useState(false);
  const displayName = getUserDisplayName(projectUser);
  const showPhoto = Boolean(projectUser.photoURL && !imageFailed);

  return (
    <span className="project-member-avatar" aria-hidden="true">
      {showPhoto ? (
        <img alt="" src={projectUser.photoURL} onError={() => setImageFailed(true)} />
      ) : (
        <span>{getUserInitials(displayName)}</span>
      )}
    </span>
  );
}

export function ProjectDetailsPage() {
  const params = useParams<{ projectId?: string | string[] }>();
  const router = useRouter();
  const { user, language, t } = useAuth();
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
          setError(t("projectMissing"));
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
          setError(projectError instanceof Error ? projectError.message : t("projectLoadFailed"));
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
  }, [projectId, t, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!project || !canEdit) {
      return;
    }

    setDeadlineError(null);
    setUsersSelectionError(null);
    setError(null);

    if (isPastDeadline(deadline)) {
      setDeadlineError(t("deadlineCannotBePast"));
      return;
    }

    if (canEditUsers && userIds.length === 0) {
      setUsersSelectionError(t("selectProjectUser"));
      return;
    }

    const update = {
      name: name.trim() || t("projectNameFallback"),
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
      setError(projectError instanceof Error ? projectError.message : t("projectSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateDescription = async () => {
    setGeneratingDescription(true);
    setGenerationError(null);

    try {
      const generatedDescription = await generateProjectDescription(name, descriptionMessage, language);
      setDescription(generatedDescription);
    } catch (descriptionError) {
      setGenerationError(descriptionError instanceof Error ? descriptionError.message : t("writeDescriptionFailed"));
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
      setError(projectError instanceof Error ? projectError.message : t("projectDeleteFailed"));
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
          <p className="auth-kicker">{t("projectDetails")}</p>
          <h1>{project?.name || t("project")}</h1>
          {project ? <Badge className={getStatusClass(project.status)}>{getProjectStatusLabel(project.status, language)}</Badge> : null}
        </div>
        <div className="projects-userbar">
          <Link className={buttonVariants({ size: "sm", variant: "secondary" })} href="/projects">
            {t("projects")}
          </Link>
          {canEdit && project ? (
            <Button onClick={() => setEditing(true)} size="sm" type="button">
              {t("edit")}
            </Button>
          ) : null}
        </div>
      </header>

      {loading ? <section className="empty-state">{t("loadingProject")}</section> : null}
      {error ? <Alert variant="destructive">{error}</Alert> : null}

      {!loading && project && !editing ? (
        <Card className="project-detail-panel project-record">
          <div className="project-record-grid">
            <section className="project-record-main">
              <CardHeader>
                <p className="auth-kicker">{t("overview")}</p>
                <CardTitle>{t("description")}</CardTitle>
                <CardDescription>{project.name}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="project-detail-description">{project.description || t("descriptionMissing")}</p>
              </CardContent>
            </section>

            <aside className="project-record-aside" aria-label={t("projectMeta")}>
              <p className="auth-kicker">{t("projectMeta")}</p>
              <div className="project-detail-meta">
                <div>
                  <span>{t("status")}</span>
                  <strong>{getProjectStatusLabel(project.status, language)}</strong>
                </div>
                <div>
                  <span>{t("deadline")}</span>
                  <strong>{project.deadline || t("noDeadline")}</strong>
                </div>
                <div>
                  <span>{t("appUsers")}</span>
                  <strong>{selectedProjectUsers.length || project.userIds.length}</strong>
                </div>
              </div>
            </aside>
          </div>

          <section className="project-team-panel">
            <div className="project-section-heading">
              <div>
                <p className="auth-kicker">{t("assignedTeam")}</p>
                <h2>{t("usersWorkingOnProject")}</h2>
              </div>
              <Badge variant="secondary">{selectedProjectUsers.length || project.userIds.length}</Badge>
            </div>
            {selectedProjectUsers.length > 0 ? (
              <div className="project-member-list">
                {selectedProjectUsers.map((projectUser) => {
                  const displayName = getUserDisplayName(projectUser);

                  return (
                    <div className="project-member-row" key={projectUser.uid}>
                      <ProjectUserAvatar projectUser={projectUser} />
                      <div>
                        <strong>{displayName}</strong>
                        <small>{projectUser.email}</small>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="project-users-note">{t("noUserAssigned")}</p>
            )}
          </section>

          {canEdit ? (
            <CardFooter className="project-detail-actions">
              <Button onClick={() => setEditing(true)} type="button" variant="secondary">
                {t("editProject")}
              </Button>
              {canDelete ? (
                <Button onClick={() => setConfirmingDelete(true)} type="button" variant="destructive">
                  {t("deleteProject")}
                </Button>
              ) : null}
            </CardFooter>
          ) : null}
        </Card>
      ) : null}

      {!loading && project && editing ? (
        <Card as="form" className="personalization-form project-detail-edit-form" onSubmit={handleSubmit}>
          <CardHeader className="project-edit-header">
            <p className="auth-kicker">{t("editingProject")}</p>
            <CardTitle>{project.name}</CardTitle>
            <CardDescription>{t("projectDetails")}</CardDescription>
          </CardHeader>

          <FieldLabel>
            <span>{t("name")}</span>
            <Input onChange={(event) => setName(event.target.value)} required type="text" value={name} />
          </FieldLabel>

          <FieldLabel>
            <span>{t("status")}</span>
            <Select
              className={`status-select status-select-${status}`}
              onChange={(event) => setStatus(event.target.value)}
              required
              value={status}
            >
              {PROJECT_STATUSES.map((projectStatus) => (
                <option key={projectStatus} value={projectStatus}>
                  {getProjectStatusLabel(projectStatus, language)}
                </option>
              ))}
            </Select>
          </FieldLabel>

          <FieldLabel>
            <span>{t("deadline")}</span>
            <Input
              min={minimumDeadline}
              onChange={(event) => {
                setDeadline(event.target.value);
                setDeadlineError(null);
              }}
              required
              type="date"
              value={deadline}
            />
          </FieldLabel>

          <fieldset className="project-users-field">
            <legend>{t("usersWorkingOnProject")}</legend>
            <label className="project-users-search">
              <span>{t("searchUsers")}</span>
              <Input
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder={t("searchUsersPlaceholder")}
                type="search"
                value={userSearch}
              />
            </label>
            {usersLoading ? <p className="project-users-note">{t("loadingUsers")}</p> : null}
            {!usersLoading && users.length === 0 ? <p className="project-users-note">{t("noActiveUsers")}</p> : null}
            {!usersLoading && users.length > 0 && filteredUsers.length === 0 ? (
              <p className="project-users-note">{t("noMatchingUsers")}</p>
            ) : null}
            <div className="project-users-list">
              {filteredUsers.map((projectUser) => (
                <label className="project-user-option" key={projectUser.uid}>
                  <Checkbox
                    checked={userIds.includes(projectUser.uid)}
                    disabled={!canEditUsers}
                    onChange={() => toggleProjectUser(projectUser.uid)}
                  />
                  <span>{projectUser.name || projectUser.email}</span>
                  <small>{projectUser.email}</small>
                </label>
              ))}
            </div>
          </fieldset>

          <FieldLabel>
            <span>{t("descriptionAiMessage")}</span>
            <Textarea
              maxLength={1000}
              onChange={(event) => setDescriptionMessage(event.target.value)}
              placeholder={t("descriptionAiPlaceholder")}
              rows={4}
              value={descriptionMessage}
            />
            <div className="char-count">{`${descriptionMessage.length}/1000`}</div>
          </FieldLabel>

          <FieldLabel>
            <span className="field-label-row">
              {t("description")}
              <Button
                className="inline-ai-button"
                disabled={generatingDescription || !name.trim()}
                onClick={handleGenerateDescription}
                size="sm"
                type="button"
                variant="secondary"
              >
                {generatingDescription ? t("generating") : t("generateWithAi")}
              </Button>
            </span>
            <Textarea onChange={(event) => setDescription(event.target.value)} maxLength={500} required rows={6} value={description} />
            <div className="char-count">{`${description?.length || 0}/500`}</div>
          </FieldLabel>

          {generationError ? <Alert variant="destructive">{generationError}</Alert> : null}
          {deadlineError ? <Alert variant="destructive">{deadlineError}</Alert> : null}
          {usersSelectionError ? <Alert variant="destructive">{usersSelectionError}</Alert> : null}
          {usersError ? <Alert variant="destructive">{usersError}</Alert> : null}

          <div className="project-actions">
            <Button onClick={cancelEditing} type="button" variant="secondary">
              {t("cancel")}
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? t("saving") : t("save")}
            </Button>
          </div>
        </Card>
      ) : null}

      {!loading && !project && !error ? <section className="empty-state">{t("projectMissing")}</section> : null}

      <Dialog open={Boolean(confirmingDelete && project && canDelete)}>
        {project ? (
          <DialogContent aria-labelledby={`delete-${project.id}`}>
            <div className="confirm-icon" aria-hidden="true">
              !
            </div>
            <DialogHeader>
              <p className="auth-kicker">{t("deleteProject")}</p>
              <DialogTitle id={`delete-${project.id}`}>{t("deleteProjectQuestion", { name: project.name })}</DialogTitle>
              <DialogDescription>{t("deleteProjectCopy")}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setConfirmingDelete(false)} type="button" variant="secondary">
                {t("cancel")}
              </Button>
              <Button disabled={deleting} onClick={handleDelete} type="button" variant="destructive">
                {deleting ? t("deleting") : t("delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </main>
  );
}
