import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "../firebase/config";

export type Project = {
  id: string;
  name: string;
  description: string;
  status: string;
  deadline: string;
  userIds: string[];
};

export type ProjectUpdate = Pick<Project, "name" | "description" | "status" | "deadline">;
export type ProjectMemberUpdate = ProjectUpdate & Pick<Project, "userIds">;
export type NewProject = ProjectMemberUpdate;

export const PROJECT_STATUSES = ["planned", "active", "paused", "blocked", "completed"] as const;

export function getTodayDateInputValue() {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());

  return today.toISOString().slice(0, 10);
}

export function isPastDeadline(deadline: string) {
  return Boolean(deadline) && deadline < getTodayDateInputValue();
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toProject(projectId: string, data: Record<string, unknown>): Project {
  return {
    id: projectId,
    name: readString(data.name, "Untitled project"),
    description: readString(data.description),
    status: readString(data.status, "active"),
    deadline: readString(data.deadline),
    userIds: readStringArray(data.userIds),
  };
}

export async function getProjects() {
  const snapshot = await getDocs(collection(db, "projects"));

  return snapshot.docs.map((projectDoc) => {
    return toProject(projectDoc.id, projectDoc.data());
  });
}

export async function getProject(projectId: string) {
  const projectDoc = await getDoc(doc(db, "projects", projectId));

  if (!projectDoc.exists()) {
    return null;
  }

  return toProject(projectDoc.id, projectDoc.data());
}

export async function updateProject(projectId: string, update: ProjectMemberUpdate) {
  await updateDoc(doc(db, "projects", projectId), {
    ...update,
    updatedAt: serverTimestamp(),
  });
}

export async function addProject(project: NewProject, createdBy: string) {
  const projectRef = await addDoc(collection(db, "projects"), {
    ...project,
    createdBy,
    createdAt: serverTimestamp(),
  });

  return {
    id: projectRef.id,
    ...project,
  };
}

export async function deleteProject(projectId: string) {
  await deleteDoc(doc(db, "projects", projectId));
}

export async function generateProjectDescription(title: string, message = "") {
  const response = await fetch("/api/generate-description", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, title }),
  });

  const data = (await response.json()) as { description?: string; error?: string };

  if (!response.ok || !data.description) {
    throw new Error(data.error || "Could not generate project description.");
  }

  return data.description;
}
