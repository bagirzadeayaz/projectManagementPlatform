"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "../hooks/useAuth";
import { useProjectUsers } from "../hooks/useProjectUsers";
import { useProjects } from "../hooks/useProjects";
import { PROJECT_STATUSES, TASK_STATUSES, type Project, type ProjectTask } from "../services/project.service";
import type { ProjectUser } from "../services/user.service";
import { getProjectStatusLabel } from "../utils/labels";
import { isAdminRole } from "../utils/roles";
import { PageHeader } from "./AppShell";
import { AuthForm } from "./AuthForm";
import { Badge } from "./ui/badge";
import { Button, buttonVariants } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { FieldLabel } from "./ui/field";
import { Input } from "./ui/input";
import { Select } from "./ui/select";
import { Separator } from "./ui/separator";
import { Tabs, TabsTrigger } from "./ui/tabs";

type ProjectSort = "deadline-asc" | "deadline-desc" | "name-asc" | "name-desc" | "status-asc";
type ProjectsDashboardView = "all" | "mine" | "statistics" | "archive";
type AdminStatisticsTab = "projects" | "tasks";
type UserTaskItem = {
  canMove: boolean;
  project: Project;
  task: ProjectTask;
};
const archiveCompletedTaskAfterMs = 3 * 24 * 60 * 60 * 1000;

function getUserDisplayName(projectUser: ProjectUser) {
  return projectUser.name || projectUser.email || "User";
}

function DashboardTaskAvatar({ projectUser }: { projectUser: ProjectUser }) {
  const displayName = getUserDisplayName(projectUser);

  if (projectUser.photoURL) {
    return <img alt="" className="task-board-assignee-avatar" draggable={false} src={projectUser.photoURL} />;
  }

  return (
    <span className="task-board-assignee-avatar" aria-hidden="true">
      {displayName.slice(0, 1).toUpperCase()}
    </span>
  );
}

function canEditProjects(role: string) {
  return isAdminRole(role);
}

function getStatusClass(status: string) {
  return `project-status project-status-${status.toLowerCase()}`;
}

function getTaskProgressStatus(status: string) {
  return TASK_STATUSES.includes(status as (typeof TASK_STATUSES)[number]) ? status : "active";
}

function getDeadlineSortValue(project: Project) {
  return project.deadline || "9999-12-31";
}

function countProjects(projects: Project[], status: string) {
  return projects.filter((project) => project.status === status).length;
}

function countTasks(tasks: ProjectTask[], status: string) {
  return tasks.filter((task) => getTaskProgressStatus(task.status) === status).length;
}

function isArchivedTask(task: ProjectTask, nowMs = Date.now()) {
  const archiveDateMs = getTaskArchiveDateMs(task);

  return getTaskProgressStatus(task.status) === "completed" && Boolean(archiveDateMs) && nowMs > archiveDateMs;
}

function getTaskArchiveDateMs(task: ProjectTask) {
  const sourceDateMs = task.statusChangedAtMs || task.updatedAtMs || task.createdAtMs;

  return sourceDateMs > 0 ? sourceDateMs + archiveCompletedTaskAfterMs : 0;
}

function formatTaskArchiveDate(timestampMs: number, language: string) {
  if (!timestampMs) {
    return "";
  }

  return new Intl.DateTimeFormat(language, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(timestampMs));
}

function getPercent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function getDeadlineDistance(deadline: string) {
  if (!deadline) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadlineDate = new Date(`${deadline}T00:00:00`);
  deadlineDate.setHours(0, 0, 0, 0);

  return Math.ceil((deadlineDate.getTime() - today.getTime()) / 86_400_000);
}

function sortProjects(projects: Project[], sort: ProjectSort) {
  return [...projects].sort((firstProject, secondProject) => {
    if (sort === "name-asc") {
      return firstProject.name.localeCompare(secondProject.name);
    }

    if (sort === "name-desc") {
      return secondProject.name.localeCompare(firstProject.name);
    }

    if (sort === "status-asc") {
      return firstProject.status.localeCompare(secondProject.status) || firstProject.name.localeCompare(secondProject.name);
    }

    if (sort === "deadline-desc") {
      return getDeadlineSortValue(secondProject).localeCompare(getDeadlineSortValue(firstProject));
    }

    return getDeadlineSortValue(firstProject).localeCompare(getDeadlineSortValue(secondProject));
  });
}

