"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "../hooks/useAuth";
import { useProjects } from "../hooks/useProjects";
import { PROJECT_STATUSES, type Project } from "../services/project.service";
import { AuthForm } from "./AuthForm";
import { SignOutConfirmDialog } from "./SignOutConfirmDialog";

type ProjectSort = "deadline-asc" | "deadline-desc" | "name-asc" | "name-desc" | "status-asc";
type ProjectsDashboardView = "all" | "mine";

function canEditProjects(role: string) {
  const normalizedRole = role.trim().toLowerCase();

  return normalizedRole === "admin";
}

function getStatusClass(status: string) {
  return `project-status project-status-${status.toLowerCase()}`;
}

function getDeadlineSortValue(project: Project) {
  return project.deadline || "9999-12-31";
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
  return (
    <Link className="project-card project-card-link" href={`/projects/${project.id}`}>
      <div className="project-card-header">
        <div>
          <p className={getStatusClass(project.status)}>{project.status}</p>
          <h2>{project.name}</h2>
        </div>
      </div>
      <p className="project-description">{project.description || "No description provided."}</p>
      <div className="project-card-footer">
        {project.deadline ? <p className="project-meta">Deadline: {project.deadline}</p> : <p className="project-meta">No deadline</p>}
        <span className="project-open-text">Open details</span>
      </div>
    </Link>
  );
}

export function ProjectsDashboard({ view = "all" }: { view?: ProjectsDashboardView }) {
  const router = useRouter();
  const { user, busy, signOut } = useAuth();
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

  const handleSignOut = async () => {
    await signOut();
    setConfirmingSignOut(false);
    router.push("/");
  };

  return (
    <main className="projects-page">
      <header className="projects-header">
        <div>
          <p className="auth-kicker">{isMyProjectsView ? "My projects" : "Projects"}</p>
          <h1>{isMyProjectsView ? "My projects" : "Projects"}</h1>
          <p className="projects-subtitle">
            {isMyProjectsView ? "Projects you are assigned to." : "All projects from Firestore."}
          </p>
        </div>

        <div className="projects-userbar">
          <span>{user.name || user.email}</span>
          <span className="role-pill">{user.role}</span>
          {isMyProjectsView ? (
            <Link className="nav-link" href="/projects">
              All projects
            </Link>
          ) : (
            <Link className="nav-link" href="/myprojects">
              My projects
            </Link>
          )}
          {canEdit ? (
            <Link className="nav-link nav-link-primary" href="/projects/new">
              Add project
            </Link>
          ) : null}
          {canEdit ? (
            <Link className="nav-link" href="/registrations">
              Users
            </Link>
          ) : null}
          <Link className="nav-link" href="/personalization">
            Profile
          </Link>
          <button
            className="auth-button auth-button-secondary"
            disabled={busy}
            onClick={() => setConfirmingSignOut(true)}
            type="button"
          >
            Sign out
          </button>
        </div>
      </header>

      {error ? <p className="auth-message auth-message-error">{error}</p> : null}

      <section className="project-toolbar">
        <p>
          {canEdit ? "Admin editing enabled" : "Read only access"} - {filteredProjects.length} of {visibleProjects.length} projects
        </p>
        <button className="auth-button auth-button-secondary" disabled={loading} onClick={refresh} type="button">
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </section>

      <section className="project-filters" aria-label="Project search, filters, and sorting">
        <label className="auth-field">
          <span>Search</span>
          <input
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search projects"
            type="search"
            value={searchQuery}
          />
        </label>

        <label className="auth-field">
          <span>Status</span>
          <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
            <option value="all">All statuses</option>
            {PROJECT_STATUSES.map((projectStatus) => (
              <option key={projectStatus} value={projectStatus}>
                {projectStatus}
              </option>
            ))}
          </select>
        </label>

        <label className="auth-field">
          <span>Sort by</span>
          <select onChange={(event) => setProjectSort(event.target.value as ProjectSort)} value={projectSort}>
            <option value="deadline-asc">Deadline soonest</option>
            <option value="deadline-desc">Deadline latest</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="status-asc">Status A-Z</option>
          </select>
        </label>
      </section>

      {loading ? <section className="empty-state">Loading projects...</section> : null}

      {!loading && visibleProjects.length === 0 ? (
        <section className="empty-state">
          {isMyProjectsView ? "You are not assigned to any projects yet." : "No projects found."}
        </section>
      ) : null}
      {!loading && visibleProjects.length > 0 && filteredProjects.length === 0 ? (
        <section className="empty-state">No projects match your search or filters.</section>
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
        />
      ) : null}
    </main>
  );
}
