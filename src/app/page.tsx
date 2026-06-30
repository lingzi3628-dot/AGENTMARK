"use client";

import { useEffect } from "react";
import { AuthProvider } from "@/components/studio/auth-provider";
import { LoginScreen } from "@/components/studio/login-screen";
import { Sidebar } from "@/components/studio/sidebar";
import { Topbar } from "@/components/studio/topbar";
import { StudioFooter } from "@/components/studio/footer";
import { DashboardView } from "@/components/studio/views/dashboard";
import { StudioCanvas } from "@/components/studio/views/studio-canvas";
import { RunView } from "@/components/studio/views/run-view";
import { TemplatesView } from "@/components/studio/views/templates-view";
import { KnowledgeView } from "@/components/studio/views/knowledge-view";
import { PublishView } from "@/components/studio/views/publish-view";
import { IntegrationsView } from "@/components/studio/views/integrations-view";
import { SchedulesView } from "@/components/studio/views/schedules-view";
import { CustomerView } from "@/components/studio/views/customer-view";
import { SettingsView } from "@/components/studio/views/settings-view";
import { AnalyticsView } from "@/components/studio/views/analytics-view";
import { BillingView } from "@/components/studio/views/billing-view";
import { ApiKeysView } from "@/components/studio/views/api-keys-view";
import { TeamsView } from "@/components/studio/views/teams-view";
import { HistoryView } from "@/components/studio/views/history-view";
import { MarketplaceView } from "@/components/studio/views/marketplace-view";
import { ApprovalsView } from "@/components/studio/views/approvals-view";
import { OptimizeView } from "@/components/studio/views/optimize-view";
import { DebugView } from "@/components/studio/views/debug-view";
import { NodeMetricsView } from "@/components/studio/views/node-metrics-view";
import { OnboardingTour } from "@/components/studio/onboarding-tour";
import { useStudio } from "@/lib/store";
import { useAuth } from "@/lib/auth-store";
import type { Agent, Template, KnowledgeItem } from "@/lib/types";

export default function Home() {
  const { view, theme, setAgents } = useStudio();
  const { user, loading } = useAuth();

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Bootstrap data (only when authenticated)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [agentsRes, templatesRes, knowledgeRes] = await Promise.all([
          fetch("/api/agents"),
          fetch("/api/templates"),
          fetch("/api/knowledge"),
        ]);
        if (cancelled) return;
        if (agentsRes.ok) {
          const data = (await agentsRes.json()) as Agent[];
          setAgents(data);
        }
        if (templatesRes.ok) {
          const data = (await templatesRes.json()) as Template[];
          (window as unknown as { __templates?: Template[] }).__templates = data;
        }
        if (knowledgeRes.ok) {
          const data = (await knowledgeRes.json()) as KnowledgeItem[];
          (window as unknown as { __knowledge?: KnowledgeItem[] }).__knowledge = data;
        }
      } catch {
        // non-fatal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, setAgents]);

  return (
    <AuthProvider>
      {loading ? (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="flex h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !user ? (
        <LoginScreen />
      ) : (
        <div className="min-h-screen bg-background">
          <Sidebar />
          <div className="flex min-h-screen flex-col lg:pl-64">
            <Topbar />
            <main className="flex flex-1 flex-col overflow-hidden">
              {view === "dashboard" && <DashboardView onOpenStudio={() => useStudio.getState().setView("studio")} />}
              {view === "studio" && <StudioCanvas />}
              {view === "run" && <RunView />}
              {view === "templates" && <TemplatesView />}
              {view === "knowledge" && <KnowledgeView />}
              {view === "publish" && <PublishView />}
              {view === "integrations" && <IntegrationsView />}
              {view === "schedules" && <SchedulesView />}
              {view === "customer" && <CustomerView />}
              {view === "analytics" && <AnalyticsView />}
              {view === "billing" && <BillingView />}
              {view === "api-keys" && <ApiKeysView />}
              {view === "teams" && <TeamsView />}
              {view === "history" && <HistoryView />}
              {view === "marketplace" && <MarketplaceView />}
              {view === "approvals" && <ApprovalsView />}
              {view === "optimize" && <OptimizeView />}
              {view === "debug" && <DebugView />}
              {view === "node-metrics" && <NodeMetricsView />}
              {view === "settings" && <SettingsView />}
            </main>
            <StudioFooter />
          </div>
          <OnboardingTour />
        </div>
      )}
    </AuthProvider>
  );
}
