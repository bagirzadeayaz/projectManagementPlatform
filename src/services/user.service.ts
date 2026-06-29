import { arrayRemove, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";

import { db } from "../firebase/config";

export type ProjectUser = {
  uid: string;
  email: string;
  name: string;
  photoURL: string;
  status: string;
  role: string;
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
    projectsSnapshot.docs
      .filter((projectDoc) => {
        const userIds = projectDoc.data().userIds;

        return Array.isArray(userIds) && userIds.includes(uid);
      })
      .map((projectDoc) =>
        updateDoc(projectDoc.ref, {
          userIds: arrayRemove(uid),
          updatedAt: serverTimestamp(),
        }),
      ),
  );
}
