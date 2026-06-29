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

export type NewProjectNote = Omit<ProjectNote, "id" | "projectId" | "createdAtMs" | "updatedAtMs">;

export type ProjectUpdate = Pick<Project, "name" | "description" | "status" | "deadline">;
export type ProjectMemberUpdate = ProjectUpdate & Pick<Project, "leaderId" | "userIds">;
export type NewProject = ProjectMemberUpdate & Pick<Project, "leaderId">;

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

function readTimestampMs(value: unknown, fallback = 0) {
  if (typeof value === "number") {
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
    userIds: Array.from(new Set([...(leaderId ? [leaderId] : []), ...readStringArray(data.userIds)])),
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
  const leaderId = project.leaderId || createdBy;
  const userIds = Array.from(new Set([leaderId, ...project.userIds]));
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

export async function generateProjectDescription(title: string, message = "", language = "en") {
  const response = await fetch("/api/generate-description", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ language, message, title }),
  });

  const data = (await response.json()) as { description?: string; error?: string };

  if (!response.ok || !data.description) {
    throw new Error(data.error || "Could not generate the project description.");
  }

  return data.description;
}
