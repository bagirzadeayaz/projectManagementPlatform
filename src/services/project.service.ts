import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

import { db } from "../firebase/config";

export type Project = {
  id: string;
  name: string;
  description: string;
  status: string;
  deadline: string;
  leaderId: string;
  createdBy: string;
  userIds: string[];
};

export type ProjectNote = {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhotoURL: string;
  text: string;
  createdAtMs: number;
  updatedAtMs: number;
};

export type ProjectTask = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  deadline: string;
  userIds: string[];
  createdBy: string;
  createdAtMs: number;
  statusChangedAtMs: number;
  updatedAtMs: number;
};

export type NewProjectNote = Omit<ProjectNote, "id" | "projectId" | "createdAtMs" | "updatedAtMs">;
export type NewProjectTask = Omit<ProjectTask, "id" | "projectId" | "createdAtMs" | "statusChangedAtMs" | "updatedAtMs">;
export type ProjectTaskUpdate = Pick<ProjectTask, "title" | "description" | "status" | "priority" | "deadline" | "userIds">;

export type ProjectUpdate = Pick<Project, "name" | "description" | "status" | "deadline">;
export type ProjectMemberUpdate = ProjectUpdate & Pick<Project, "leaderId" | "userIds">;
export type NewProject = ProjectMemberUpdate & Pick<Project, "leaderId">;

export const PROJECT_STATUSES = ["planned", "active", "paused", "blocked", "completed"] as const;
export const TASK_STATUSES = ["planned", "active", "completed"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high"] as const;

export function getTodayDateInputValue() {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());

  return today.toISOString().slice(0, 10);
}

export function isPastDeadline(deadline: string) {
  return Boolean(deadline) && deadline < getTodayDateInputValue();
}

export function isTaskDeadlineAfterProjectDeadline(taskDeadline: string, projectDeadline: string) {
  return Boolean(taskDeadline && projectDeadline && taskDeadline > projectDeadline);
}

async function assertTaskDeadlineFitsProject(projectId: string, taskDeadline: string) {
  const projectSnapshot = await getDoc(doc(db, "projects", projectId));

  if (!projectSnapshot.exists()) {
    throw new Error("Project not found.");
  }

  const projectDeadline = readString(projectSnapshot.data().deadline);

  if (isTaskDeadlineAfterProjectDeadline(taskDeadline, projectDeadline)) {
    throw new Error("Task deadline cannot be later than the project deadline.");
  }
}

