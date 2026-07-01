"use client";

import { useStudio } from "@/lib/store";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Workflow, Play, LayoutTemplate, Database, Rocket,
  Sparkles, ChevronRight, X, Plug, Settings, MessagesSquare, BarChart3, Crown,
  KeyRound, Users, Clock, GitBranch, Store, ShieldCheck, Wand2, Bug, Activity, Zap, Brain, Bell, Webhook, GitFork, BookMarked, Terminal, GitCompare, Cpu, FileCode,
} from "lucide-react";
import type { StudioView } from "@/lib/types";

const NAV: { id: StudioView; label: string; icon: typeof LayoutDashboard; desc: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, desc: "Your agents & activity" },
  { id: "studio", label: "Studio", icon: Workflow, desc: "Visual agent builder" },
  { id: "run", label: "Run", icon: Play, desc: "Execute & chat" },
  { id: "templates", label: "Templates", icon: LayoutTemplate, desc: "Pre-built agents" },
  { id: "marketplace", label: "Marketplace", icon: Store, desc: "Community agents" },
  { id: "knowledge", label: "Knowledge", icon: Database, desc: "Context & documents" },
  { id: "publish", label: "Publish", icon: Rocket, desc: "Embed on any website" },
  { id: "integrations", label: "Integrations", icon: Plug, desc: "Connect to platforms" },
  { id: "schedules", label: "Schedules", icon: Clock, desc: "Cron jobs & triggers" },
  { id: "approvals", label: "Approvals", icon: ShieldCheck, desc: "Human-in-the-loop" },
  { id: "optimize", label: "Optimize", icon: Wand2, desc: "AI workflow analyzer" },
  { id: "debug", label: "Debug", icon: Bug, desc: "Test with sample data" },
  { id: "node-metrics", label: "Node Metrics", icon: Activity, desc: "Per-node performance" },
  { id: "history", label: "History", icon: GitBranch, desc: "Versions & branches" },
  { id: "customer", label: "Customer Mode", icon: MessagesSquare, desc: "AI talking points & drafts" },
  { id: "analytics", label: "Analytics", icon: BarChart3, desc: "Usage & token trends" },
  { id: "billing", label: "Billing", icon: Crown, desc: "Plans & pricing" },
  { id: "teams", label: "Teams", icon: Users, desc: "Shared workspaces" },
  { id: "api-keys", label: "API Keys", icon: KeyRound, desc: "Developer access" },
  { id: "connectors", label: "Connectors", icon: Zap, desc: "OAuth integrations" },
  { id: "insights", label: "Insights", icon: Brain, desc: "AI performance analysis" },
  { id: "notifications", label: "Notifications", icon: Bell, desc: "Email alerts" },
  { id: "webhook-log", label: "Webhook Log", icon: Webhook, desc: "Event history" },
  { id: "dependencies", label: "Dependencies", icon: GitFork, desc: "Agent call graph" },
  { id: "prompts", label: "Prompt Library", icon: BookMarked, desc: "Reusable prompts" },
  { id: "playground", label: "API Playground", icon: Terminal, desc: "Test REST API" },
  { id: "webhook-tester", label: "Webhook Tester", icon: Webhook, desc: "Send test webhooks" },
  { id: "comparison", label: "Compare Agents", icon: GitCompare, desc: "Side-by-side stats" },
  { id: "local-models", label: "Local Models", icon: Cpu, desc: "Free AI models" },
  { id: "sdk-register", label: "Get SDK", icon: FileCode, desc: "Register for API key" },
];

export function Sidebar() {
  const { view, setView, activeAgent, sidebarOpen, setSidebarOpen, agents } = useStudio();

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground glow-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold leading-tight">AGENTMARK</div>
            <div className="text-[11px] text-muted-foreground">by Spyro Technology</div>
          </div>
          <button
            className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3 studio-scroll">
          <div className="px-2 pb-1.5 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Workspace
          </div>
          {NAV.map((item) => {
            const active = view === item.id;
            const IconCmp = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
                  active
                    ? "bg-primary/12 text-primary font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <IconCmp className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                <span className="flex-1 text-left">{item.label}</span>
                {active && <ChevronRight className="h-4 w-4 text-primary" />}
              </button>
            );
          })}

          {activeAgent && (
            <>
              <div className="px-2 pb-1.5 pt-5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Editing
              </div>
              <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
                    <Icon name={activeAgent.icon} className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{activeAgent.name}</div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      {activeAgent.nodes.length} nodes
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {agents.length > 0 && (
            <>
              <div className="px-2 pb-1.5 pt-5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Recent
              </div>
              <div className="space-y-0.5">
                {agents.slice(0, 5).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      useStudio.getState().setActiveAgent(a);
                      setView("studio");
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  >
                    <Icon name={a.icon} className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{a.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </nav>

        {/* Settings / Profile */}
        <div className="border-t border-sidebar-border p-3">
          <button
            onClick={() => setView("settings")}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors",
              view === "settings"
                ? "bg-primary/12 text-primary"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Settings className="h-4 w-4" />
            <span className="flex-1 text-left">Settings & Profile</span>
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </aside>
    </>
  );
}
