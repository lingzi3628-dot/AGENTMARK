"use client";

import { useState } from "react";
import { useStudio } from "@/lib/store";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { AIBuilderModal } from "@/components/studio/ai-builder-modal";
import { Menu, Plus, Sun, Moon, Sparkles } from "lucide-react";
import type { StudioView } from "@/lib/types";

const TITLES: Record<StudioView, { title: string; sub: string }> = {
  dashboard: { title: "Dashboard", sub: "Your agents and recent activity" },
  studio: { title: "Studio", sub: "Design agents on a visual canvas" },
  run: { title: "Run", sub: "Execute an agent and chat" },
  templates: { title: "Templates", sub: "Start from a pre-built agent" },
  knowledge: { title: "Knowledge", sub: "Documents and context for your agents" },
  publish: { title: "Publish", sub: "Embed your agent on any website" },
  integrations: { title: "Integrations", sub: "Connect agents to your platforms" },
  customer: { title: "Customer Mode", sub: "AI-generated talking points & message drafts" },
  analytics: { title: "Analytics", sub: "Usage, tokens, and trends" },
  billing: { title: "Billing", sub: "Plans, pricing, and your subscription" },
  settings: { title: "Settings", sub: "Profile, API keys, and limits" },
};

export function Topbar() {
  const { view, theme, toggleTheme, setSidebarOpen, setView } = useStudio();
  const { user } = useAuth();
  const [builderOpen, setBuilderOpen] = useState(false);
  const t = TITLES[view];

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-6">
        <button
          className="rounded-md p-2 text-muted-foreground hover:bg-accent lg:hidden"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold leading-tight sm:text-lg">
            {t.title}
          </h1>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">{t.sub}</p>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* User avatar */}
          {user && (
            <button
              onClick={() => setView("settings")}
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-border transition-colors hover:border-primary/50"
              aria-label="Settings"
            >
              {user.photoURL ? (
                 
                <img src={user.photoURL} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-semibold">{user.name?.[0]?.toUpperCase() || "?"}</span>
              )}
            </button>
          )}

          <Button onClick={() => setBuilderOpen(true)} className="h-9 gap-1.5">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Agent</span>
          </Button>
        </div>
      </header>

      <AIBuilderModal open={builderOpen} onOpenChange={setBuilderOpen} />
    </>
  );
}

export { TITLES };
