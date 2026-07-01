"use client";

import { useState } from "react";
import { useStudio } from "@/lib/store";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AIBuilderModal } from "@/components/studio/ai-builder-modal";
import { Menu, Plus, Sun, Moon, Globe } from "lucide-react";
import type { StudioView } from "@/lib/types";
import { LOCALES, LOCALE_NAMES, getStoredLocale, setStoredLocale, type Locale } from "@/lib/i18n";

const TITLES: Record<StudioView, { title: string; sub: string }> = {
  dashboard: { title: "Dashboard", sub: "Your agents and recent activity" },
  studio: { title: "Studio", sub: "Design agents on a visual canvas" },
  run: { title: "Run", sub: "Execute an agent and chat" },
  templates: { title: "Templates", sub: "Start from a pre-built agent" },
  marketplace: { title: "Marketplace", sub: "Browse community agents" },
  knowledge: { title: "Knowledge", sub: "Documents and context for your agents" },
  publish: { title: "Publish", sub: "Embed your agent on any website" },
  integrations: { title: "Integrations", sub: "Connect agents to your platforms" },
  schedules: { title: "Schedules", sub: "Auto-run agents on a cron schedule" },
  approvals: { title: "Approvals", sub: "Review pending workflow steps" },
  optimize: { title: "Optimize", sub: "AI-powered workflow analysis" },
  debug: { title: "Debug", sub: "Test workflows with sample data" },
  "node-metrics": { title: "Node Metrics", sub: "Per-node performance & bottlenecks" },
  history: { title: "History", sub: "Version history & branches" },
  customer: { title: "Customer Mode", sub: "AI-generated talking points & message drafts" },
  analytics: { title: "Analytics", sub: "Usage, tokens, and trends" },
  billing: { title: "Billing", sub: "Plans, pricing, and your subscription" },
  teams: { title: "Teams", sub: "Shared workspaces & members" },
  "api-keys": { title: "API Keys", sub: "Programmatic access for developers" },
  connectors: { title: "Connectors", sub: "OAuth integrations with Google, GitHub, Slack, and more" },
  settings: { title: "Settings", sub: "Profile, API keys, and limits" },
};

export function Topbar() {
  const { view, theme, toggleTheme, setSidebarOpen, setView } = useStudio();
  const { user } = useAuth();
  const [builderOpen, setBuilderOpen] = useState(false);
  // Lazy init: reads localStorage on first client render (avoids set-state-in-effect)
  const [locale, setLocale] = useState<Locale>(() =>
    typeof window === "undefined" ? "en" : getStoredLocale(),
  );
  const t = TITLES[view];

  function changeLocale(l: Locale) {
    setLocale(l);
    setStoredLocale(l);
    // Reload to apply translations
    if (typeof window !== "undefined") window.location.reload();
  }

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
          {/* Language picker */}
          <Select value={locale} onValueChange={(v) => changeLocale(v as Locale)}>
            <SelectTrigger className="h-9 w-[40px] justify-center border-none px-0 sm:w-[110px]" aria-label="Language">
              <Globe className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline truncate">{LOCALE_NAMES[locale]}</span>
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map((l) => (
                <SelectItem key={l} value={l}>
                  {LOCALE_NAMES[l]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
