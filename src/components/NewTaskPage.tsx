"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { useAuth } from "../hooks/useAuth";
import { useProjectUsers } from "../hooks/useProjectUsers";
import {
  addProjectTask,
  generateTaskDescription,
  getProject,
  getTodayDateInputValue,
  isPastDeadline,
  isTaskDeadlineAfterProjectDeadline,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Project,
} from "../services/project.service";
import { languageNames, supportedLanguages, type Language } from "../utils/i18n";
import { getProjectStatusLabel, getTaskPriorityLabel } from "../utils/labels";
import { isAdminRole, isAssignableRole } from "../utils/roles";
import { PageHeader } from "./AppShell";
import { AuthForm } from "./AuthForm";
import { Alert } from "./ui/alert";
import { Button, buttonVariants } from "./ui/button";
import { Card } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { FieldLabel } from "./ui/field";
import { Input } from "./ui/input";
import { Select } from "./ui/select";
import { Textarea } from "./ui/textarea";

function canManageProjects(role: string) {
  return isAdminRole(role);
}

function isAssignableUser(projectUser: { role: string }) {
  return isAssignableRole(projectUser.role);
}

type AiResponseLanguage = "auto" | Language;

export function NewTaskPage() {
  const params = useParams<{ projectId?: string | string[] }>();
  const router = useRouter();
  const { user, language, t } = useAuth();
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  const canCreateTask = user ? canManageProjects(user.role) : false;
  const { users, loading: usersLoading, error: usersError } = useProjectUsers(Boolean(user && canCreateTask));
  const [project, setProject] = useState<Project | null>(null);
  const [loadingProject, setLoadingProject] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [descriptionMessage, setDescriptionMessage] = useState("");
  const [descriptionResponseLanguage, setDescriptionResponseLanguage] = useState<AiResponseLanguage>("az");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("planned");
  const [priority, setPriority] = useState("medium");
  const [deadline, setDeadline] = useState("");
  const [taskUserIds, setTaskUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const minimumDeadline = getTodayDateInputValue();
  const assignableUsers = users.filter(isAssignableUser);
  const projectUserIdSet = new Set(project?.userIds ?? []);
  const taskAssignableUsers = assignableUsers.filter((projectUser) => projectUserIdSet.has(projectUser.uid));
  const taskAssignableUserIds = new Set(taskAssignableUsers.map((projectUser) => projectUser.uid));
  const normalizedUserSearch = userSearch.trim().toLowerCase();
  const filteredUsers = normalizedUserSearch
    ? taskAssignableUsers.filter((projectUser) =>
        `${projectUser.name} ${projectUser.email}`.toLowerCase().includes(normalizedUserSearch),
      )
    : taskAssignableUsers;

  useEffect(() => {
    if (!user || !canCreateTask || !projectId) {
      return;
    }

    let active = true;

    const loadProject = async () => {
      setLoadingProject(true);
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
      } catch (projectError) {
        if (active) {
          setError(projectError instanceof Error ? projectError.message : t("projectLoadFailed"));
        }
      } finally {
        if (active) {
          setLoadingProject(false);
        }
      }
    };

    void loadProject();

    return () => {
      active = false;
    };
  }, [canCreateTask, projectId, t, user]);

  const toggleTaskUser = (selectedUserId: string) => {
    if (!taskAssignableUserIds.has(selectedUserId)) {
      return;
    }

    setError(null);
    setTaskUserIds((currentTaskUserIds) =>
      currentTaskUserIds.includes(selectedUserId)
        ? currentTaskUserIds.filter((currentUserId) => currentUserId !== selectedUserId)
        : [...currentTaskUserIds, selectedUserId],
    );
  };

  const handleGenerateDescription = async () => {
    setGenerating(true);
    setGenerationError(null);

    try {
      const generatedDescription = await generateTaskDescription(
        title,
        descriptionMessage,
        project?.name ?? "",
        language,
        descriptionResponseLanguage,
      );
      setDescription(generatedDescription);
    } catch (descriptionError) {
      setGenerationError(descriptionError instanceof Error ? descriptionError.message : t("writeDescriptionFailed"));
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!project || !user || !canCreateTask) {
      return;
    }

    setError(null);

    if (!title.trim()) {
      setError(t("taskTitleRequired"));
      return;
    }

    if (deadline && isPastDeadline(deadline)) {
      setError(t("deadlineCannotBePast"));
      return;
    }

    if (isTaskDeadlineAfterProjectDeadline(deadline, project.deadline)) {
      setError(t("taskDeadlineAfterProjectDeadline"));
      return;
    }

    const selectedAssignableUserIds = taskUserIds.filter((taskUserId) => taskAssignableUserIds.has(taskUserId));

    if (selectedAssignableUserIds.length === 0) {
      setError(t("selectTaskUser"));
      return;
    }

    setSaving(true);

    try {
      await addProjectTask(project.id, {
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        deadline,
        userIds: selectedAssignableUserIds,
        createdBy: user.uid,
      });

      router.push(`/projects/${project.id}`);
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : t("taskCreateFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <main className="auth-page">
        <AuthForm />
      </main>
    );
  }

  if (!canCreateTask) {
    return (
      <main className="projects-page personalization-page">
        <section className="empty-state">{t("notAllowedCreateTasks")}</section>
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
          <Link className={buttonVariants({ size: "sm", variant: "secondary" })} href={project ? `/projects/${project.id}` : "/projects"}>
            {project ? t("projectDetails") : t("projects")}
          </Link>
        }
        eyebrow={t("projectTasks")}
        subtitle={project?.name || t("loadingProject")}
        title={t("createTask")}
      />

      {loadingProject ? <section className="empty-state">{t("loadingProject")}</section> : null}

      {project ? (
        <Card className="personalization-form new-project-form project-task-form" as="form" onSubmit={handleSubmit}>
          <div className="project-task-form-grid">
            <FieldLabel>
              <span>{t("taskTitle")}</span>
              <Input onChange={(event) => setTitle(event.target.value)} required type="text" value={title} />
            </FieldLabel>
            <FieldLabel>
              <span>{t("status")}</span>
              <Select className={`status-select status-select-${status}`} onChange={(event) => setStatus(event.target.value)} value={status}>
                {TASK_STATUSES.map((projectStatus) => (
                  <option key={projectStatus} value={projectStatus}>
                    {getProjectStatusLabel(projectStatus, language)}
                  </option>
                ))}
              </Select>
            </FieldLabel>
            <FieldLabel>
              <span>{t("priority")}</span>
              <Select className={`task-priority-select task-priority-${priority}`} onChange={(event) => setPriority(event.target.value)} value={priority}>
                {TASK_PRIORITIES.map((taskPriority) => (
                  <option key={taskPriority} value={taskPriority}>
                    {getTaskPriorityLabel(taskPriority, language)}
                  </option>
                ))}
              </Select>
            </FieldLabel>
            <FieldLabel>
              <span>{t("deadline")}</span>
              <Input
                max={project.deadline || undefined}
                min={minimumDeadline}
                onChange={(event) => setDeadline(event.target.value)}
                type="date"
                value={deadline}
                required
              />
            </FieldLabel>
          </div>

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
            <span>{t("descriptionAiLanguage")}</span>
            <Select
              onChange={(event) => setDescriptionResponseLanguage(event.target.value as AiResponseLanguage)}
              value={descriptionResponseLanguage}
            >
              <option value="auto">{t("automatic")}</option>
              {supportedLanguages.map((supportedLanguage) => (
                <option key={supportedLanguage} value={supportedLanguage}>
                  {languageNames[supportedLanguage]}
                </option>
              ))}
            </Select>
          </FieldLabel>

          <FieldLabel>
            <span className="field-label-row">
              {t("description")}
              <Button className="inline-ai-button" disabled={generating || !title.trim()} onClick={handleGenerateDescription} size="sm" type="button" variant="secondary">
                {generating ? t("generating") : t("generateWithAi")}
              </Button>
            </span>
            <Textarea maxLength={500} onChange={(event) => setDescription(event.target.value)} rows={5} value={description} />
            <div className="char-count">{`${description.length}/500`}</div>
          </FieldLabel>

          <fieldset className="project-users-field">
            <legend>{t("taskParticipants")}</legend>
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
            {!usersLoading && taskAssignableUsers.length === 0 ? <p className="project-users-note">{t("noActiveUsers")}</p> : null}
            {!usersLoading && taskAssignableUsers.length > 0 && filteredUsers.length === 0 ? (
              <p className="project-users-note">{t("noMatchingUsers")}</p>
            ) : null}
            <div className="project-users-list">
              {filteredUsers.map((projectUser) => (
                <label className="project-user-option" key={projectUser.uid}>
                  <Checkbox checked={taskUserIds.includes(projectUser.uid)} onChange={() => toggleTaskUser(projectUser.uid)} />
                  <span>{projectUser.name || projectUser.email}</span>
                  <small>{projectUser.email}</small>
                </label>
              ))}
            </div>
          </fieldset>

          {generationError ? <Alert variant="destructive">{generationError}</Alert> : null}
          {error ? <Alert variant="destructive">{error}</Alert> : null}
          {usersError ? <Alert variant="destructive">{usersError}</Alert> : null}

          <div className="project-task-form-footer">
            <Button disabled={saving} type="submit">
              {saving ? t("creatingTask") : t("createTask")}
            </Button>
          </div>
        </Card>
      ) : null}
    </main>
  );
}
