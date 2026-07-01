import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";

import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { auth, db, storage, useMemoryAuthPersistence } from "./config";
import { normalizeLanguage, type Language } from "../utils/i18n";

export type AuthCredentials = {
  email: string;
  password: string;
  name?: string;
};

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

function getFirebaseErrorCode(error: unknown) {
  return typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
}

function getVerificationSentMessage(language: Language) {
  return language === "az"
    ? "Təsdiq e-poçtu göndərildi. E-poçt ünvanınızı təsdiqləyin, sonra qeydiyyatı tamamlamaq üçün yenidən daxil olun."
    : "Verification email sent. Verify your email address, then sign in again to complete registration.";
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readPreferences(value: unknown): UserPreferences {
  if (!value || typeof value !== "object") {
    return {
      theme: "light",
      language: "en",
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
    status: readString(data.status, emailUnverifiedStatus),
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

async function getApprovedProfile(user: User, fallbackEmail: string) {
  await user.reload();
  const profile = await findUserProfile(user.uid, user.email ?? fallbackEmail);

  if (!profile) {
    signOutSilently();
    throw new Error("User profile was not found in the database.");
  }

  if (profile.status === "denied") {
    signOutSilently();
    throw new Error("The account request was denied.");
  }

  if (!user.emailVerified) {
    signOutSilently();
    throw new Error("Verify your email address to complete registration. Check your inbox for the Firebase verification email.");
  }

  if (profile.status === emailUnverifiedStatus || profile.status === "pending") {
    await updateDoc(doc(db, "users", profile.docId), {
      status: "approved",
      emailVerified: true,
      updatedAt: serverTimestamp(),
    });

    return {
      ...profile,
      status: "approved",
    };
  }

  return profile;
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

export async function loginWithEmail({ email, password }: AuthCredentials) {
  await useMemoryAuthPersistence();

  const credential = await withAuthTimeout(signInWithEmailAndPassword(auth, email, password));
  return getApprovedProfile(credential.user, email);
}

export async function registerWithEmail({ email, password, name }: AuthCredentials, language: Language = "en") {
  await useMemoryAuthPersistence();

  const normalizedLanguage = normalizeLanguage(language);
  let credential: Awaited<ReturnType<typeof createUserWithEmailAndPassword>>;

  try {
    credential = await withAuthTimeout(createUserWithEmailAndPassword(auth, email, password));
  } catch (registerError) {
    if (getFirebaseErrorCode(registerError) !== "auth/email-already-in-use") {
      throw registerError;
    }

    return sendNewRegistrationVerification({ email, password, name }, normalizedLanguage);
  }

  const user = credential.user;
  const displayName = name?.trim() ?? "";

  if (displayName) {
    await updateProfile(user, { displayName });
  }

  const profile: DbUser = {
    docId: user.uid,
    uid: user.uid,
    email: user.email ?? email.trim(),
    name: displayName,
    photoURL: "",
    role: "user",
    status: emailUnverifiedStatus,
    preferences: {
      theme: "light",
      language: normalizedLanguage,
    },
  };

  await setDoc(doc(db, "users", user.uid), {
    ...profile,
    emailVerified: false,
    createdAt: serverTimestamp(),
  });

  await withAuthTimeout(sendEmailVerification(user));

  signOutSilently();
  throw new Error(getVerificationSentMessage(normalizedLanguage));
}

export async function resetPassword(email: string) {
  await useMemoryAuthPersistence();
  return withAuthTimeout(sendPasswordResetEmail(auth, email));
}

async function sendNewRegistrationVerification({ email, password, name }: AuthCredentials, language: Language) {
  const credential = await withAuthTimeout(signInWithEmailAndPassword(auth, email, password));
  const user = credential.user;
  const displayName = name?.trim() ?? "";
  await user.reload();

  if (user.emailVerified) {
    const profile = await findUserProfile(user.uid, user.email ?? email);

    if (profile && (profile.status === emailUnverifiedStatus || profile.status === "pending")) {
      await updateDoc(doc(db, "users", profile.docId), {
        status: "approved",
        emailVerified: true,
        updatedAt: serverTimestamp(),
      });
    }

    signOutSilently();
    throw new Error(
      language === "az"
        ? "E-poçt artıq təsdiqlənib. Hesaba daxil ola bilərsiniz."
        : "Email is already verified. You can sign in now.",
    );
  }

  const profile = await findUserProfile(user.uid, user.email ?? email);

  if (profile?.status === "denied") {
    signOutSilently();
    throw new Error(language === "az" ? "Hesab sorğusu rədd edilib." : "The account request was denied.");
  }

  if (displayName && user.displayName !== displayName) {
    await updateProfile(user, { displayName });
  }

  await setDoc(doc(db, "users", profile?.docId ?? user.uid), {
    uid: user.uid,
    email: user.email ?? email.trim(),
    name: displayName || profile?.name || "",
    photoURL: profile?.photoURL || "",
    role: profile?.role || "user",
    status: profile?.status || emailUnverifiedStatus,
    preferences: profile?.preferences ?? {
      theme: "light",
      language,
    },
    emailVerified: false,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  try {
    await withAuthTimeout(sendEmailVerification(user));
  } finally {
    signOutSilently();
  }

  throw new Error(getVerificationSentMessage(language));
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
