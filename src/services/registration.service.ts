import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";

import { db } from "../firebase/config";

export type PendingUserStatus = "pending" | "approved" | "denied" | "created";

export type PendingUser = {
  id: string;
  uid?: string;
  name: string;
  email: string;
  role: string;
  status: PendingUserStatus;
};

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readStatus(value: unknown): PendingUserStatus {
  return value === "approved" || value === "denied" || value === "created" ? value : "pending";
}

function toPendingUser(id: string, data: Record<string, unknown>): PendingUser {
  return {
    id,
    uid: readString(data.uid) || undefined,
    name: readString(data.name),
    email: readString(data.email),
    role: readString(data.role, "user"),
    status: readStatus(data.status),
  };
}

export async function findPendingUserByEmail(email: string) {
  const pendingQuery = query(collection(db, "pendingUsers"), where("email", "==", email.trim()));
  const snapshot = await getDocs(pendingQuery);

  if (snapshot.empty) {
    return null;
  }

  return toPendingUser(snapshot.docs[0].id, snapshot.docs[0].data());
}

export async function requestPendingUser(input: { name: string; email: string; uid: string; role?: string }) {
  const existingRequest = await findPendingUserByEmail(input.email);

  if (existingRequest) {
    await updateDoc(doc(db, "pendingUsers", existingRequest.id), {
      uid: input.uid,
      name: input.name.trim() || existingRequest.name,
      role: input.role ?? existingRequest.role,
      status: existingRequest.status === "denied" ? "denied" : "pending",
      updatedAt: serverTimestamp(),
    });

    return existingRequest;
  }

  const pendingRef = await addDoc(collection(db, "pendingUsers"), {
    uid: input.uid,
    name: input.name.trim(),
    email: input.email.trim(),
    role: input.role ?? "user",
    status: "pending",
    requestedAt: serverTimestamp(),
  });

  return {
    id: pendingRef.id,
    uid: input.uid,
    name: input.name.trim(),
    email: input.email.trim(),
    role: input.role ?? "user",
    status: "pending" as const,
  };
}

export async function getPendingUsers() {
  const pendingQuery = query(collection(db, "pendingUsers"), where("status", "==", "pending"));
  const snapshot = await getDocs(pendingQuery);

  return snapshot.docs.map((pendingDoc) => toPendingUser(pendingDoc.id, pendingDoc.data()));
}

export async function reviewPendingUser(input: {
  pendingUserId: string;
  status: "approved" | "denied";
  reviewedBy: string;
}) {
  const pendingRef = doc(db, "pendingUsers", input.pendingUserId);
  const pendingSnapshot = await getDoc(pendingRef);

  if (!pendingSnapshot.exists()) {
    throw new Error("Pending user was not found.");
  }

  const pendingUser = toPendingUser(pendingSnapshot.id, pendingSnapshot.data());

  await updateDoc(doc(db, "pendingUsers", input.pendingUserId), {
    status: input.status,
    reviewedBy: input.reviewedBy,
    reviewedAt: serverTimestamp(),
  });

  if (pendingUser.uid) {
    await updateDoc(doc(db, "users", pendingUser.uid), {
      role: pendingUser.role,
      status: input.status,
      reviewedBy: input.reviewedBy,
      reviewedAt: serverTimestamp(),
    });
  }
}

export async function markPendingUserCreated(input: { pendingUserId: string; uid: string }) {
  await updateDoc(doc(db, "pendingUsers", input.pendingUserId), {
    status: "created",
    uid: input.uid,
    createdAt: serverTimestamp(),
  });
}
