"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "./useAuth";
import {
  addProject,
  deleteProject,
  getProjects,
  getProjectTasks,
  updateProject,
  updateProjectTask,
  type NewProject,
  type Project,
  type ProjectMemberUpdate,
  type ProjectTask,
} from "../services/project.service";

export function useProjects(enabled = true) {
  const { t } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasksByProjectId, setTasksByProjectId] = useState<Record<string, ProjectTask[]>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const loadedProjects = await getProjects();
      const projectTasks = await Promise.all(
        loadedProjects.map(async (project) => [project.id, await getProjectTasks(project.id)] as const),
      );

      setProjects(loadedProjects);
      setTasksByProjectId(Object.fromEntries(projectTasks));
    } catch (projectsError) {
      setError(projectsError instanceof Error ? projectsError.message : t("projectsLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
      setError(projectsError instanceof Error ? projectsError.message : t("projectSaveFailed"));
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
      setTasksByProjectId((currentTasksByProjectId) => ({
        ...currentTasksByProjectId,
        [createdProject.id]: [],
      }));
      return createdProject;
    } catch (projectsError) {
      setError(projectsError instanceof Error ? projectsError.message : t("projectCreateFailed"));
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
      setTasksByProjectId((currentTasksByProjectId) => {
        const nextTasksByProjectId = { ...currentTasksByProjectId };
        delete nextTasksByProjectId[projectId];

        return nextTasksByProjectId;
      });
    } catch (projectsError) {
      setError(projectsError instanceof Error ? projectsError.message : t("projectDeleteFailed"));
      throw projectsError;
    } finally {
      setDeletingId(null);
    }
  };

  const saveTaskStatus = async (projectId: string, taskId: string, status: string) => {
    const currentTask = tasksByProjectId[projectId]?.find((task) => task.id === taskId);

    if (!currentTask) {
      return;
    }

    setSavingTaskId(taskId);
    setError(null);

    try {
      const update = {
        title: currentTask.title,
        description: currentTask.description,
        status,
        deadline: currentTask.deadline,
        userIds: currentTask.userIds,
      };

      const taskTimestamps = await updateProjectTask(projectId, taskId, update);
      setTasksByProjectId((currentTasksByProjectId) => ({
        ...currentTasksByProjectId,
        [projectId]: (currentTasksByProjectId[projectId] ?? []).map((task) =>
          task.id === taskId ? { ...task, status, ...taskTimestamps } : task,
        ),
      }));
    } catch (projectsError) {
      setError(projectsError instanceof Error ? projectsError.message : t("projectSaveFailed"));
      throw projectsError;
    } finally {
      setSavingTaskId(null);
    }
  };

  return {
    projects,
    tasksByProjectId,
    loading,
    savingId,
    savingTaskId,
    deletingId,
    error,
    refresh: loadProjects,
    saveProject,
    createProject,
    removeProject,
    saveTaskStatus,
  };
}
