"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "../hooks/useAuth";
import { useProjects } from "../hooks/useProjects";
import { PROJECT_STATUSES, type Project } from "../services/project.service";
import { getProjectStatusLabel, getRoleLabel } from "../utils/labels";
import { AuthForm } from "./AuthForm";
import { SignOutConfirmDialog } from "./SignOutConfirmDialog";
import { Badge } from "./ui/badge";
import { Button, buttonVariants } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { FieldLabel } from "./ui/field";
import { Input } from "./ui/input";
import { Select } from "./ui/select";

type ProjectSort = "deadline-asc" | "deadline-desc" | "name-asc" | "name-desc" | "status-asc";
type ProjectsDashboardView = "all" | "mine";

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
  const dashboardStats = [
    { label: t("totalProjects"), value: visibleProjects.length, tone: "default" },
    { label: t("activeProjects"), value: countProjects(visibleProjects, "active"), tone: "success" },
    { label: t("plannedProjects"), value: countProjects(visibleProjects, "planned"), tone: "secondary" },
    { label: t("completedProjects"), value: countProjects(visibleProjects, "completed"), tone: "info" },
  ] as const;

  const handleSignOut = async () => {
    await signOut();
    setConfirmingSignOut(false);
    router.push("/");
  };

  return (
    <main className="projects-page">
      <header className="projects-header">
        <div>
          <p className="auth-kicker">{isMyProjectsView ? t("myProjects") : t("projects")}</p>
          <h1>{isMyProjectsView ? t("myProjects") : t("projects")}</h1>
          <p className="projects-subtitle">
            {isMyProjectsView ? t("myProjectsSubtitle") : t("projectsFirestoreSubtitle")}
          </p>
        </div>

        <div className="projects-userbar">
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
          {canEdit ? (
            <Link className={buttonVariants({ size: "sm" })} href="/projects/new">
              {t("addProject")}
            </Link>
          ) : null}
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
        </div>
      </header>

      {error ? <p className="auth-message auth-message-error">{error}</p> : null}

      <section className="dashboard-summary" aria-label={t("projects")}>
        {dashboardStats.map((stat) => (
          <Card className={`dashboard-stat dashboard-stat-${stat.tone}`} key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </Card>
        ))}
      </section>

      <Card className="dashboard-control-panel">
        <section className="project-toolbar">
          <p>
            {canEdit ? t("adminEditActive") : t("readOnlyAccess")} - {t("projectsShown", { shown: filteredProjects.length, total: visibleProjects.length })}
          </p>
          <Button disabled={loading} onClick={refresh} size="sm" type="button" variant="secondary">
            {loading ? t("refreshing") : t("refresh")}
          </Button>
        </section>

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
