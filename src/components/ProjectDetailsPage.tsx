"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { useAuth } from "../hooks/useAuth";
import { useProjectUsers } from "../hooks/useProjectUsers";
import {
  deleteProjectTask,
  deleteProjectNote,
  deleteProject,
  generateProjectDescription,
  getProject,
  getProjectNotes,
  getProjectTasks,
  saveProjectNote,
  getTodayDateInputValue,
  isPastDeadline,
  PROJECT_STATUSES,
  TASK_STATUSES,
  updateProject,
  updateProjectTask,
  type Project,
  type ProjectNote,
  type ProjectTask,
} from "../services/project.service";
import type { ProjectUser } from "../services/user.service";
import { getProjectStatusLabel } from "../utils/labels";
import { isAdminRole, isAssignableRole } from "../utils/roles";
import { PageHeader, SectionHeader } from "./AppShell";
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
  return isAdminRole(role);
}

function isAssignableUser(projectUser: { role: string }) {
  return isAssignableRole(projectUser.role);
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

function ProjectNoteAvatar({ note }: { note: ProjectNote }) {
  const [imageFailed, setImageFailed] = useState(false);
  const displayName = note.userName || note.userEmail;
  const showPhoto = Boolean(note.userPhotoURL && !imageFailed);

  return (
    <span className="project-member-avatar project-note-avatar" aria-hidden="true">
      {showPhoto ? (
        <img alt="" src={note.userPhotoURL} onError={() => setImageFailed(true)} />
      ) : (
        <span>{getUserInitials(displayName)}</span>
      )}
    </span>
  );
}

function formatNoteDate(createdAtMs: number, language: string) {
  if (!createdAtMs) {
    return "";
  }

  return new Intl.DateTimeFormat(language === "az" ? "az-AZ" : "en-US", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(createdAtMs));
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
  const [confirmingTaskDelete, setConfirmingTaskDelete] = useState<ProjectTask | null>(null);
  const [confirmingNoteDelete, setConfirmingNoteDelete] = useState<ProjectNote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [descriptionMessage, setDescriptionMessage] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("planned");
  const [deadline, setDeadline] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [userIds, setUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [deadlineError, setDeadlineError] = useState<string | null>(null);
  const [usersSelectionError, setUsersSelectionError] = useState<string | null>(null);
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteDeletingId, setNoteDeletingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskStatusSavingId, setTaskStatusSavingId] = useState<string | null>(null);
  const [taskSavingId, setTaskSavingId] = useState<string | null>(null);
  const [taskDeletingId, setTaskDeletingId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskEditTitle, setTaskEditTitle] = useState("");
  const [taskEditDescription, setTaskEditDescription] = useState("");
  const [taskEditStatus, setTaskEditStatus] = useState("planned");
  const [taskEditDeadline, setTaskEditDeadline] = useState("");
  const [taskEditUserIds, setTaskEditUserIds] = useState<string[]>([]);
  const [taskEditUserSearch, setTaskEditUserSearch] = useState("");
  const [taskError, setTaskError] = useState<string | null>(null);
  const minimumDeadline = getTodayDateInputValue();
  const canDelete = user ? canManageProjects(user.role) : false;
  const isProjectUser = Boolean(user && project?.userIds.includes(user.uid));
  const isProjectLeader = Boolean(user && project?.leaderId === user.uid);
  const canViewAllProjectTasks = canDelete || isProjectLeader;
  const canEditProjectStatus = canDelete || isProjectLeader;
  const canEdit = canEditProjectStatus;
  const canViewNotes = Boolean(project && user && (canViewAllProjectTasks || isProjectUser));
  const canWriteNote = Boolean(project && user && isProjectUser);
  const canEditUsers = canDelete;
  const assignableUsers = users.filter(isAssignableUser);
  const assignableUserIds = new Set(assignableUsers.map((projectUser) => projectUser.uid));
  const projectLeaderUserIds = new Set(users.map((projectUser) => projectUser.uid));
  const normalizedUserSearch = userSearch.trim().toLowerCase();
  const filteredUsers = normalizedUserSearch
    ? assignableUsers.filter((projectUser) =>
        `${projectUser.name} ${projectUser.email}`.toLowerCase().includes(normalizedUserSearch),
      )
    : assignableUsers;
  const currentProjectUserIds = new Set(project?.userIds ?? []);
  const taskAssignableUsers = assignableUsers.filter((projectUser) => currentProjectUserIds.has(projectUser.uid));
  const taskAssignableUserIds = new Set(taskAssignableUsers.map((projectUser) => projectUser.uid));
  const selectedProjectUsers =
    project?.userIds
      .map((projectUserId) => users.find((projectUser) => projectUser.uid === projectUserId))
      .filter((projectUser): projectUser is ProjectUser => Boolean(projectUser)) ?? [];
  const visibleNotes = notes.filter((note) => currentProjectUserIds.has(note.userId));
  const ownNote = user ? visibleNotes.find((note) => note.userId === user.uid) : undefined;
  const visibleTasks = canDelete ? tasks : [];
  const canViewProjectContent = canDelete || isProjectLeader || isProjectUser;
  const normalizedTaskEditUserSearch = taskEditUserSearch.trim().toLowerCase();
  const filteredTaskEditUsers = normalizedTaskEditUserSearch
    ? taskAssignableUsers.filter((projectUser) =>
        `${projectUser.name} ${projectUser.email}`.toLowerCase().includes(normalizedTaskEditUserSearch),
      )
    : taskAssignableUsers;
  const editingTask = editingTaskId ? tasks.find((task) => task.id === editingTaskId) : undefined;

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
        setLeaderId(loadedProject.leaderId);
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

  useEffect(() => {
    if (!project || !user || !canViewNotes) {
      setNotes([]);
      setNoteDraft("");
      return;
    }

    let active = true;

    const loadNotes = async () => {
      setNotesLoading(true);
      setNoteError(null);

      try {
        const loadedNotes = await getProjectNotes(project.id);
        const activeProjectUserIds = new Set(project.userIds);

        if (active) {
          setNotes(loadedNotes.filter((note) => activeProjectUserIds.has(note.userId)));
        }
      } catch (notesError) {
        if (active) {
          setNoteError(notesError instanceof Error ? notesError.message : t("notesLoadFailed"));
        }
      } finally {
        if (active) {
          setNotesLoading(false);
        }
      }
    };

    void loadNotes();

    return () => {
      active = false;
    };
  }, [canViewNotes, project, t, user]);

  useEffect(() => {
    if (!project || !user || !canDelete) {
      setTasks([]);
      return;
    }

    let active = true;

    const loadTasks = async () => {
      setTasksLoading(true);
      setTaskError(null);

      try {
        const loadedTasks = await getProjectTasks(project.id);

        if (active) {
          setTasks(loadedTasks);
        }
      } catch (projectTaskError) {
        if (active) {
          setTaskError(projectTaskError instanceof Error ? projectTaskError.message : t("tasksLoadFailed"));
        }
      } finally {
        if (active) {
          setTasksLoading(false);
        }
      }
    };

    void loadTasks();

    return () => {
      active = false;
    };
  }, [canDelete, project, t, user]);

  useEffect(() => {
    if (!canWriteNote) {
      setNoteDraft("");
      return;
    }

    setNoteDraft(ownNote?.text ?? "");
  }, [canWriteNote, ownNote?.text]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!project || !canEditProjectStatus) {
      return;
    }

    setDeadlineError(null);
    setUsersSelectionError(null);
    setError(null);

    if (canDelete && isPastDeadline(deadline)) {
      setDeadlineError(t("deadlineCannotBePast"));
      return;
    }

    const nextLeaderId = canDelete ? leaderId : project.leaderId;
    const selectedAssignableUserIds = userIds.filter((projectUserId) => assignableUserIds.has(projectUserId));
    const nextUserIds = Array.from(new Set(selectedAssignableUserIds));

    if (canEditUsers && nextUserIds.length === 0) {
      setUsersSelectionError(t("selectProjectUser"));
      return;
    }

    if (canEditUsers && (!nextLeaderId || !projectLeaderUserIds.has(nextLeaderId))) {
      setUsersSelectionError(t("selectProjectLeader"));
      return;
    }

    const update = {
      name: canDelete ? name.trim() || t("projectNameFallback") : project.name,
      description: canDelete ? description.trim() : project.description,
      status: status.trim() || "active",
      deadline: canDelete ? deadline : project.deadline,
      leaderId: nextLeaderId,
      userIds: canEditUsers ? nextUserIds : project.userIds,
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

  const handleAddNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!project || !user || !canWriteNote) {
      return;
    }

    const text = noteDraft.trim();
    setNoteError(null);

    if (!text) {
      setNoteError(t("noteRequired"));
      return;
    }

    setNoteSaving(true);

    try {
      const savedNote = await saveProjectNote(project.id, {
        text,
        userEmail: user.email,
        userId: user.uid,
        userName: user.name || user.email,
        userPhotoURL: user.photoURL,
      });

      setNotes((currentNotes) => [
        savedNote,
        ...currentNotes.filter((currentNote) => currentNote.userId !== savedNote.userId),
      ]);
    } catch (projectNoteError) {
      setNoteError(projectNoteError instanceof Error ? projectNoteError.message : t("noteSaveFailed"));
    } finally {
      setNoteSaving(false);
    }
  };

  const handleDeleteNote = async (noteUserId: string) => {
    if (!project || !user) {
      return;
    }

    const canDeleteNote = canDelete || (canWriteNote && noteUserId === user.uid);

    if (!canDeleteNote) {
      return;
    }

    setNoteDeletingId(noteUserId);
    setNoteError(null);

    try {
      await deleteProjectNote(project.id, noteUserId);
      setNotes((currentNotes) => currentNotes.filter((currentNote) => currentNote.userId !== noteUserId));
      setConfirmingNoteDelete(null);

      if (noteUserId === user.uid) {
        setNoteDraft("");
      }
    } catch (projectNoteError) {
      setNoteError(projectNoteError instanceof Error ? projectNoteError.message : t("noteDeleteFailed"));
    } finally {
      setNoteDeletingId(null);
    }
  };

  const handleTaskStatusChange = async (task: ProjectTask, nextStatus: string) => {
    if (!project || !user || task.status === nextStatus) {
      return;
    }

    if (!TASK_STATUSES.includes(nextStatus as (typeof TASK_STATUSES)[number])) {
      return;
    }

    const canUpdateTask = canDelete || task.userIds.includes(user.uid);

    if (!canUpdateTask) {
      return;
    }

    setTaskStatusSavingId(task.id);
    setTaskError(null);

    try {
      await updateProjectTask(project.id, task.id, {
        title: task.title,
        description: task.description,
        status: nextStatus,
        deadline: task.deadline,
        userIds: task.userIds,
      });
      setTasks((currentTasks) =>
        currentTasks.map((currentTask) =>
          currentTask.id === task.id
            ? { ...currentTask, status: nextStatus, updatedAtMs: Date.now() }
            : currentTask,
        ),
      );
    } catch (projectTaskError) {
      setTaskError(projectTaskError instanceof Error ? projectTaskError.message : t("taskUpdateFailed"));
    } finally {
      setTaskStatusSavingId(null);
    }
  };

  const startEditingTask = (task: ProjectTask) => {
    setTaskError(null);
    setEditingTaskId(task.id);
    setTaskEditTitle(task.title);
    setTaskEditDescription(task.description);
    setTaskEditStatus(TASK_STATUSES.includes(task.status as (typeof TASK_STATUSES)[number]) ? task.status : "active");
    setTaskEditDeadline(task.deadline);
    setTaskEditUserIds(task.userIds.filter((taskUserId) => taskAssignableUserIds.has(taskUserId)));
    setTaskEditUserSearch("");
  };

  const cancelEditingTask = () => {
    setEditingTaskId(null);
    setTaskEditTitle("");
    setTaskEditDescription("");
    setTaskEditStatus("planned");
    setTaskEditDeadline("");
    setTaskEditUserIds([]);
    setTaskEditUserSearch("");
    setTaskError(null);
  };

  const toggleTaskEditUser = (selectedUserId: string) => {
    if (!taskAssignableUserIds.has(selectedUserId)) {
      return;
    }

    setTaskError(null);
    setTaskEditUserIds((currentTaskUserIds) =>
      currentTaskUserIds.includes(selectedUserId)
        ? currentTaskUserIds.filter((currentUserId) => currentUserId !== selectedUserId)
        : [...currentTaskUserIds, selectedUserId],
    );
  };

  const saveTaskEdit = async (task: ProjectTask) => {
    if (!project || !canDelete) {
      return;
    }

    setTaskError(null);

    if (!taskEditTitle.trim()) {
      setTaskError(t("taskTitleRequired"));
      return;
    }

    if (taskEditDeadline && isPastDeadline(taskEditDeadline)) {
      setTaskError(t("deadlineCannotBePast"));
      return;
    }

    const selectedAssignableUserIds = taskEditUserIds.filter((taskUserId) => taskAssignableUserIds.has(taskUserId));

    if (selectedAssignableUserIds.length === 0) {
      setTaskError(t("selectTaskUser"));
      return;
    }

    setTaskSavingId(task.id);

    try {
      const update = {
        title: taskEditTitle.trim(),
        description: taskEditDescription.trim(),
        status: taskEditStatus,
        deadline: taskEditDeadline,
        userIds: selectedAssignableUserIds,
      };

      await updateProjectTask(project.id, task.id, update);

      setTasks((currentTasks) =>
        currentTasks.map((currentTask) =>
          currentTask.id === task.id
            ? { ...currentTask, ...update, updatedAtMs: Date.now() }
            : currentTask,
        ),
      );
      cancelEditingTask();
    } catch (projectTaskError) {
      setTaskError(projectTaskError instanceof Error ? projectTaskError.message : t("taskUpdateFailed"));
    } finally {
      setTaskSavingId(null);
    }
  };

  const handleDeleteTask = async (task: ProjectTask) => {
    if (!project || !canDelete) {
      return;
    }

    setTaskDeletingId(task.id);
    setTaskError(null);

    try {
      await deleteProjectTask(project.id, task.id);
      setTasks((currentTasks) => currentTasks.filter((currentTask) => currentTask.id !== task.id));
      setConfirmingTaskDelete(null);

      if (editingTaskId === task.id) {
        cancelEditingTask();
      }
    } catch (projectTaskError) {
      setTaskError(projectTaskError instanceof Error ? projectTaskError.message : t("taskDeleteFailed"));
    } finally {
      setTaskDeletingId(null);
    }
  };

  const cancelEditing = () => {
    if (project) {
      setName(project.name);
      setDescriptionMessage("");
      setDescription(project.description);
      setStatus(project.status);
      setDeadline(project.deadline);
      setLeaderId(project.leaderId);
      setUserIds(project.userIds);
    }

    setDeadlineError(null);
    setUsersSelectionError(null);
    setGenerationError(null);
    setEditing(false);
  };

  const toggleProjectUser = (selectedUserId: string) => {
    if (!canEditUsers || !assignableUserIds.has(selectedUserId)) {
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
      <PageHeader
        actions={
          <>
          <Link className={buttonVariants({ size: "sm", variant: "secondary" })} href="/projects">
            {t("projects")}
          </Link>
          {canEdit && project ? (
            <Button onClick={() => setEditing(true)} size="sm" type="button">
              {t("edit")}
            </Button>
          ) : null}
          </>
        }
        eyebrow={t("projectDetails")}
        subtitle={project ? <Badge className={getStatusClass(project.status)}>{getProjectStatusLabel(project.status, language)}</Badge> : null}
        title={project?.name || t("project")}
      />

      {loading ? <section className="empty-state">{t("loadingProject")}</section> : null}
      {error ? <Alert variant="destructive">{error}</Alert> : null}

      {!loading && project && !editing && canViewProjectContent ? (
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
            <SectionHeader
              actions={<Badge variant="secondary">{selectedProjectUsers.length || project.userIds.length}</Badge>}
              eyebrow={t("assignedTeam")}
              title={t("participants")}
            />
            {selectedProjectUsers.length > 0 ? (
              <div className="project-member-list">
                {selectedProjectUsers.map((projectUser) => {
                  const displayName = getUserDisplayName(projectUser);

                  return (
                    <div className="project-member-row" key={projectUser.uid}>
                      <ProjectUserAvatar projectUser={projectUser} />
                      <div>
                        <strong>{displayName}</strong>
                        <small>{projectUser.email} - {projectUser.uid === project.leaderId ? t("projectLeader") : t("participant")}</small>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="project-users-note">{t("noUserAssigned")}</p>
            )}
          </section>

          {canDelete ? (
            <section className="project-tasks-panel">
              <SectionHeader
                actions={
                  <div className="project-section-actions">
                    <Badge variant="secondary">{visibleTasks.length}</Badge>
                    <Link className={buttonVariants({ size: "sm" })} href={`/projects/${project.id}/tasks/new`}>
                      {t("createTask")}
                    </Link>
                  </div>
                }
                eyebrow={t("tasks")}
                title={t("projectTasks")}
              />

              {taskError ? <Alert variant="destructive">{taskError}</Alert> : null}
              {tasksLoading ? <p className="project-users-note">{t("loadingTasks")}</p> : null}
              {!tasksLoading && visibleTasks.length === 0 ? <p className="project-users-note">{t("noTasks")}</p> : null}
              {visibleTasks.length > 0 ? (
                <div className="project-task-list">
                  {visibleTasks.map((task) => {
                    const assignedUsers = task.userIds
                      .map((taskUserId) => users.find((projectUser) => projectUser.uid === taskUserId))
                      .filter((projectUser): projectUser is ProjectUser => Boolean(projectUser));

                    return (
                      <article className="project-task-item" key={task.id}>
                        <div className="project-task-item-header">
                          <div>
                            <Badge className={getStatusClass(task.status)}>{getProjectStatusLabel(task.status, language)}</Badge>
                            <h3>{task.title}</h3>
                          </div>
                          <div className="project-task-item-actions">
                            <span>{task.deadline || t("noDeadline")}</span>
                            <Select
                              className={`status-select status-select-${task.status}`}
                              disabled={taskStatusSavingId === task.id}
                              onChange={(event) => void handleTaskStatusChange(task, event.target.value)}
                              value={task.status}
                            >
                              {TASK_STATUSES.map((projectStatus) => (
                                <option key={projectStatus} value={projectStatus}>
                                  {getProjectStatusLabel(projectStatus, language)}
                                </option>
                              ))}
                            </Select>
                          </div>
                        </div>
                        {task.description ? <p>{task.description}</p> : null}
                        <div className="project-task-assignees">
                          {assignedUsers.length > 0 ? (
                            assignedUsers.map((taskUser) => (
                              <span className="project-task-assignee" key={taskUser.uid}>
                                <ProjectUserAvatar projectUser={taskUser} />
                                {taskUser.name || taskUser.email}
                              </span>
                            ))
                          ) : (
                            <span className="project-users-note">{t("noUserAssigned")}</span>
                          )}
                        </div>
                        <div className="project-task-card-actions">
                          <Button disabled={Boolean(taskSavingId) || Boolean(taskDeletingId)} onClick={() => startEditingTask(task)} size="sm" type="button" variant="secondary">
                            {t("edit")}
                          </Button>
                          <Button disabled={Boolean(taskSavingId) || Boolean(taskDeletingId)} onClick={() => setConfirmingTaskDelete(task)} size="sm" type="button" variant="destructive">
                            {taskDeletingId === task.id ? t("deletingTask") : t("deleteTask")}
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </section>
          ) : null}

          {canViewNotes ? (
            <section className="project-notes-panel">
              <SectionHeader
                actions={<Badge variant="secondary">{visibleNotes.length}</Badge>}
                eyebrow={t("project")}
                title={t("notes")}
              />

              {canWriteNote ? (
                <form className="project-note-form" onSubmit={handleAddNote}>
                  <Textarea
                    maxLength={800}
                    onChange={(event) => {
                      setNoteDraft(event.target.value);
                      setNoteError(null);
                    }}
                    placeholder={t("notePlaceholder")}
                    rows={3}
                    value={noteDraft}
                  />
                  <div className="project-note-form-footer">
                    <span className="char-count">{`${noteDraft.length}/800`}</span>
                    <div className="project-note-form-actions">
                      {ownNote ? (
                        <Button disabled={Boolean(noteDeletingId) || noteSaving} onClick={() => setConfirmingNoteDelete(ownNote)} size="sm" type="button" variant="destructive">
                          {noteDeletingId === user.uid ? t("deletingNote") : t("deleteNote")}
                        </Button>
                      ) : null}
                      <Button disabled={noteSaving || Boolean(noteDeletingId) || !noteDraft.trim()} size="sm" type="submit">
                        {noteSaving ? t("savingNote") : ownNote ? t("updateNote") : t("addNote")}
                      </Button>
                    </div>
                  </div>
                </form>
              ) : null}

              {noteError ? <Alert variant="destructive">{noteError}</Alert> : null}
              {notesLoading ? <p className="project-users-note">{t("loadingNotes")}</p> : null}
              {!notesLoading && visibleNotes.length === 0 ? <p className="project-users-note">{t("noNotes")}</p> : null}
              {visibleNotes.length > 0 ? (
                <div className="project-notes-list">
                  {visibleNotes.map((note) => (
                    <article className="project-note-item" key={note.id}>
                      <ProjectNoteAvatar note={note} />
                      <div>
                        <header>
                          <strong>{note.userName || note.userEmail}</strong>
                          <span>{formatNoteDate(note.updatedAtMs, language)}</span>
                        </header>
                        <p>{note.text}</p>
                        <footer className="project-note-item-footer">
                          <small>{t("writtenBy")}: {note.userEmail}</small>
                          {canDelete ? (
                            <Button
                              disabled={Boolean(noteDeletingId)}
                              onClick={() => setConfirmingNoteDelete(note)}
                              size="sm"
                              type="button"
                              variant="destructive"
                            >
                              {noteDeletingId === note.userId ? t("deletingNote") : t("deleteNote")}
                            </Button>
                          ) : null}
                        </footer>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

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

      {!loading && project && editing && canViewProjectContent ? (
        <Card as="form" className="personalization-form project-detail-edit-form" onSubmit={handleSubmit}>
          <CardHeader className="project-edit-header">
            <p className="auth-kicker">{t("editingProject")}</p>
            <CardTitle>{project.name}</CardTitle>
            <CardDescription>{t("projectDetails")}</CardDescription>
          </CardHeader>

          {canDelete ? (
            <FieldLabel>
              <span>{t("name")}</span>
              <Input onChange={(event) => setName(event.target.value)} required type="text" value={name} />
            </FieldLabel>
          ) : null}

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

          {canDelete ? (
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
          ) : null}

          {canDelete ? (
            <FieldLabel>
              <span>{t("projectLeader")}</span>
              <Select
                disabled={users.length === 0}
                onChange={(event) => setLeaderId(event.target.value)}
                required
                value={projectLeaderUserIds.has(leaderId) ? leaderId : ""}
              >
                <option value="">{t("selectProjectLeader")}</option>
                {users.map((projectUser) => (
                  <option key={projectUser.uid} value={projectUser.uid}>
                    {projectUser.name || projectUser.email}
                  </option>
                ))}
              </Select>
            </FieldLabel>
          ) : null}

          {canDelete ? (
            <>
              <fieldset className="project-users-field">
                <legend>{t("participants")}</legend>
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
                {!usersLoading && assignableUsers.length === 0 ? <p className="project-users-note">{t("noActiveUsers")}</p> : null}
                {!usersLoading && assignableUsers.length > 0 && filteredUsers.length === 0 ? (
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
                      <small>{projectUser.uid === leaderId ? t("projectLeader") : projectUser.email}</small>
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
            </>
          ) : null}

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

      {!loading && project && !canViewProjectContent ? <section className="empty-state">{t("noTasks")}</section> : null}
      {!loading && !project && !error ? <section className="empty-state">{t("projectMissing")}</section> : null}

      <Dialog open={Boolean(editingTask && canDelete)}>
        {editingTask ? (
          <DialogContent
            aria-labelledby={`edit-task-${editingTask.id}`}
            className="project-task-edit-dialog"
            onInteractOutside={taskSavingId === editingTask.id ? undefined : cancelEditingTask}
          >
            <DialogHeader>
              <p className="auth-kicker">{t("tasks")}</p>
              <DialogTitle id={`edit-task-${editingTask.id}`}>{t("editTask")}</DialogTitle>
              <DialogDescription>{editingTask.title}</DialogDescription>
            </DialogHeader>

            <div className="project-task-edit-form">
              <div className="project-task-form-grid">
                <FieldLabel>
                  <span>{t("taskTitle")}</span>
                  <Input onChange={(event) => setTaskEditTitle(event.target.value)} required type="text" value={taskEditTitle} />
                </FieldLabel>
                <FieldLabel>
                  <span>{t("status")}</span>
                  <Select className={`status-select status-select-${taskEditStatus}`} onChange={(event) => setTaskEditStatus(event.target.value)} value={taskEditStatus}>
                    {TASK_STATUSES.map((projectStatus) => (
                      <option key={projectStatus} value={projectStatus}>
                        {getProjectStatusLabel(projectStatus, language)}
                      </option>
                    ))}
                  </Select>
                </FieldLabel>
                <FieldLabel>
                  <span>{t("deadline")}</span>
                  <Input min={minimumDeadline} onChange={(event) => setTaskEditDeadline(event.target.value)} type="date" value={taskEditDeadline} />
                </FieldLabel>
              </div>

              <FieldLabel>
                <span>{t("description")}</span>
                <Textarea onChange={(event) => setTaskEditDescription(event.target.value)} rows={3} value={taskEditDescription} />
              </FieldLabel>

              <fieldset className="project-users-field">
                <legend>{t("taskParticipants")}</legend>
                <label className="project-users-search">
                  <span>{t("searchUsers")}</span>
                  <Input
                    onChange={(event) => setTaskEditUserSearch(event.target.value)}
                    placeholder={t("searchUsersPlaceholder")}
                    type="search"
                    value={taskEditUserSearch}
                  />
                </label>
                {filteredTaskEditUsers.length === 0 ? <p className="project-users-note">{t("noMatchingUsers")}</p> : null}
                <div className="project-users-list">
                  {filteredTaskEditUsers.map((projectUser) => (
                    <label className="project-user-option" key={projectUser.uid}>
                      <Checkbox checked={taskEditUserIds.includes(projectUser.uid)} onChange={() => toggleTaskEditUser(projectUser.uid)} />
                      <span>{projectUser.name || projectUser.email}</span>
                      <small>{projectUser.email}</small>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <DialogFooter>
              <Button disabled={taskSavingId === editingTask.id} onClick={cancelEditingTask} type="button" variant="secondary">
                {t("cancel")}
              </Button>
              <Button disabled={taskSavingId === editingTask.id} onClick={() => void saveTaskEdit(editingTask)} type="button">
                {taskSavingId === editingTask.id ? t("saving") : t("save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog open={Boolean(confirmingTaskDelete && canDelete)}>
        {confirmingTaskDelete ? (
          <DialogContent aria-labelledby={`delete-task-${confirmingTaskDelete.id}`}>
            <DialogHeader>
              <p className="auth-kicker">{t("deleteTask")}</p>
              <DialogTitle id={`delete-task-${confirmingTaskDelete.id}`}>
                {t("deleteTaskQuestion", { name: confirmingTaskDelete.title })}
              </DialogTitle>
              <DialogDescription>{t("deleteTaskCopy")}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button disabled={taskDeletingId === confirmingTaskDelete.id} onClick={() => setConfirmingTaskDelete(null)} type="button" variant="secondary">
                {t("cancel")}
              </Button>
              <Button disabled={taskDeletingId === confirmingTaskDelete.id} onClick={() => void handleDeleteTask(confirmingTaskDelete)} type="button" variant="destructive">
                {taskDeletingId === confirmingTaskDelete.id ? t("deletingTask") : t("delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog open={Boolean(confirmingNoteDelete)}>
        {confirmingNoteDelete ? (
          <DialogContent aria-labelledby={`delete-note-${confirmingNoteDelete.id}`}>
            <DialogHeader>
              <p className="auth-kicker">{t("deleteNote")}</p>
              <DialogTitle id={`delete-note-${confirmingNoteDelete.id}`}>
                {t("deleteNoteQuestion", { name: confirmingNoteDelete.userName || confirmingNoteDelete.userEmail })}
              </DialogTitle>
              <DialogDescription>{t("deleteNoteCopy")}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button disabled={noteDeletingId === confirmingNoteDelete.userId} onClick={() => setConfirmingNoteDelete(null)} type="button" variant="secondary">
                {t("cancel")}
              </Button>
              <Button disabled={noteDeletingId === confirmingNoteDelete.userId} onClick={() => void handleDeleteNote(confirmingNoteDelete.userId)} type="button" variant="destructive">
                {noteDeletingId === confirmingNoteDelete.userId ? t("deletingNote") : t("delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog open={Boolean(confirmingDelete && project && canDelete)}>
        {project ? (
          <DialogContent aria-labelledby={`delete-${project.id}`}>
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
