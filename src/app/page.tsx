"use client";

import { useEffect } from "react";
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
import { OnboardingTour } from "@/components/studio/onboarding-tour";
import { useStudio } from "@/lib/store";
import type { Agent, Template, KnowledgeItem } from "@/lib/types";

export default function Home() {
  const { view, theme, setAgents, setView } = useStudio();

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Bootstrap data
  useEffect(() => {
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
          useStudio.getState().setAgents(useStudio.getState().agents); // no-op keep
          // store templates in a module-level cache via window
          (window as unknown as { __templates?: Template[] }).__templates = data;
        }
        if (knowledgeRes.ok) {
          const data = (await knowledgeRes.json()) as KnowledgeItem[];
          (window as unknown as { __knowledge?: KnowledgeItem[] }).__knowledge = data;
        }
      } catch {
        // network errors are non-fatal for render
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-h-screen flex-col lg:pl-64">
        <Topbar />
        <main className="flex flex-1 flex-col overflow-hidden">
          {view === "dashboard" && <DashboardView onOpenStudio={() => setView("studio")} />}
          {view === "studio" && <StudioCanvas />}
          {view === "run" && <RunView />}
          {view === "templates" && <TemplatesView />}
          {view === "knowledge" && <KnowledgeView />}
          {view === "publish" && <PublishView />}
          {view === "integrations" && <IntegrationsView />}
        </main>
        <StudioFooter />
      </div>
      <OnboardingTour />
    </div>
  );
}
