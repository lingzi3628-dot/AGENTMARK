"use client";

import { Sparkles, Cpu } from "lucide-react";

export function StudioFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-background/60 px-4 py-3 lg:px-6">
      <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>AGENTMARK — Build, run & ship AI agents</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Powered by AGENTMARK Free • 100K tokens/day</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>Built by</span>
          <a
            href="https://spyro.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-medium text-primary hover:underline"
          >
            <Cpu className="h-3 w-3" />
            Spyro Technology
          </a>
          <span>×</span>
          <span className="font-medium">AGENTMARK</span>
        </div>
      </div>
    </footer>
  );
}
