"use client";

import { Sparkles } from "lucide-react";

export function StudioFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-background/60 px-4 py-3 lg:px-6">
      <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>
            Giselle Studio — an open-source-inspired AI agent builder
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span>Powered by GLM models</span>
          <span className="h-3 w-px bg-border" />
          <a
            href="https://github.com/giselles-ai/giselle"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Apache-2.0
          </a>
        </div>
      </div>
    </footer>
  );
}
