"use client";

import { Toaster as Sonner } from "sonner";
import { useStudio } from "@/lib/store";

export function StudioToaster() {
  const theme = useStudio((s) => s.theme);
  return (
    <Sonner
      theme={theme}
      richColors
      position="bottom-right"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
    />
  );
}