function AdminStatistics({
  loading,
  onRefresh,
  projects,
  tasksByProjectId,
}: {
  loading: boolean;
  onRefresh: () => void;
  projects: Project[];
  tasksByProjectId: Record<string, ProjectTask[]>;
}) {
  const { language, t } = useAuth();
  const [statisticsTab, setStatisticsTab] = useState<AdminStatisticsTab>("projects");
  const allTasks = projects.flatMap((project) => tasksByProjectId[project.id] ?? []);
  const totalProjects = projects.length;
  const totalTasks = allTasks.length;
  const completedProjects = countProjects(projects, "completed");
  const activeProjects = countProjects(projects, "active");
  const plannedProjects = countProjects(projects, "planned");
  const completedTasks = countTasks(allTasks, "completed");
  const activeTasks = countTasks(allTasks, "active");
  const plannedTasks = countTasks(allTasks, "planned");
  const completionRate = getPercent(completedProjects, totalProjects);
  const taskCompletionRate = getPercent(completedTasks, totalTasks);
  const assignedProjects = projects.filter((project) => project.userIds.length > 0).length;
  const projectsWithoutUsers = totalProjects - assignedProjects;
  const assignedTasks = allTasks.filter((task) => task.userIds.length > 0).length;
  const unassignedTasks = totalTasks - assignedTasks;
  const averageTeamSize = totalProjects > 0
    ? (projects.reduce((total, project) => total + project.userIds.length, 0) / totalProjects).toFixed(1)
    : "0.0";
  const averageTaskAssignees = totalTasks > 0
    ? (allTasks.reduce((total, task) => total + task.userIds.length, 0) / totalTasks).toFixed(1)
    : "0.0";
  const statusRows = PROJECT_STATUSES.map((projectStatus) => {
    const value = countProjects(projects, projectStatus);

    return {
      label: getProjectStatusLabel(projectStatus, language),
      percent: getPercent(value, totalProjects),
      status: projectStatus,
      value,
    };
  });
  const taskStatusRows = TASK_STATUSES.map((taskStatus) => {
    const value = countTasks(allTasks, taskStatus);

    return {
      label: getProjectStatusLabel(taskStatus, language),
      percent: getPercent(value, totalTasks),
      status: taskStatus,
      value,
    };
  });
  const overdueProjects = projects.filter((project) => {
    const distance = getDeadlineDistance(project.deadline);

    return distance !== null && distance < 0;
  }).length;
  const upcomingProjects = projects.filter((project) => {
    const distance = getDeadlineDistance(project.deadline);

    return distance !== null && distance >= 0 && distance <= 7;
  }).length;
  const laterProjects = projects.filter((project) => {
    const distance = getDeadlineDistance(project.deadline);

    return distance !== null && distance > 7;
  }).length;
  const noDeadlineProjects = projects.filter((project) => !project.deadline).length;
  const overdueTasks = allTasks.filter((task) => {
    const distance = getDeadlineDistance(task.deadline);

    return distance !== null && distance < 0;
  }).length;
  const upcomingTasks = allTasks.filter((task) => {
    const distance = getDeadlineDistance(task.deadline);

    return distance !== null && distance >= 0 && distance <= 7;
  }).length;
  const laterTasks = allTasks.filter((task) => {
    const distance = getDeadlineDistance(task.deadline);

    return distance !== null && distance > 7;
  }).length;
  const noDeadlineTasks = allTasks.filter((task) => !task.deadline).length;
  const deadlineRows = [
    { label: t("overdueProjects"), tone: "danger", value: overdueProjects },
    { label: t("upcomingProjects"), tone: "warning", value: upcomingProjects },
    { label: t("laterProjects"), tone: "info", value: laterProjects },
    { label: t("noDeadline"), tone: "muted", value: noDeadlineProjects },
  ];
  const taskDeadlineRows = [
    { label: t("overdueProjects"), tone: "danger", value: overdueTasks },
    { label: t("upcomingProjects"), tone: "warning", value: upcomingTasks },
    { label: t("laterProjects"), tone: "info", value: laterTasks },
    { label: t("noDeadline"), tone: "muted", value: noDeadlineTasks },
  ];
  const kpis = [
    { label: t("totalProjects"), tone: "default", value: totalProjects },
    { label: t("activeProjects"), tone: "success", value: activeProjects },
    { label: t("plannedProjects"), tone: "secondary", value: plannedProjects },
    { label: t("completionRate"), tone: "info", value: `${completionRate}%` },
  ];
  const taskKpis = [
    { label: t("totalTasks"), tone: "default", value: totalTasks },
    { label: t("activeTasks"), tone: "success", value: activeTasks },
    { label: t("plannedTasks"), tone: "secondary", value: plannedTasks },
    { label: t("taskCompletionRate"), tone: "info", value: `${taskCompletionRate}%` },
  ];

  return (
    <section className="admin-statistics" aria-label={t("statistics")}>
      <div className="admin-statistics-heading">
        <div>
          <p className="auth-kicker">{t("statistics")}</p>
          <h2>{statisticsTab === "projects" ? t("projectHealth") : t("taskHealth")}</h2>
          <p>{statisticsTab === "projects" ? t("adminStatisticsSubtitle") : t("taskStatisticsSubtitle")}</p>
        </div>
        <Button disabled={loading} onClick={onRefresh} size="sm" type="button" variant="secondary">
          {loading ? t("refreshing") : t("refresh")}
        </Button>
      </div>

      <Tabs className="admin-statistics-subtabs" aria-label={t("statistics")}>
        <TabsTrigger
          aria-selected={statisticsTab === "projects"}
          onClick={() => setStatisticsTab("projects")}
        >
          {t("projectStats")}
        </TabsTrigger>
        <TabsTrigger
          aria-selected={statisticsTab === "tasks"}
          onClick={() => setStatisticsTab("tasks")}
        >
          {t("taskStats")}
        </TabsTrigger>
      </Tabs>

      {statisticsTab === "projects" ? (
        <>
      <section className="dashboard-summary admin-stat-summary">
        {kpis.map((stat) => (
          <Card className={`dashboard-stat dashboard-stat-${stat.tone}`} key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </Card>
        ))}
      </section>

      <section className="admin-visual-grid">
        <Card className="admin-visual-card">
          <div className="admin-visual-card-header">
            <p className="auth-kicker">{t("status")}</p>
            <h3>{t("statusOverview")}</h3>
          </div>
          <div className="stat-bar-list">
            {statusRows.map((row) => (
              <div className="stat-bar-row" key={row.status}>
                <div className="stat-bar-label">
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
                <progress
                  aria-label={`${row.label}: ${row.percent}%`}
                  className={`stat-bar-progress stat-bar-progress-${row.status}`}
                  max={100}
                  value={row.percent}
                />
              </div>
            ))}
          </div>
        </Card>

        <Card className="admin-visual-card admin-visual-card-center">
          <div className="admin-visual-card-header">
            <p className="auth-kicker">{t("completedProjects")}</p>
            <h3>{t("completionRate")}</h3>
          </div>
          <div className="stats-donut">
            <svg className="stats-donut-chart" viewBox="0 0 120 120" aria-hidden="true">
              <circle className="stats-donut-track" cx="60" cy="60" r="50" pathLength="100" />
              <circle className="stats-donut-value" cx="60" cy="60" r="50" pathLength="100" strokeDasharray={`${completionRate} 100`} />
            </svg>
            <span className="stats-donut-value-label">{completionRate}%</span>
            <progress className="stats-donut-progress" aria-label={t("completionRate")} max={100} value={completionRate} />
          </div>
          <p className="stats-donut-copy">
            {completedProjects} / {totalProjects}
          </p>
        </Card>

        <Card className="admin-visual-card">
          <div className="admin-visual-card-header">
            <p className="auth-kicker">{t("deadline")}</p>
            <h3>{t("deadlineHealth")}</h3>
          </div>
          <div className="deadline-health-list">
            {deadlineRows.map((row) => (
              <div className={`deadline-health-item deadline-health-item-${row.tone}`} key={row.label}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </Card>

        <Card className="admin-visual-card">
          <div className="admin-visual-card-header">
            <p className="auth-kicker">{t("assignedTeam")}</p>
            <h3>{t("teamLoad")}</h3>
          </div>
          <div className="team-load-grid">
            <div>
              <span>{t("assignedProjects")}</span>
              <strong>{assignedProjects}</strong>
            </div>
            <div>
              <span>{t("projectsWithoutUsers")}</span>
              <strong>{projectsWithoutUsers}</strong>
            </div>
            <div>
              <span>{t("averageTeamSize")}</span>
              <strong>{averageTeamSize}</strong>
            </div>
          </div>
        </Card>
      </section>
        </>
      ) : null}

      {statisticsTab === "tasks" ? (
        <>
      <section className="dashboard-summary admin-stat-summary">
        {taskKpis.map((stat) => (
          <Card className={`dashboard-stat dashboard-stat-${stat.tone}`} key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </Card>
        ))}
      </section>

      <section className="admin-visual-grid">
        <Card className="admin-visual-card">
          <div className="admin-visual-card-header">
            <p className="auth-kicker">{t("tasks")}</p>
            <h3>{t("taskStatusOverview")}</h3>
          </div>
          <div className="stat-bar-list">
            {taskStatusRows.map((row) => (
              <div className="stat-bar-row" key={row.status}>
                <div className="stat-bar-label">
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
                <progress
                  aria-label={`${row.label}: ${row.percent}%`}
                  className={`stat-bar-progress stat-bar-progress-${row.status}`}
                  max={100}
                  value={row.percent}
                />
              </div>
            ))}
          </div>
        </Card>

        <Card className="admin-visual-card admin-visual-card-center">
          <div className="admin-visual-card-header">
            <p className="auth-kicker">{t("completedTasks")}</p>
            <h3>{t("taskCompletionRate")}</h3>
          </div>
          <div className="stats-donut">
            <svg className="stats-donut-chart" viewBox="0 0 120 120" aria-hidden="true">
              <circle className="stats-donut-track" cx="60" cy="60" r="50" pathLength="100" />
              <circle className="stats-donut-value" cx="60" cy="60" r="50" pathLength="100" strokeDasharray={`${taskCompletionRate} 100`} />
            </svg>
            <span className="stats-donut-value-label">{taskCompletionRate}%</span>
            <progress className="stats-donut-progress" aria-label={t("taskCompletionRate")} max={100} value={taskCompletionRate} />
          </div>
          <p className="stats-donut-copy">
            {completedTasks} / {totalTasks}
          </p>
        </Card>

        <Card className="admin-visual-card">
          <div className="admin-visual-card-header">
            <p className="auth-kicker">{t("deadline")}</p>
            <h3>{t("taskDeadlineHealth")}</h3>
          </div>
          <div className="deadline-health-list">
            {taskDeadlineRows.map((row) => (
              <div className={`deadline-health-item deadline-health-item-${row.tone}`} key={row.label}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </Card>

        <Card className="admin-visual-card">
          <div className="admin-visual-card-header">
            <p className="auth-kicker">{t("taskParticipants")}</p>
            <h3>{t("taskLoad")}</h3>
          </div>
          <div className="team-load-grid">
            <div>
              <span>{t("assignedTasks")}</span>
              <strong>{assignedTasks}</strong>
            </div>
            <div>
              <span>{t("unassignedTasks")}</span>
              <strong>{unassignedTasks}</strong>
            </div>
            <div>
              <span>{t("averageTaskAssignees")}</span>
              <strong>{averageTaskAssignees}</strong>
            </div>
          </div>
        </Card>
      </section>
        </>
      ) : null}
    </section>
  );
}

function ProjectCard({
  actionLabel,
  href,
  project,
  tasks,
}: {
  actionLabel?: string;
  href?: string;
  project: Project;
  tasks: ProjectTask[];
}) {
  const { language, t } = useAuth();

  return (
    <Card className="project-card project-card-link">
      <Link className="project-card-anchor" href={href ?? `/projects/${project.id}`}>
        <CardHeader className="project-card-header">
          <div>
            <Badge className={getStatusClass(project.status)}>{getProjectStatusLabel(project.status, language)}</Badge>
            <CardTitle>{project.name}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="project-description">{project.description || t("descriptionMissing")}</p>
          <p className="project-task-count">{t("tasksShown", { count: tasks.length })}</p>
        </CardContent>
        <CardFooter className="project-card-footer">
          {project.deadline ? <p className="project-meta">{t("deadline")}: {project.deadline}</p> : <p className="project-meta">{t("noDeadline")}</p>}
          <span className="project-open-text">{actionLabel ?? t("openDetails")}</span>
        </CardFooter>
      </Link>
    </Card>
  );
}

function UserTaskBoard({
  items,
  loading,
  onMoveTask,
  savingTaskId,
  users,
}: {
  items: UserTaskItem[];
  loading: boolean;
  onMoveTask: (projectId: string, taskId: string, status: string) => Promise<void>;
  savingTaskId: string | null;
  users: ProjectUser[];
}) {
  const { language, t } = useAuth();
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragReadyTaskId, setDragReadyTaskId] = useState<string | null>(null);
  const [selectedTaskItem, setSelectedTaskItem] = useState<UserTaskItem | null>(null);
  const didDragRef = useRef(false);
  const longPressClickBlockRef = useRef(false);
  const pressPointRef = useRef<{ taskId: string; x: number; y: number } | null>(null);
  const userById = new Map(users.map((projectUser) => [projectUser.uid, projectUser]));

  const getColumnItems = (status: string) => items.filter((item) => getTaskProgressStatus(item.task.status) === status);
  const selectedAssignedUsers = selectedTaskItem
    ? selectedTaskItem.task.userIds
      .map((taskUserId) => userById.get(taskUserId))
      .filter((projectUser): projectUser is ProjectUser => Boolean(projectUser))
    : [];
  const clearDragStateSoon = () => {
    window.setTimeout(() => {
      setDragReadyTaskId(null);
    }, 120);
  };

  return (
    <>
      <section className="task-board" aria-label={t("myTasks")}>
        {TASK_STATUSES.map((status) => {
          const columnItems = getColumnItems(status);

          return (
            <section
              className="task-board-column"
              key={status}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const transferValue = event.dataTransfer.getData("application/json");
                setDragReadyTaskId(null);

                if (!transferValue) {
                  return;
                }

                const draggedTask = JSON.parse(transferValue) as { projectId: string; status: string; taskId: string };
                const sourceTask = items.find((item) => item.project.id === draggedTask.projectId && item.task.id === draggedTask.taskId);

                setDraggingTaskId(null);

                if (!sourceTask?.canMove) {
                  return;
                }

                if (draggedTask.status !== status) {
                  void onMoveTask(draggedTask.projectId, draggedTask.taskId, status);
                }
              }}
            >
              <header className="task-board-column-header">
                <div>
                  <p className="auth-kicker">{t("progress")}</p>
                  <h2>{getProjectStatusLabel(status, language)}</h2>
                </div>
                <Badge variant="secondary">{columnItems.length}</Badge>
              </header>

              <div className="task-board-list">
                {columnItems.map(({ canMove, project, task }) => {
                  const canTryDragTask = !loading && savingTaskId !== task.id;
                  const canStartDragTask = canMove && canTryDragTask;
                  const assignedUsers = task.userIds
                    .map((taskUserId) => userById.get(taskUserId))
                    .filter((projectUser): projectUser is ProjectUser => Boolean(projectUser));
                  const taskItem = { canMove, project, task };

                  return (
                    <article
                      className={`task-board-card${draggingTaskId === task.id ? " task-board-card-dragging" : ""}${canMove ? "" : " task-board-card-readonly"}${dragReadyTaskId === task.id ? " task-board-card-drag-ready" : ""}`}
                      draggable={canStartDragTask}
                      key={task.id}
                      onClick={() => {
                        if (didDragRef.current || longPressClickBlockRef.current) {
                          didDragRef.current = false;
                          longPressClickBlockRef.current = false;
                          return;
                        }

                        setSelectedTaskItem(taskItem);
                      }}
                      onDragEnd={() => {
                        setDraggingTaskId(null);
                        setDragReadyTaskId(null);
                      }}
                      onDragStart={(event) => {
                        if (!canStartDragTask) {
                          event.preventDefault();
                          return;
                        }

                        didDragRef.current = true;
                        longPressClickBlockRef.current = true;
                        setDraggingTaskId(task.id);
                        setDragReadyTaskId(task.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("application/json", JSON.stringify({
                          projectId: project.id,
                          status: getTaskProgressStatus(task.status),
                          taskId: task.id,
                        }));
                      }}
                      onPointerCancel={() => {
                        pressPointRef.current = null;
                        setDragReadyTaskId(null);
                      }}
                      onPointerDown={(event) => {
                        if (event.pointerType === "mouse" && event.button !== 0) {
                          return;
                        }

                        didDragRef.current = false;
                        longPressClickBlockRef.current = false;
                        pressPointRef.current = { taskId: task.id, x: event.clientX, y: event.clientY };

                        if (!canStartDragTask) {
                          setDragReadyTaskId(null);
                          return;
                        }

                        setDragReadyTaskId(task.id);
                      }}
                      onPointerMove={(event) => {
                        const pressPoint = pressPointRef.current;

                        if (!pressPoint || pressPoint.taskId !== task.id) {
                          return;
                        }

                        const movedDistance = Math.hypot(event.clientX - pressPoint.x, event.clientY - pressPoint.y);

                        if (movedDistance > 3) {
                          longPressClickBlockRef.current = true;

                          if (canStartDragTask) {
                            setDragReadyTaskId(task.id);
                          }
                        }
                      }}
                      onPointerUp={() => {
                        pressPointRef.current = null;
                        clearDragStateSoon();
                      }}
                    >
                      <div className="task-board-card-header">
                        <Badge className={getStatusClass(task.status)}>{getProjectStatusLabel(task.status, language)}</Badge>
                        {savingTaskId === task.id ? <span>{t("saving")}</span> : null}
                      </div>
                      <h3>{task.title}</h3>
                      <p className={task.description ? "" : "task-board-description-empty"}>
                        {task.description || t("descriptionMissing")}
                      </p>
                      <div className="task-board-assignees" aria-label={t("taskParticipants")}>
                        {assignedUsers.length > 0 ? (
                          assignedUsers.map((taskUser) => (
                            <span className="task-board-assignee" key={taskUser.uid}>
                              <DashboardTaskAvatar projectUser={taskUser} />
                              {getUserDisplayName(taskUser)}
                            </span>
                          ))
                        ) : (
                          <span className="task-board-unassigned">{t("noUserAssigned")}</span>
                        )}
                      </div>
                      <footer>
                        <strong>{project.name}</strong>
                        <span>{task.deadline || t("noDeadline")}</span>
                      </footer>
                    </article>
                  );
                })}

                {!loading && columnItems.length === 0 ? <p className="task-board-empty">{t("noTasks")}</p> : null}
              </div>
            </section>
          );
        })}
      </section>

      <Dialog open={Boolean(selectedTaskItem)}>
        {selectedTaskItem ? (
          <DialogContent
            aria-labelledby={`task-details-${selectedTaskItem.task.id}`}
            className="task-details-dialog"
            onInteractOutside={() => setSelectedTaskItem(null)}
          >
            <DialogHeader>
              <p className="auth-kicker">{selectedTaskItem.project.name}</p>
              <DialogTitle id={`task-details-${selectedTaskItem.task.id}`}>{selectedTaskItem.task.title}</DialogTitle>
              <DialogDescription>
                {getProjectStatusLabel(selectedTaskItem.task.status, language)} - {selectedTaskItem.task.deadline || t("noDeadline")}
              </DialogDescription>
            </DialogHeader>

            <div className="task-details-content">
              <section>
                <span>{t("description")}</span>
                <p>{selectedTaskItem.task.description || t("descriptionMissing")}</p>
              </section>

              <section>
                <span>{t("taskParticipants")}</span>
                <div className="task-board-assignees">
                  {selectedAssignedUsers.length > 0 ? (
                    selectedAssignedUsers.map((taskUser) => (
                      <span className="task-board-assignee" key={taskUser.uid}>
                        <DashboardTaskAvatar projectUser={taskUser} />
                        {getUserDisplayName(taskUser)}
                      </span>
                    ))
                  ) : (
                    <span className="task-board-unassigned">{t("noUserAssigned")}</span>
                  )}
                </div>
              </section>
            </div>

            <DialogFooter>
              <Button onClick={() => setSelectedTaskItem(null)} type="button" variant="secondary">
                {t("cancel")}
              </Button>
              <Link className="task-details-project-link" href={`/projects/${selectedTaskItem.project.id}`}>
                {t("openDetails")}
              </Link>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}

function ArchivedTaskList({
  items,
  onRestoreTask,
  savingTaskId,
  users,
}: {
  items: UserTaskItem[];
  onRestoreTask: (projectId: string, taskId: string) => Promise<void>;
  savingTaskId: string | null;
  users: ProjectUser[];
}) {
  const { language, t } = useAuth();
  const userById = new Map(users.map((projectUser) => [projectUser.uid, projectUser]));

  return (
    <section className="archive-task-list" aria-label={t("archivedTasks")}>
      {items.map(({ project, task }) => {
        const assignedUsers = task.userIds
          .map((taskUserId) => userById.get(taskUserId))
          .filter((projectUser): projectUser is ProjectUser => Boolean(projectUser));
        const isRestoring = savingTaskId === task.id;

        return (
          <Card className="archive-task-card" key={`${project.id}-${task.id}`}>
            <CardHeader className="archive-task-card-header">
              <div className="archive-task-card-kicker">
                <Badge className={getStatusClass(task.status)}>{getProjectStatusLabel(task.status, language)}</Badge>
                <span>{formatTaskArchiveDate(task.statusChangedAtMs, language)}</span>
              </div>
              <CardTitle>{task.title}</CardTitle>
            </CardHeader>
            <CardContent className="archive-task-card-content">
              <p>{task.description || t("descriptionMissing")}</p>
              <div className="task-board-assignees" aria-label={t("taskParticipants")}>
                {assignedUsers.length > 0 ? (
                  assignedUsers.map((taskUser) => (
                    <span className="task-board-assignee" key={taskUser.uid}>
                      <DashboardTaskAvatar projectUser={taskUser} />
                      {getUserDisplayName(taskUser)}
                    </span>
                  ))
                ) : (
                  <span className="task-board-unassigned">{t("noUserAssigned")}</span>
                )}
              </div>
            </CardContent>
            <CardFooter className="archive-task-card-footer">
              <div className="archive-task-meta">
                <div>
                  <span>{t("project")}</span>
                  <strong>{project.name}</strong>
                </div>
                <div>
                  <span>{t("deadline")}</span>
                  <strong>{task.deadline || t("noDeadline")}</strong>
                </div>
              </div>
              <div className="archive-task-actions">
                <Button
                  disabled={isRestoring}
                  onClick={() => void onRestoreTask(project.id, task.id)}
                  size="sm"
                  type="button"
                >
                  {isRestoring ? t("restoringTask") : t("restoreTask")}
                </Button>
                <Link className={buttonVariants({ size: "sm", variant: "secondary" })} href={`/projects/${project.id}`}>
                  {t("openDetails")}
                </Link>
              </div>
            </CardFooter>
          </Card>
        );
      })}
    </section>
  );
}

export function ProjectsDashboard({ view = "all" }: { view?: ProjectsDashboardView }) {
  const { user, language, t } = useAuth();
  const { projects, tasksByProjectId, loading, error, refresh, saveTaskStatus, savingTaskId } = useProjects();
  const { users } = useProjectUsers(Boolean(user));
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectSort, setProjectSort] = useState<ProjectSort>("deadline-asc");

  if (!user) {
    return (
      <main className="auth-page">
        <AuthForm />
      </main>
    );
  }

  const canEdit = canEditProjects(user.role);
  const isMyProjectsView = view === "mine";
  const isArchiveView = view === "archive";
  const isStatisticsView = view === "statistics";
  const isAdminStatisticsView = canEdit && isStatisticsView;
  const canSeeAllProjectTasks = (project: Project) => canEdit || project.leaderId === user.uid;
  const canAccessProjectTasks = (project: Project) =>
    canSeeAllProjectTasks(project) ||
    project.userIds.includes(user.uid) ||
    (tasksByProjectId[project.id] ?? []).some((task) => task.userIds.includes(user.uid));
  const visibleProjects = canEdit
    ? projects
    : projects.filter(canAccessProjectTasks);
  const selectedProjectParam = searchParams.get("projectId") ?? "all";
  const projectFilterId = visibleProjects.some((project) => project.id === selectedProjectParam)
    ? selectedProjectParam
    : "all";
  const userProjectOptions = sortProjects(visibleProjects, "deadline-asc");
  const nowMs = Date.now();
  const userTaskItems = visibleProjects.flatMap((project) =>
    (tasksByProjectId[project.id] ?? [])
      .filter((task) => canSeeAllProjectTasks(project) || task.userIds.includes(user.uid))
      .map((task) => ({ canMove: canEdit || task.userIds.includes(user.uid), project, task })),
  );
  const archiveTaskItems = visibleProjects.flatMap((project) =>
    (tasksByProjectId[project.id] ?? [])
      .filter((task) => canEdit || task.userIds.includes(user.uid))
      .map((task) => ({ canMove: false, project, task })),
  );
  const scopedUserTaskItems = projectFilterId === "all"
    ? userTaskItems
    : userTaskItems.filter(({ project }) => project.id === projectFilterId);
  const scopedArchiveTaskItems = projectFilterId === "all"
    ? archiveTaskItems
    : archiveTaskItems.filter(({ project }) => project.id === projectFilterId);
  const activeScopedUserTaskItems = scopedUserTaskItems.filter(({ task }) => !isArchivedTask(task, nowMs));
  const archivedScopedTaskItems = scopedArchiveTaskItems.filter(({ task }) => isArchivedTask(task, nowMs));
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredProjects = sortProjects(
    visibleProjects.filter((project) => {
      const matchesSearch = normalizedSearchQuery
        ? `${project.name} ${project.description} ${project.status} ${project.deadline}`.toLowerCase().includes(normalizedSearchQuery)
        : true;
      const matchesStatus = statusFilter === "all" || project.status === statusFilter;

      return matchesSearch && matchesStatus;
    }),
    projectSort,
  );
  const matchesTaskSearch = ({ project, task }: UserTaskItem) => {
    if (!normalizedSearchQuery) {
      return true;
    }

    return `${project.name} ${task.title} ${task.description} ${task.status} ${task.deadline}`.toLowerCase().includes(normalizedSearchQuery);
  };
  const filteredUserTaskItems = activeScopedUserTaskItems.filter(matchesTaskSearch);
  const filteredArchiveTaskItems = archivedScopedTaskItems.filter(matchesTaskSearch);
  const showingStatistics = isAdminStatisticsView;
  const handleUserProjectFilterChange = (nextProjectId: string) => {
    const nextSearchParams = new URLSearchParams(searchParams.toString());

    if (nextProjectId === "all") {
      nextSearchParams.delete("projectId");
    } else {
      nextSearchParams.set("projectId", nextProjectId);
    }

    const nextQuery = nextSearchParams.toString();
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  };

  return (
    <main className="projects-page">
      <PageHeader
        eyebrow={isArchiveView ? t("archive") : isAdminStatisticsView ? t("statistics") : isMyProjectsView ? t("myProjects") : t("projects")}
        subtitle={
          isArchiveView
            ? t("archiveSubtitle")
            : isAdminStatisticsView
            ? t("adminStatisticsSubtitle")
            : canEdit
              ? isMyProjectsView ? t("myProjectsSubtitle") : t("projectsFirestoreSubtitle")
              : isMyProjectsView ? t("myProjectsSubtitle") : t("taskBoardSubtitle")
        }
        title={isArchiveView ? t("archive") : isAdminStatisticsView ? t("statistics") : canEdit ? (isMyProjectsView ? t("myProjects") : t("projects")) : isMyProjectsView ? t("myProjects") : t("myTasks")}
      />

      {error ? <p className="auth-message auth-message-error">{error}</p> : null}

      {isArchiveView ? (
        <>
          <Card className="dashboard-control-panel archive-control-panel">
            <CardHeader className="archive-control-header">
              <div>
                <p className="auth-kicker">{t("archivedTasks")}</p>
                <CardTitle>{t("tasksShown", { count: filteredArchiveTaskItems.length })}</CardTitle>
              </div>
              <Button disabled={loading} onClick={refresh} size="sm" type="button" variant="secondary">
                {loading ? t("refreshing") : t("refresh")}
              </Button>
            </CardHeader>
            <Separator />
            <CardContent className="project-filters archive-control-content" aria-label={`${t("projects")}, ${t("search")}`}>
              <FieldLabel>
                <span>{t("projects")}</span>
                <Select onChange={(event) => handleUserProjectFilterChange(event.target.value)} value={projectFilterId}>
                  <option value="all">{t("allProjects")}</option>
                  {userProjectOptions.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </FieldLabel>

              <FieldLabel>
                <span>{t("search")}</span>
                <Input
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t("searchTasks")}
                  type="search"
                  value={searchQuery}
                />
              </FieldLabel>
            </CardContent>
          </Card>

          {loading ? <section className="empty-state">{t("loadingTasks")}</section> : null}
          {!loading && archivedScopedTaskItems.length === 0 ? <section className="empty-state">{t("noArchivedTasks")}</section> : null}
          {!loading && archivedScopedTaskItems.length > 0 && filteredArchiveTaskItems.length === 0 ? (
            <section className="empty-state">{t("noMatchingTasks")}</section>
          ) : null}

          <ArchivedTaskList
            items={filteredArchiveTaskItems}
            onRestoreTask={(projectId, taskId) => saveTaskStatus(projectId, taskId, "active")}
            savingTaskId={savingTaskId}
            users={users}
          />
        </>
      ) : !canEdit && isMyProjectsView ? (
        <>
          <Card className="dashboard-control-panel">
            <section className="project-toolbar">
              <p>
                {t("projectsShown", { shown: filteredProjects.length, total: visibleProjects.length })}
              </p>
              <Button disabled={loading} onClick={refresh} size="sm" type="button" variant="secondary">
                {loading ? t("refreshing") : t("refresh")}
              </Button>
            </section>
            <Separator />
            <FieldLabel>
              <span>{t("search")}</span>
              <Input
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("searchProjects")}
                type="search"
                value={searchQuery}
              />
            </FieldLabel>
          </Card>

          {loading ? <section className="empty-state">{t("loadingProjects")}</section> : null}
          {!loading && visibleProjects.length === 0 ? <section className="empty-state">{t("noProjectsAssigned")}</section> : null}
          {!loading && visibleProjects.length > 0 && filteredProjects.length === 0 ? (
            <section className="empty-state">{t("noMatchingProjects")}</section>
          ) : null}

          <section className="projects-grid">
            {filteredProjects.map((project) => (
              <ProjectCard
                actionLabel={t("myTasks")}
                href={`/projects?projectId=${encodeURIComponent(project.id)}`}
                key={project.id}
                project={project}
                tasks={(tasksByProjectId[project.id] ?? []).filter((task) => canSeeAllProjectTasks(project) || task.userIds.includes(user.uid))}
              />
            ))}
          </section>
        </>
      ) : !canEdit ? (
        <>
          <Card className="dashboard-control-panel">
            <section className="project-toolbar">
              <p>
                {t("tasksShown", { count: filteredUserTaskItems.length })}
              </p>
              <Button disabled={loading} onClick={refresh} size="sm" type="button" variant="secondary">
                {loading ? t("refreshing") : t("refresh")}
              </Button>
            </section>
            <Separator />
            <section className="project-filters" aria-label={`${t("projects")}, ${t("search")}`}>
              <FieldLabel>
                <span>{t("projects")}</span>
                <Select onChange={(event) => handleUserProjectFilterChange(event.target.value)} value={projectFilterId}>
                  <option value="all">{t("allProjects")}</option>
                  {userProjectOptions.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </FieldLabel>

              <FieldLabel>
                <span>{t("search")}</span>
                <Input
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t("searchTasks")}
                  type="search"
                  value={searchQuery}
                />
              </FieldLabel>
            </section>
          </Card>

          {loading ? <section className="empty-state">{t("loadingTasks")}</section> : null}
          {!loading && visibleProjects.length === 0 ? <section className="empty-state">{t("noProjectsAssigned")}</section> : null}
          {!loading && visibleProjects.length > 0 && activeScopedUserTaskItems.length === 0 ? <section className="empty-state">{t("noTasks")}</section> : null}
          {!loading && activeScopedUserTaskItems.length > 0 && filteredUserTaskItems.length === 0 ? (
            <section className="empty-state">{t("noMatchingTasks")}</section>
          ) : null}
          <UserTaskBoard
            items={filteredUserTaskItems}
            loading={loading}
            onMoveTask={saveTaskStatus}
            savingTaskId={savingTaskId}
            users={users}
          />
        </>
      ) : showingStatistics ? (
        <AdminStatistics loading={loading} onRefresh={refresh} projects={visibleProjects} tasksByProjectId={tasksByProjectId} />
      ) : (
        <>
          <Card className="admin-project-create-card">
            <div className="admin-project-create-copy">
              <p className="auth-kicker">{t("createProject")}</p>
              <h2>{t("addProject")}</h2>
            </div>
            <Link className={buttonVariants({ className: "admin-project-create-button", size: "lg" })} href="/projects/new">
              <span aria-hidden="true" className="admin-project-create-plus">+</span>
              {t("createProject")}
            </Link>
          </Card>

          <Card className="dashboard-control-panel">
            <section className="project-toolbar">
              <p>
                {canEdit ? t("adminEditActive") : t("readOnlyAccess")} - {t("projectsShown", { shown: filteredProjects.length, total: visibleProjects.length })}
              </p>
              <Button disabled={loading} onClick={refresh} size="sm" type="button" variant="secondary">
                {loading ? t("refreshing") : t("refresh")}
              </Button>
            </section>
            <Separator />

            <section className="project-filters" aria-label={`${t("search")}, ${t("status")}, ${t("sort")}`}>
              <FieldLabel>
                <span>{t("search")}</span>
                <Input
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t("searchProjects")}
                  type="search"
                  value={searchQuery}
                />
              </FieldLabel>

              <FieldLabel>
                <span>{t("status")}</span>
                <Select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                  <option value="all">{t("allStatuses")}</option>
                  {PROJECT_STATUSES.map((projectStatus) => (
                    <option key={projectStatus} value={projectStatus}>
                      {getProjectStatusLabel(projectStatus, language)}
                    </option>
                  ))}
                </Select>
              </FieldLabel>

              <FieldLabel>
                <span>{t("sort")}</span>
                <Select onChange={(event) => setProjectSort(event.target.value as ProjectSort)} value={projectSort}>
                  <option value="deadline-asc">{t("nearestDeadline")}</option>
                  <option value="deadline-desc">{t("farthestDeadline")}</option>
                  <option value="name-asc">{t("nameAsc")}</option>
                  <option value="name-desc">{t("nameDesc")}</option>
                  <option value="status-asc">{t("statusAsc")}</option>
                </Select>
              </FieldLabel>
            </section>
          </Card>

          {loading ? <section className="empty-state">{t("loadingProjects")}</section> : null}

          {!loading && visibleProjects.length === 0 ? (
            <section className="empty-state">
              {isMyProjectsView ? t("noProjectsAssigned") : t("noProjects")}
            </section>
          ) : null}
          {!loading && visibleProjects.length > 0 && filteredProjects.length === 0 ? (
            <section className="empty-state">{t("noMatchingProjects")}</section>
          ) : null}

          <section className="projects-grid">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                tasks={canEdit ? tasksByProjectId[project.id] ?? [] : (tasksByProjectId[project.id] ?? []).filter((task) => task.userIds.includes(user.uid))}
              />
            ))}
          </section>
        </>
      )}
    </main>
  );
}
