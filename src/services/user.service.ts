import { arrayRemove, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";

import { db } from "../firebase/config";
import { adminRole, normalizeRole, superAdminRole, userRole } from "../utils/roles";

export type ProjectUser = {
  uid: string;
  email: string;
  name: string;
  photoURL: string;
  status: string;
  role: string;
};

export type ProjectUserUpdate = Pick<ProjectUser, "email" | "name"> & {
  role?: string;
};

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toProjectUser(docId: string, data: Record<string, unknown>): ProjectUser {
  return {
    uid: readString(data.uid, docId),
    email: readString(data.email),
    name: readString(data.name),
    photoURL: readString(data.photoURL),
    status: readString(data.status, "approved"),
    role: readString(data.role, "user"),
  };
}

export async function getProjectUsers() {
  const snapshot = await getDocs(collection(db, "users"));

  return snapshot.docs
    .map((userDoc) => toProjectUser(userDoc.id, userDoc.data()))
    .filter((projectUser) => projectUser.status === "approved")
    .sort((firstUser, secondUser) =>
      (firstUser.name || firstUser.email).localeCompare(secondUser.name || secondUser.email),
    );
}

export async function deleteProjectUser(uid: string) {
  await deleteDoc(doc(db, "users", uid));

  const pendingSnapshot = await getDocs(query(collection(db, "pendingUsers"), where("uid", "==", uid)));
  await Promise.all(pendingSnapshot.docs.map((pendingDoc) => deleteDoc(pendingDoc.ref)));

  const projectsSnapshot = await getDocs(collection(db, "projects"));
  await Promise.all(
    projectsSnapshot.docs.map(async (projectDoc) => {
      const userIds = projectDoc.data().userIds;
      const updates: Promise<unknown>[] = [];

      if (Array.isArray(userIds) && userIds.includes(uid)) {
        updates.push(updateDoc(projectDoc.ref, {
          userIds: arrayRemove(uid),
          updatedAt: serverTimestamp(),
        }));
      }

      const tasksSnapshot = await getDocs(collection(db, "projects", projectDoc.id, "tasks"));
      tasksSnapshot.docs.forEach((taskDoc) => {
        const taskUserIds = taskDoc.data().userIds;

        if (Array.isArray(taskUserIds) && taskUserIds.includes(uid)) {
          updates.push(updateDoc(taskDoc.ref, {
            userIds: arrayRemove(uid),
            updatedAt: serverTimestamp(),
          }));
        }
      });

      await Promise.all(updates);
    }),
  );
}

export async function updateProjectUser(uid: string, update: ProjectUserUpdate) {
  const userRef = doc(db, "users", uid);
  const updates: Record<string, unknown> = {
    email: update.email.trim(),
    name: update.name.trim(),
    updatedAt: serverTimestamp(),
  };

  if (typeof update.role === "string") {
    const nextRole = normalizeRole(update.role);

    if (nextRole === adminRole || nextRole === superAdminRole || nextRole === userRole) {
      updates.role = nextRole;
    }
  }

  await updateDoc(userRef, updates);

  if (typeof updates.role !== "string") {
    return;
  }

  const userSnapshot = await getDoc(userRef);
  const userData = userSnapshot.exists() ? userSnapshot.data() : {};
  const roleId = readString(userData.roleId);
  const roleUpdates = {
    email: update.email.trim(),
    name: updates.role,
    role: updates.role,
    uid,
    updatedAt: serverTimestamp(),
  };
  const roleRefs = new Map<string, ReturnType<typeof doc>>();

  if (roleId) {
    const roleRef = doc(db, "roles", roleId);
    const roleSnapshot = await getDoc(roleRef);

    if (roleSnapshot.exists()) {
      roleRefs.set(roleRef.path, roleRef);
    }
  }

  const rolesByUid = await getDocs(query(collection(db, "roles"), where("uid", "==", uid)));
  rolesByUid.docs.forEach((roleDoc) => roleRefs.set(roleDoc.ref.path, roleDoc.ref));

  const rolesByEmail = await getDocs(query(collection(db, "roles"), where("email", "==", update.email.trim())));
  rolesByEmail.docs.forEach((roleDoc) => roleRefs.set(roleDoc.ref.path, roleDoc.ref));

  await Promise.all(Array.from(roleRefs.values()).map((roleRef) => updateDoc(roleRef, roleUpdates)));
}
