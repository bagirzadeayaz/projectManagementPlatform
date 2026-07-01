import {
  OAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { defaultLanguage, normalizeLanguage, type Language } from "../utils/i18n";
import { auth, db, storage, useMemoryAuthPersistence } from "./config";

export type DbUser = {
  docId: string;
  uid: string;
  email: string;
  name: string;
  photoURL: string;
  role: string;
  status: string;
  roleId?: string;
  preferences: UserPreferences;
};

export type UserPreferences = {
  theme: string;
  language: string;
};

const emailUnverifiedStatus = "email-unverified";
const maxProfilePictureBytes = 3 * 1024 * 1024;
const authOperationTimeoutMs = 20000;
const microsoftProvider = new OAuthProvider("microsoft.com");

microsoftProvider.setCustomParameters({
  prompt: "select_account",
});

function signOutSilently() {
  void signOut(auth).catch(() => undefined);
}

function withAuthTimeout<Result>(operation: Promise<Result>) {
  return new Promise<Result>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error("auth/operation-timeout"));
    }, authOperationTimeoutMs);

    operation
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeoutId));
  });
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readPreferences(value: unknown): UserPreferences {
  if (!value || typeof value !== "object") {
    return {
      theme: "light",
      language: defaultLanguage,
    };
  }

  const preferences = value as Record<string, unknown>;

  return {
    theme: readString(preferences.theme, "light"),
    language: normalizeLanguage(preferences.language),
  };
}

async function readRole(data: Record<string, unknown>, uid: string, email: string) {
  const roleFromUser = readString(data.role);
  const roleId = readString(data.roleId);

  if (roleId) {
    const roleDoc = await getDoc(doc(db, "roles", roleId));

    if (roleDoc.exists()) {
      const roleData = roleDoc.data();

      return {
        role: readString(roleData.name, readString(roleData.role, roleFromUser)),
      };
    }
  }

  const rolesByUid = await getDocs(query(collection(db, "roles"), where("uid", "==", uid)));

  if (!rolesByUid.empty) {
    const roleData = rolesByUid.docs[0].data();

    return {
      role: readString(roleData.name, readString(roleData.role, roleFromUser)),
    };
  }

  const rolesByEmail = await getDocs(query(collection(db, "roles"), where("email", "==", email.trim())));

  if (!rolesByEmail.empty) {
    const roleData = rolesByEmail.docs[0].data();

    return {
      role: readString(roleData.name, readString(roleData.role, roleFromUser)),
    };
  }

  return {
    role: roleFromUser || "user",
  };
}

async function toDbUser(
  data: Record<string, unknown>,
  docId: string,
  fallbackUid: string,
  fallbackEmail: string,
): Promise<DbUser> {
  const email = typeof data.email === "string" ? data.email : fallbackEmail;
  const uid = readString(data.uid, fallbackUid);
  const role = await readRole(data, uid, email);

  return {
    docId,
    uid,
    email,
    name: readString(data.name),
    photoURL: readString(data.photoURL),
    role: role.role,
    status: readString(data.status, "approved"),
    roleId: readString(data.roleId) || undefined,
    preferences: readPreferences(data.preferences),
  };
}

async function findUserProfile(uid: string, email: string) {
  const userDoc = await getDoc(doc(db, "users", uid));

  if (userDoc.exists()) {
    return toDbUser(userDoc.data(), userDoc.id, uid, email);
  }

  const usersRef = collection(db, "users");
  const emailQuery = query(usersRef, where("email", "==", email.trim()));
  const emailSnapshot = await getDocs(emailQuery);

  if (!emailSnapshot.empty) {
    return toDbUser(emailSnapshot.docs[0].data(), emailSnapshot.docs[0].id, uid, email);
  }

  return null;
}

