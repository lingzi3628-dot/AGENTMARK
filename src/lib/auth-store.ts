"use client";

import { create } from "zustand";
import type { FbUser } from "./firebase";

export interface AppUser {
  id: string;
  firebaseUid: string;
  email: string;
  name: string;
  photoURL: string;
  plan: string;
  dailyTokenLimit: number;
  maxAgents: number;
  tokensUsedToday: number;
  tokenResetDate: string;
  glmApiKey: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  hasGlmKey: boolean;
  hasOpenaiKey: boolean;
  hasAnthropicKey: boolean;
  stripeCustomerId: string;
  stripePriceId: string;
}

interface AuthState {
  user: AppUser | null;
  fbUser: FbUser | null;
  loading: boolean;
  setUser: (u: AppUser | null) => void;
  setFbUser: (u: FbUser | null) => void;
  setLoading: (l: boolean) => void;
  signOut: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  fbUser: null,
  loading: true,
  setUser: (u) => set({ user: u }),
  setFbUser: (u) => set({ fbUser: u }),
  setLoading: (l) => set({ loading: l }),
  signOut: () => set({ user: null, fbUser: null }),
}));
