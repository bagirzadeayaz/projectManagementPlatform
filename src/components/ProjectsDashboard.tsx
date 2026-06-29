"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "../hooks/useAuth";
import { useProjects } from "../hooks/useProjects";
import { PROJECT_STATUSES, type Project } from "../services/project.service";
import { getProjectStatusLabel, getRoleLabel } from "../utils/labels";
import { PageHeader } from "./AppShell";
import { AuthForm } from "./AuthForm";
import { SignOutConfirmDialog } from "./SignOutConfirmDialog";
import { Badge } from "./ui/badge";
import { Button, buttonVariants } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { FieldLabel } from "./ui/field";
import { Input } from "./ui/input";
import { Select } from "./ui/select";
import { Separator } from "./ui/separator";
import { Tabs, TabsTrigger } from "./ui/tabs";

type ProjectSort = "deadline-asc" | "deadline-desc" | "name-asc" | "name-desc" | "status-asc";
type ProjectsDashboardView = "all" | "mine";
type AdminDashboardTab = "projects" | "statistics";

function canEditProjects(role: string) {
  return role.trim().toLowerCase() === "admin";
}

function getStatusClass(status: string) {
  return `project-status project-status-${status.toLowerCase()}`;
}

function getDeadlineSortValue(project: Project) {
  return project.deadline || "9999-12-31";
}

function countProjects(projects: Project[], status: string) {
  return projects.filter((project) => project.status === status).length;
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
}: {
  loading: boolean;
  onRefresh: () => void;
  projects: Project[];
}) {
  const { language, t } = useAuth();
  const totalProjects = projects.length;
  const completedProjects = countProjects(projects, "completed");
  const activeProjects = countProjects(projects, "active");
  const plannedProjects = countProjects(projects, "planned");
  const completionRate = getPercent(completedProjects, totalProjects);
  const assignedProjects = projects.filter((project) => project.userIds.length > 0).length;
  const projectsWithoutUsers = totalProjects - assignedProjects;
  const averageTeamSize = totalProjects > 0
    ? (projects.reduce((total, project) => total + project.userIds.length, 0) / totalProjects).toFixed(1)
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
  const deadlineRows = [
    { label: t("overdueProjects"), tone: "danger", value: overdueProjects },
    { label: t("upcomingProjects"), tone: "warning", value: upcomingProjects },
    { label: t("laterProjects"), tone: "info", value: laterProjects },
    { label: t("noDeadline"), tone: "muted", value: noDeadlineProjects },
  ];
  const kpis = [
    { label: t("totalProjects"), tone: "default", value: totalProjects },
    { label: t("activeProjects"), tone: "success", value: activeProjects },
    { label: t("plannedProjects"), tone: "secondary", value: plannedProjects },
    { label: t("completionRate"), tone: "info", value: `${completionRate}%` },
  ];

  return (
    <section className="admin-statistics" aria-label={t("statistics")}>
      <div className="admin-statistics-heading">
        <div>
          <p className="auth-kicker">{t("statistics")}</p>
          <h2>{t("projectHealth")}</h2>
          <p>{t("adminStatisticsSubtitle")}</p>
        </div>
        <Button disabled={loading} onClick={onRefresh} size="sm" type="button" variant="secondary">
          {loading ? t("refreshing") : t("refresh")}
        </Button>
      </div>

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
    </section>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const { language, t } = useAuth();

  return (
    <Card className="project-card project-card-link">
      <Link className="project-card-anchor" href={`/projects/${project.id}`}>
        <CardHeader className="project-card-header">
          <div>
            <Badge className={getStatusClass(project.status)}>{getProjectStatusLabel(project.status, language)}</Badge>
            <CardTitle>{project.name}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="project-description">{project.description || t("descriptionMissing")}</p>
        </CardContent>
        <CardFooter className="project-card-footer">
          {project.deadline ? <p className="project-meta">{t("deadline")}: {project.deadline}</p> : <p className="project-meta">{t("noDeadline")}</p>}
          <span className="project-open-text">{t("openDetails")}</span>
        </CardFooter>
      </Link>
    </Card>
  );
}

export function ProjectsDashboard({ view = "all" }: { view?: ProjectsDashboardView }) {
  const router = useRouter();
  const { user, busy, language, t, signOut } = useAuth();
  const { projects, loading, error, refresh } = useProjects();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectSort, setProjectSort] = useState<ProjectSort>("deadline-asc");
  const [adminTab, setAdminTab] = useState<AdminDashboardTab>("projects");

  if (!user) {
    return (
      <main className="auth-page">
        <AuthForm />
      </main>
    );
  }

  const canEdit = canEditProjects(user.role);
  const isMyProjectsView = view === "mine";
  const visibleProjects = isMyProjectsView
    ? projects.filter((project) => project.userIds.includes(user.uid))
    : projects;
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
  const showingStatistics = canEdit && adminTab === "statistics";

  const handleSignOut = async () => {
    await signOut();
    setConfirmingSignOut(false);
    router.push("/");
  };

  return (
    <main className="projects-page">
      <PageHeader
        actions={
          <>
          <span>{user.name || user.email}</span>
          <Badge>{getRoleLabel(user.role, language)}</Badge>
          {isMyProjectsView ? (
            <Link className={buttonVariants({ size: "sm", variant: "secondary" })} href="/projects">
              {t("allProjects")}
            </Link>
          ) : (
            <Link className={buttonVariants({ size: "sm", variant: "secondary" })} href="/myprojects">
              {t("myProjects")}
            </Link>
          )}
          <Link className={buttonVariants({ size: "sm" })} href="/projects/new">
            {t("addProject")}
          </Link>
          {canEdit ? (
            <Link className={buttonVariants({ size: "sm", variant: "secondary" })} href="/registrations">
              {t("appUsers")}
            </Link>
          ) : null}
          <Link className={buttonVariants({ size: "sm", variant: "secondary" })} href="/personalization">
            {t("profile")}
          </Link>
          <Button disabled={busy} onClick={() => setConfirmingSignOut(true)} size="sm" type="button" variant="secondary">
            {t("logout")}
          </Button>
          </>
        }
        eyebrow={isMyProjectsView ? t("myProjects") : t("projects")}
        subtitle={isMyProjectsView ? t("myProjectsSubtitle") : t("projectsFirestoreSubtitle")}
        title={isMyProjectsView ? t("myProjects") : t("projects")}
      />

      {error ? <p className="auth-message auth-message-error">{error}</p> : null}

      {canEdit ? (
        <Tabs className="admin-dashboard-tabs" aria-label={t("adminPanel")}>
          <TabsTrigger
            aria-selected={adminTab === "projects"}
            onClick={() => setAdminTab("projects")}
          >
            {t("projectList")}
          </TabsTrigger>
          <TabsTrigger
            aria-selected={adminTab === "statistics"}
            onClick={() => setAdminTab("statistics")}
          >
            {t("statistics")}
          </TabsTrigger>
        </Tabs>
      ) : null}

      {showingStatistics ? (
        <AdminStatistics loading={loading} onRefresh={refresh} projects={visibleProjects} />
      ) : (
        <>
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
              <ProjectCard key={project.id} project={project} />
            ))}
          </section>
        </>
      )}

      {confirmingSignOut ? (
        <SignOutConfirmDialog
          busy={busy}
          onCancel={() => setConfirmingSignOut(false)}
          onConfirm={() => void handleSignOut()}
          open={confirmingSignOut}
        />
      ) : null}
    </main>
  );
}
