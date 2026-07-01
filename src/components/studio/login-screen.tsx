"use client";

import { useState } from "react";
import { signInWithGoogle } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Shield, UserCircle, Zap } from "lucide-react";
import { toast } from "sonner";

export function LoginScreen() {
  const { setUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  async function handleGoogle() {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch {
      setLoading(false);
    }
  }

  async function handleDemo() {
    setDemoLoading(true);
    try {
      // Create a demo user locally — no Firebase required
      const demoUser = {
        id: "demo-user",
        firebaseUid: "demo-user",
        email: "demo@agentmark.local",
        name: "Demo User",
        photoURL: "",
        plan: "free",
        dailyTokenLimit: 100000,
        maxAgents: 2,
        tokensUsedToday: 0,
        tokenResetDate: new Date().toISOString().slice(0, 10),
        glmApiKey: "",
        openaiApiKey: "",
        anthropicApiKey: "",
        supabaseUrl: "",
        supabaseAnonKey: "",
        hasGlmKey: false,
        hasOpenaiKey: false,
        hasAnthropicKey: false,
        stripeCustomerId: "",
        stripePriceId: "",
      };
      setUser(demoUser);
      toast.success("Welcome to AGENTMARK! (Demo Mode)");
    } catch {
      toast.error("Failed to start demo mode");
      setDemoLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground glow-primary">
            <Sparkles className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AGENTMARK</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Build, run & ship AI agents on a visual canvas
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground/70">
              Built by <span className="font-medium text-primary">Spyro Technology</span> × AGENTMARK
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/80 p-8 backdrop-blur">
          <h2 className="mb-1 text-lg font-semibold">Welcome</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Sign in with Google, or try the demo — no account needed.
          </p>

          {/* Google Login */}
          <Button
            onClick={handleGoogle}
            disabled={loading || demoLoading}
            className="w-full gap-3 h-12"
            size="lg"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </Button>

          {/* Divider */}
          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">OR</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Demo Mode */}
          <Button
            onClick={handleDemo}
            disabled={loading || demoLoading}
            variant="outline"
            className="w-full gap-2 h-12"
            size="lg"
          >
            {demoLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Zap className="h-5 w-5 text-primary" />
            )}
            Try Demo Mode (No Login)
          </Button>

          <div className="mt-6 flex items-center gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            <Shield className="h-4 w-4 shrink-0 text-primary" />
            <span>
              Google login is used for authentication only. Demo Mode stores data locally — perfect for trying AGENTMARK without an account.
            </span>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing, you agree to AGENTMARK&apos;s Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
