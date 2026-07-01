"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  FileText, Shield, Check, Sparkles,
} from "lucide-react";

const ACCEPTED_KEY = "agentmark.tos_accepted";
const ACCEPTED_VERSION = "1.0";
const PRIVACY_KEY = "agentmark.privacy_accepted";

export function TermsAcceptance({ onAccept }: { onAccept: () => void }) {
  const [acceptedTos, setAcceptedTos] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  // Lazy init: check localStorage on first client render
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false;
    const tos = localStorage.getItem(ACCEPTED_KEY);
    const privacy = localStorage.getItem(PRIVACY_KEY);
    if (tos === ACCEPTED_VERSION && privacy === ACCEPTED_VERSION) {
      // Already accepted — call onAccept after mount
      setTimeout(() => onAccept(), 0);
      return false;
    }
    return true;
  });

  useEffect(() => {
    // This effect is intentionally empty — the lazy init above handles the check.
    // We keep the effect to satisfy the hook ordering rules.
  }, []);

  function handleAccept() {
    if (!acceptedTos || !acceptedPrivacy) return;
    localStorage.setItem(ACCEPTED_KEY, ACCEPTED_VERSION);
    localStorage.setItem(PRIVACY_KEY, ACCEPTED_VERSION);
    setShow(false);
    onAccept();
  }

  return (
    <Dialog open={show} onOpenChange={() => { /* can't close without accepting */ }}>
      <DialogContent className="max-w-2xl max-h-[90vh]" >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            Welcome to AGENTMARK
          </DialogTitle>
          <DialogDescription>
            Built by Spyro Technology in collaboration with AGENTMARK
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto max-h-[55vh] pr-2">
          {/* Terms of Service */}
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-primary" />
              Terms of Service
            </h3>
            <ScrollArea className="h-40 rounded-md border border-border p-3 text-xs text-muted-foreground">
              <div className="space-y-2">
                <p><strong>1. Acceptance of Terms</strong><br />By using AGENTMARK, you agree to these terms. If you don't agree, don't use the service.</p>
                <p><strong>2. Use of Service</strong><br />AGENTMARK is provided as-is for building and running AI agents. You're responsible for your agents' actions and outputs.</p>
                <p><strong>3. Privacy</strong><br />We collect minimal data (email, name, usage stats) to provide the service. Your API keys are encrypted at rest. See Privacy Policy below.</p>
                <p><strong>4. Acceptable Use</strong><br />Don't use AGENTMARK for: spam, illegal activities, harassment, or generating harmful content. Violations result in account termination.</p>
                <p><strong>5. API Keys & Billing</strong><br />You're responsible for any costs incurred through your API keys (OpenAI, Anthropic, etc.). Billing is processed via Paystack.</p>
                <p><strong>6. Open Source</strong><br />AGENTMARK is MIT-licensed. You can self-host and modify. The official hosted version is maintained by Spyro Technology.</p>
                <p><strong>7. Limitation of Liability</strong><br />AGENTMARK is provided "as is" without warranties. We're not liable for data loss, agent errors, or service interruptions.</p>
                <p><strong>8. Changes</strong><br />We may update these terms. Continued use after changes constitutes acceptance.</p>
                <p className="pt-2 text-muted-foreground/60">Last updated: July 2026 · Version 1.0</p>
              </div>
            </ScrollArea>
          </div>

          {/* Privacy Policy */}
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Shield className="h-4 w-4 text-primary" />
              Privacy Policy
            </h3>
            <ScrollArea className="h-40 rounded-md border border-border p-3 text-xs text-muted-foreground">
              <div className="space-y-2">
                <p><strong>1. Data We Collect</strong><br />• Email + name (from Google login)<br />• Usage data (agents created, runs, tokens used)<br />• API keys (encrypted with AES-256-GCM)<br />• Optional: analytics data (if enabled)</p>
                <p><strong>2. How We Use Data</strong><br />To provide the service, enforce rate limits, prevent abuse, and improve features. We never sell your data.</p>
                <p><strong>3. Data Storage</strong><br />Data is stored in our database. API keys are encrypted at rest. Payment processing is handled by Paystack — we never see your card details.</p>
                <p><strong>4. Data Deletion</strong><br />You can delete your account at any time via Settings. This permanently removes all your agents, runs, and data.</p>
                <p><strong>5. Open Source Analytics</strong><br />If you self-host AGENTMARK, you can optionally send anonymous usage analytics to help improve the project. This is opt-in and disabled by default.</p>
                <p><strong>6. Cookies</strong><br />We use localStorage for preferences (theme, language, onboarding). No tracking cookies.</p>
                <p><strong>7. Contact</strong><br />Questions about privacy? Open an issue at github.com/lingzi3628-dot/AGENTMARK</p>
                <p className="pt-2 text-muted-foreground/60">Last updated: July 2026 · Version 1.0</p>
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Acceptance checkboxes */}
        <div className="space-y-3 border-t border-border pt-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={acceptedTos}
              onCheckedChange={(v) => setAcceptedTos(v === true)}
              className="mt-0.5"
            />
            <span className="text-xs text-muted-foreground">
              I have read and agree to the <strong>Terms of Service</strong>
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={acceptedPrivacy}
              onCheckedChange={(v) => setAcceptedPrivacy(v === true)}
              className="mt-0.5"
            />
            <span className="text-xs text-muted-foreground">
              I have read and agree to the <strong>Privacy Policy</strong>
            </span>
          </label>

          <div className="flex items-center justify-between gap-2 pt-2">
            <Badge variant="outline" className="text-[10px] gap-1">
              <Sparkles className="h-2.5 w-2.5" /> Built by Spyro Technology × AGENTMARK
            </Badge>
            <Button onClick={handleAccept} disabled={!acceptedTos || !acceptedPrivacy} className="gap-1.5">
              <Check className="h-4 w-4" /> Accept & Continue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
