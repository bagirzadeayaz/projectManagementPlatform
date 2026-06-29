import { getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: "AIzaSyBZDnivFrMsnHyHeLcLw7oxfimF0RbwXfM",
  authDomain: "test-df08b.firebaseapp.com",
  projectId: "test-df08b",
  storageBucket: "test-df08b.firebasestorage.app",
  messagingSenderId: "845323878273",
  appId: "1:845323878273:web:d1ed84f062efe9a81eb280",
  measurementId: "G-G7B689X0X4",
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

let authPersistencePromise: Promise<void> | null = null;

export function useMemoryAuthPersistence() {
  authPersistencePromise ??= setPersistence(auth, browserLocalPersistence);
  return authPersistencePromise;
}
