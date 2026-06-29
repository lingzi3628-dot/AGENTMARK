"use client";

import { useStudio } from "@/lib/store";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Menu, Plus, Sun, Moon, Github, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { StudioView } from "@/lib/types";

const TITLES: Record<StudioView, { title: string; sub: string }> = {
  dashboard: { title: "Dashboard", sub: "Your agents and recent activity" },
  studio: { title: "Studio", sub: "Design agents on a visual canvas" },
  run: { title: "Run", sub: "Execute an agent and chat" },
  templates: { title: "Templates", sub: "Start from a pre-built agent" },
  knowledge: { title: "Knowledge", sub: "Documents and context for your agents" },
  publish: { title: "Publish", sub: "Embed your agent on any website" },
  integrations: { title: "Integrations", sub: "Connect agents to your platforms" },
};

export function Topbar() {
  const { view, theme, toggleTheme, setSidebarOpen, setView } = useStudio();
  const t = TITLES[view];

  function newAgent() {
    useStudio.getState().setActiveAgent(null);
    useStudio.getState().setGraph([], []);
    useStudio.getState().setNewAgentRequested(true);
    setView("studio");
    toast.success("New agent draft ready", {
      description: "Drag nodes onto the canvas to start building.",
    });
  }

  return (
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
        <a
          href="https://github.com/giselles-ai/giselle"
          target="_blank"
          rel="noreferrer"
          className="hidden sm:inline-flex"
        >
          <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="GitHub">
            <Github className="h-4 w-4" />
          </Button>
        </a>
        <Button onClick={newAgent} className="h-9 gap-1.5">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Agent</span>
        </Button>
      </div>
    </header>
  );
}

export { TITLES };
