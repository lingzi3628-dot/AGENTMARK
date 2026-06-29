"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth-store";
import { onAuth, handleRedirect, type FbUser } from "@/lib/firebase";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let unsub = () => {};

    (async () => {
      const redirected = await handleRedirect().catch(() => null);
      if (redirected) await syncUser(redirected);

      unsub = onAuth(async (fbUser: FbUser | null) => {
        useAuth.getState().setFbUser(fbUser);
        if (fbUser) {
          await syncUser(fbUser);
        } else {
          useAuth.getState().setUser(null);
        }
        useAuth.getState().setLoading(false);
      });
    })();

    return () => unsub();
  }, []);

  return <>{children}</>;
}

async function syncUser(fbUser: FbUser) {
  try {
    const res = await fetch("/api/auth/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        uid: fbUser.uid,
        email: fbUser.email,
        name: fbUser.displayName,
        photoURL: fbUser.photoURL,
      }),
    });
    if (res.ok) {
      const u = await res.json();
      useAuth.getState().setUser(u);
    }
  } catch {
    // non-fatal
  }
}
