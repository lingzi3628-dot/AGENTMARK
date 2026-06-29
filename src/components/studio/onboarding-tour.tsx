"use client";

import { useState, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import { Sparkles, ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "agentmark.onboarded";
const TOTAL_STEPS = 5;

// Read localStorage via useSyncExternalStore so the initial render matches
// between server (empty snapshot) and client (real value) — no hydration
// warning, no setState-in-effect lint violation.
const subscribeNoop = () => () => {};
const getOnboardedClient = (): string => {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
};
const getOnboardedServer = (): string => "";

type Step = "welcome" | "build" | "run" | "templates" | "done";

interface GuideContent {
  stepNumber: number;
  title: string;
  description: string;
  highlight: string;
}

const GUIDES: Record<"build" | "run" | "templates", GuideContent> = {
  build: {
    stepNumber: 2,
    title: "Build visually",
    description:
      "Drag nodes onto a canvas and connect them to compose multi-model AI agents.",
    highlight: "Studio",
  },
  run: {
    stepNumber: 3,
    title: "Run your agent",
    description:
      "Chat with your agent and watch its workflow execute step-by-step with streaming AI.",
    highlight: "Run",
  },
  templates: {
    stepNumber: 4,
    title: "Start from a template",
    description:
      "Skip the blank canvas — fork a pre-built agent like Research Assistant or Code Reviewer.",
    highlight: "Templates",
  },
};

/**
 * OnboardingTour
 *
 * A self-contained, first-visit guided tour of AGENTMARK.
 * - Step 1: welcome modal (centered, with backdrop)
 * - Steps 2-4: floating guide cards pointing at sidebar nav items
 * - Step 5: "You're all set" modal (centered, with backdrop)
 *
 * Persists dismissal via localStorage("agentmark.onboarded").
 * Renders null on every subsequent visit.
 */
export function OnboardingTour() {
  const onboarded = useSyncExternalStore(
    subscribeNoop,
    getOnboardedClient,
    getOnboardedServer,
  );
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState<Step>("welcome");

  const active = !onboarded && !dismissed;

  const finish = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  const next = () => {
    if (step === "welcome") setStep("build");
    else if (step === "build") setStep("run");
    else if (step === "run") setStep("templates");
    else if (step === "templates") setStep("done");
    else if (step === "done") finish();
  };

  const back = () => {
    if (step === "build") setStep("welcome");
    else if (step === "run") setStep("build");
    else if (step === "templates") setStep("run");
  };

  if (!active) return null;

  // ---------- Step 1: Welcome modal ----------
  if (step === "welcome") {
    return (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
          onClick={finish}
          aria-hidden="true"
        />
        <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-welcome-title"
          >
            <button
              onClick={finish}
              className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              aria-label="Skip tour"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2
                id="onboarding-welcome-title"
                className="text-xl font-semibold tracking-tight"
              >
                Welcome to AGENTMARK
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Design, run, and ship multi-model AI agents on a visual canvas.
                Here&apos;s a 30-second tour of the essentials.
              </p>
              <div className="mt-6 flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-center">
                <Button
                  variant="ghost"
                  onClick={finish}
                  className="sm:min-w-[110px]"
                >
                  Skip
                </Button>
                <Button onClick={next} className="sm:min-w-[140px]">
                  Start tour
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </>
    );
  }

  // ---------- Step 5: Done modal ----------
  if (step === "done") {
    return (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
          onClick={finish}
          aria-hidden="true"
        />
        <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-done-title"
          >
            <button
              onClick={finish}
              className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              aria-label="Close tour"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Sparkles className="h-7 w-7" />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-primary">
                Step {TOTAL_STEPS} of {TOTAL_STEPS}
              </span>
              <h2
                id="onboarding-done-title"
                className="mt-2 text-xl font-semibold tracking-tight"
              >
                You&apos;re all set.
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                That&apos;s the tour. Jump into the Studio, fork a template, or
                chat with an agent — anytime from the sidebar.
              </p>
              <Button
                onClick={finish}
                className="mt-6 w-full sm:w-auto sm:min-w-[180px]"
              >
                Get started
              </Button>
            </div>
          </motion.div>
        </div>
      </>
    );
  }

  // ---------- Steps 2-4: Floating guide cards ----------
  const guide = GUIDES[step];
  const isLastGuide = guide.stepNumber === TOTAL_STEPS - 1;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]" aria-live="polite">
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 12, x: 6 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className={cn(
          "pointer-events-auto absolute",
          // Mobile: full-width bottom sheet
          "inset-x-0 bottom-0 rounded-t-2xl border border-border bg-card p-5 shadow-2xl",
          // Desktop: ~320px floating card bottom-right
          "sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[320px] sm:rounded-2xl sm:p-6",
        )}
        role="dialog"
        aria-modal="false"
        aria-labelledby={`onboarding-step-${guide.stepNumber}-title`}
      >
        {/* Animated arrow pointing left toward the sidebar (desktop only) */}
        <motion.div
          className="absolute -left-9 top-1/2 hidden -translate-y-1/2 text-primary sm:block"
          initial={{ x: 0 }}
          animate={{ x: [0, -8, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden="true"
        >
          <ArrowLeft className="h-7 w-7" strokeWidth={2.5} />
        </motion.div>

        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-primary">
            Step {guide.stepNumber} of {TOTAL_STEPS}
          </span>
          <button
            onClick={finish}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:hidden"
            aria-label="Skip tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h3
          id={`onboarding-step-${guide.stepNumber}-title`}
          className="text-base font-semibold tracking-tight"
        >
          {guide.title}
        </h3>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {guide.description}
        </p>
        <p className="mt-3 text-xs text-muted-foreground/80">
          Look for{" "}
          <span className="font-medium text-foreground">
            &quot;{guide.highlight}&quot;
          </span>{" "}
          in the sidebar.
        </p>

        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            onClick={finish}
            className="text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={back}>
              Back
            </Button>
            <Button size="sm" onClick={next}>
              {isLastGuide ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