async function assertProjectDeadlineFitsTasks(projectId: string, projectDeadline: string) {
  const taskSnapshot = await getDocs(collection(db, "projects", projectId, "tasks"));
  const hasTaskAfterProjectDeadline = taskSnapshot.docs.some((taskDoc) =>
    isTaskDeadlineAfterProjectDeadline(readString(taskDoc.data().deadline), projectDeadline),
  );

  if (hasTaskAfterProjectDeadline) {
    throw new Error("Project deadline cannot be earlier than an existing task deadline.");
  }
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readTimestampMs(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  return fallback;
}

function toProject(projectId: string, data: Record<string, unknown>): Project {
  const createdBy = readString(data.createdBy);
  const leaderId = readString(data.leaderId, createdBy);

  return {
    id: projectId,
    name: readString(data.name, "Untitled project"),
    description: readString(data.description),
    status: readString(data.status, "active"),
    deadline: readString(data.deadline),
    leaderId,
    createdBy,
    userIds: Array.from(new Set(readStringArray(data.userIds))),
  };
}

function toProjectNote(projectId: string, noteId: string, data: Record<string, unknown>): ProjectNote {
  return {
    id: noteId,
    projectId,
    userId: readString(data.userId),
    userName: readString(data.userName),
    userEmail: readString(data.userEmail),
    userPhotoURL: readString(data.userPhotoURL),
    text: readString(data.text),
    createdAtMs: readTimestampMs(data.createdAtMs),
    updatedAtMs: readTimestampMs(data.updatedAtMs, readTimestampMs(data.createdAtMs)),
  };
}

function toProjectTask(projectId: string, taskId: string, data: Record<string, unknown>): ProjectTask {
  const priority = readString(data.priority, "medium");

  return {
    id: taskId,
    projectId,
    title: readString(data.title, "Untitled task"),
    description: readString(data.description),
    status: readString(data.status, "planned"),
    priority: TASK_PRIORITIES.includes(priority as (typeof TASK_PRIORITIES)[number]) ? priority : "medium",
    deadline: readString(data.deadline),
    userIds: readStringArray(data.userIds),
    createdBy: readString(data.createdBy),
    createdAtMs: readTimestampMs(data.createdAtMs),
    statusChangedAtMs: readTimestampMs(
      data.statusChangedAtMs,
      readTimestampMs(data.updatedAtMs, readTimestampMs(data.createdAtMs)),
    ),
    updatedAtMs: readTimestampMs(data.updatedAtMs, readTimestampMs(data.createdAtMs)),
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
  const projectSnapshot = await getDoc(doc(db, "projects", projectId));
  const currentDeadline = projectSnapshot.exists() ? readString(projectSnapshot.data().deadline) : "";

  if (update.deadline !== currentDeadline) {
    await assertProjectDeadlineFitsTasks(projectId, update.deadline);
  }

  await updateDoc(doc(db, "projects", projectId), {
    ...update,
    updatedAt: serverTimestamp(),
  });
}

export async function addProject(project: NewProject, createdBy: string) {
  const leaderId = project.leaderId || createdBy;
  const userIds = Array.from(new Set(project.userIds));
  const projectRef = await addDoc(collection(db, "projects"), {
    ...project,
    leaderId,
    userIds,
    createdBy,
    createdAt: serverTimestamp(),
  });

  return {
    id: projectRef.id,
    ...project,
    leaderId,
    userIds,
    createdBy,
  };
}

export async function deleteProject(projectId: string) {
  await deleteDoc(doc(db, "projects", projectId));
}

export async function getProjectTasks(projectId: string) {
  const snapshot = await getDocs(collection(db, "projects", projectId, "tasks"));

  return snapshot.docs
    .map((taskDoc) => toProjectTask(projectId, taskDoc.id, taskDoc.data()))
    .sort((firstTask, secondTask) => {
      const firstDeadline = firstTask.deadline || "9999-12-31";
      const secondDeadline = secondTask.deadline || "9999-12-31";

      return firstDeadline.localeCompare(secondDeadline) || firstTask.title.localeCompare(secondTask.title);
    });
}

export async function addProjectTask(projectId: string, task: NewProjectTask) {
  await assertTaskDeadlineFitsProject(projectId, task.deadline);

  const nowMs = Date.now();
  const taskRef = await addDoc(collection(db, "projects", projectId, "tasks"), {
    ...task,
    createdAt: serverTimestamp(),
    createdAtMs: nowMs,
    statusChangedAt: serverTimestamp(),
    statusChangedAtMs: nowMs,
    updatedAt: serverTimestamp(),
    updatedAtMs: nowMs,
  });

  return {
    id: taskRef.id,
    projectId,
    createdAtMs: nowMs,
    statusChangedAtMs: nowMs,
    updatedAtMs: nowMs,
    ...task,
  };
}

export async function updateProjectTask(projectId: string, taskId: string, update: ProjectTaskUpdate) {
  await assertTaskDeadlineFitsProject(projectId, update.deadline);

  const nowMs = Date.now();
  const taskRef = doc(db, "projects", projectId, "tasks", taskId);
  const taskSnapshot = await getDoc(taskRef);
  const previousStatus = taskSnapshot.exists() ? readString(taskSnapshot.data().status, "planned") : "";
  const statusChanged = previousStatus !== update.status;
  const statusChangedAtMs = statusChanged
    ? nowMs
    : taskSnapshot.exists()
      ? readTimestampMs(taskSnapshot.data().statusChangedAtMs, readTimestampMs(taskSnapshot.data().updatedAtMs, nowMs))
      : nowMs;

  await updateDoc(taskRef, {
    ...update,
    ...(statusChanged ? { statusChangedAt: serverTimestamp(), statusChangedAtMs } : {}),
    updatedAt: serverTimestamp(),
    updatedAtMs: nowMs,
  });

  return {
    statusChangedAtMs,
    updatedAtMs: nowMs,
  };
}

export async function deleteProjectTask(projectId: string, taskId: string) {
  await deleteDoc(doc(db, "projects", projectId, "tasks", taskId));
}

export async function getProjectNotes(projectId: string) {
  const snapshot = await getDocs(collection(db, "projects", projectId, "notes"));
  const latestNoteByUser = new Map<string, ProjectNote>();

  snapshot.docs
    .map((noteDoc) => toProjectNote(projectId, noteDoc.id, noteDoc.data()))
    .sort((firstNote, secondNote) => secondNote.updatedAtMs - firstNote.updatedAtMs)
    .forEach((note) => {
      if (note.userId && !latestNoteByUser.has(note.userId)) {
        latestNoteByUser.set(note.userId, note);
      }
    });

  return Array.from(latestNoteByUser.values()).sort((firstNote, secondNote) => secondNote.updatedAtMs - firstNote.updatedAtMs);
}

export async function saveProjectNote(projectId: string, note: NewProjectNote) {
  const noteRef = doc(db, "projects", projectId, "notes", note.userId);
  const existingNote = await getDoc(noteRef);
  const nowMs = Date.now();
  const createdAtMs = existingNote.exists() ? readTimestampMs(existingNote.data().createdAtMs, nowMs) : nowMs;

  await setDoc(noteRef, {
    ...note,
    createdAtMs,
    updatedAt: serverTimestamp(),
    updatedAtMs: nowMs,
    ...(existingNote.exists() ? {} : { createdAt: serverTimestamp() }),
  }, { merge: true });

  return {
    id: note.userId,
    projectId,
    createdAtMs,
    updatedAtMs: nowMs,
    ...note,
  };
}

export async function deleteProjectNote(projectId: string, userId: string) {
  await deleteDoc(doc(db, "projects", projectId, "notes", userId));
}

export async function generateProjectDescription(title: string, message = "", language = "en", responseLanguage = "auto") {
  const response = await fetch("/api/generate-description", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ language, message, responseLanguage, title }),
  });

  const data = (await response.json()) as { description?: string; error?: string };

  if (!response.ok || !data.description) {
    throw new Error(data.error || "Could not generate the project description.");
  }

  return data.description;
}

export async function generateTaskDescription(
  taskTitle: string,
  message = "",
  projectTitle = "",
  language = "en",
  responseLanguage = "auto",
) {
  const response = await fetch("/api/generate-description", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      descriptionType: "task",
      language,
      message,
      projectTitle,
      responseLanguage,
      taskTitle,
    }),
  });

  const data = (await response.json()) as { description?: string; error?: string };

  if (!response.ok || !data.description) {
    throw new Error(data.error || "Could not generate the task description.");
  }

  return data.description;
}
