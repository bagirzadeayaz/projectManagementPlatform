"use client";

import { useCallback, useEffect, useState } from "react";

import {
  addProject,
  deleteProject,
  getProjects,
  updateProject,
  type NewProject,
  type Project,
  type ProjectMemberUpdate,
} from "../services/project.service";

export function useProjects(enabled = true) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const loadedProjects = await getProjects();
      setProjects(loadedProjects);
    } catch (projectsError) {
      setError(projectsError instanceof Error ? projectsError.message : "Could not load projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      void loadProjects();
    }
  }, [enabled, loadProjects]);

  const saveProject = async (projectId: string, update: ProjectMemberUpdate) => {
    setSavingId(projectId);
    setError(null);

    try {
      await updateProject(projectId, update);
      setProjects((currentProjects) =>
        currentProjects.map((project) => (project.id === projectId ? { ...project, ...update } : project)),
      );
    } catch (projectsError) {
      setError(projectsError instanceof Error ? projectsError.message : "Could not save project.");
      throw projectsError;
    } finally {
      setSavingId(null);
    }
  };

  const createProject = async (project: NewProject, createdBy: string) => {
    setSavingId("new");
    setError(null);

    try {
      const createdProject = await addProject(project, createdBy);
      setProjects((currentProjects) => [createdProject, ...currentProjects]);
      return createdProject;
    } catch (projectsError) {
      setError(projectsError instanceof Error ? projectsError.message : "Could not create project.");
      throw projectsError;
    } finally {
      setSavingId(null);
    }
  };

  const removeProject = async (projectId: string) => {
    setDeletingId(projectId);
    setError(null);

    try {
      await deleteProject(projectId);
      setProjects((currentProjects) => currentProjects.filter((project) => project.id !== projectId));
    } catch (projectsError) {
      setError(projectsError instanceof Error ? projectsError.message : "Could not delete project.");
      throw projectsError;
    } finally {
      setDeletingId(null);
    }
  };

  return {
    projects,
    loading,
    savingId,
    deletingId,
    error,
    refresh: loadProjects,
    saveProject,
    createProject,
    removeProject,
  };
}
