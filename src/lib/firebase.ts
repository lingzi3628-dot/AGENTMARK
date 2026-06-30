// Firebase client initialization for Google sign-in.
// Client-side only — used for auth, not for SDK calls.

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
  onAuthStateChanged,
  type Auth,
  type User as FbUser,
} from "firebase/auth";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyD_zWRWwX7V5aOPvSOWlKyZdEBlJQhL7LE",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "aethervid-1e73w.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "aethervid-1e73w",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "aethervid-1e73w.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "777013811265",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:777013811265:web:37baa211e6c1a497a38ec0",
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

export function getFirebase() {
  if (typeof window === "undefined") return { app: null, auth: null };
  if (!_app) {
    _app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    _auth = getAuth(_app);
  }
  return { app: _app, auth: _auth };
}

export async function signInWithGoogle(): Promise<FbUser | null> {
  const { auth } = getFirebase();
  if (!auth) return null;
  const provider = new GoogleAuthProvider();
  try {
    // Try popup first (works on desktop)
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch {
    // Fallback to redirect (works on mobile where popups are blocked)
    await signInWithRedirect(auth, provider);
    return null;
  }
}

export async function handleRedirect(): Promise<FbUser | null> {
  const { auth } = getFirebase();
  if (!auth) return null;
  const result = await getRedirectResult(auth);
  return result?.user ?? null;
}

export async function signOut(): Promise<void> {
  const { auth } = getFirebase();
  if (auth) await fbSignOut(auth);
}

export function onAuth(cb: (user: FbUser | null) => void): () => void {
  const { auth } = getFirebase();
  if (!auth) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, cb);
}

export type { FbUser };