async function createMicrosoftProfile(user: User, email: string, language: Language): Promise<DbUser> {
  const displayName = user.displayName?.trim() || email.split("@")[0] || "";
  const role = await readRole({}, user.uid, email);
  const profile: DbUser = {
    docId: user.uid,
    uid: user.uid,
    email,
    name: displayName,
    photoURL: user.photoURL ?? "",
    role: role.role,
    status: "approved",
    preferences: {
      theme: "light",
      language: normalizeLanguage(language),
    },
  };

  await setDoc(doc(db, "users", user.uid), {
    ...profile,
    authProvider: "microsoft.com",
    emailVerified: true,
    microsoftUid: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return profile;
}

async function getApprovedProfile(user: User, fallbackEmail: string, language: Language = defaultLanguage) {
  await user.reload();

  const email = (user.email ?? fallbackEmail).trim();

  if (!email) {
    signOutSilently();
    throw new Error("Microsoft account did not provide an email address.");
  }

  const profile = await findUserProfile(user.uid, email);

  if (!profile) {
    return createMicrosoftProfile(user, email, language);
  }

  if (profile.status === "denied") {
    signOutSilently();
    throw new Error("The account request was denied.");
  }

  const displayName = user.displayName?.trim();
  const photoURL = user.photoURL ?? "";
  const nextName = profile.name || displayName || "";
  const nextPhotoURL = profile.photoURL || photoURL;
  const nextStatus = profile.status === emailUnverifiedStatus || profile.status === "pending"
    ? "approved"
    : profile.status || "approved";

  await updateDoc(doc(db, "users", profile.docId), {
    authProvider: "microsoft.com",
    email,
    emailVerified: true,
    microsoftUid: user.uid,
    name: nextName,
    photoURL: nextPhotoURL,
    status: nextStatus,
    updatedAt: serverTimestamp(),
  });

  return {
    ...profile,
    email,
    name: nextName,
    photoURL: nextPhotoURL,
    status: nextStatus,
  };
}

export function observeAuthProfile(
  onProfile: (profile: DbUser | null) => void,
  onError: (error: Error) => void,
) {
  return onAuthStateChanged(auth, (firebaseUser) => {
    if (!firebaseUser) {
      onProfile(null);
      return;
    }

    void getApprovedProfile(firebaseUser, firebaseUser.email ?? "")
      .then(onProfile)
      .catch((profileError) => {
        onProfile(null);
        onError(profileError instanceof Error ? profileError : new Error("Unable to restore signed-in session."));
      });
  });
}

export async function signInWithMicrosoft(language: Language = defaultLanguage) {
  await useMemoryAuthPersistence();

  const credential = await withAuthTimeout(signInWithPopup(auth, microsoftProvider));
  return getApprovedProfile(credential.user, credential.user.email ?? "", language);
}

export async function updateUserPersonalization(
  user: DbUser,
  update: {
    name: string;
    preferences?: Partial<UserPreferences>;
    photoURL?: string;
  },
) {
  const preferences = {
    ...user.preferences,
    ...update.preferences,
    language: normalizeLanguage(update.preferences?.language ?? user.preferences.language),
  };
  const photoURL = update.photoURL ?? user.photoURL;

  await updateDoc(doc(db, "users", user.docId), {
    name: update.name,
    photoURL,
    preferences,
    updatedAt: serverTimestamp(),
  });

  return {
    ...user,
    name: update.name,
    photoURL,
    preferences,
  };
}

async function deleteProfilePictureFromStorage(photoURL: string) {
  if (!photoURL) {
    return;
  }

  try {
    await deleteObject(ref(storage, photoURL));
  } catch (deleteError) {
    const code = typeof deleteError === "object" && deleteError ? (deleteError as { code?: unknown }).code : "";

    if (code !== "storage/object-not-found") {
      throw deleteError;
    }
  }
}

export async function uploadUserProfilePicture(user: DbUser, file: File) {
  if (file.size > maxProfilePictureBytes) {
    throw new Error("Profile photo must be 3 MB or smaller.");
  }

  const extension = file.name.split(".").pop() || "jpg";
  const pictureRef = ref(storage, `profile-pictures/${user.uid}/${Date.now()}.${extension}`);

  await uploadBytes(pictureRef, file);
  return getDownloadURL(pictureRef);
}

export async function removeUserProfilePicture(user: DbUser) {
  await deleteProfilePictureFromStorage(user.photoURL);

  await updateDoc(doc(db, "users", user.docId), {
    photoURL: "",
    updatedAt: serverTimestamp(),
  });

  return {
    ...user,
    photoURL: "",
  };
}

export function logout() {
  return signOut(auth);
}
