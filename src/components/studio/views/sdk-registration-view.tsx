"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  KeyRound, Download, Check, Loader2, Zap, FileCode, Gift,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RegisterResult {
  ok: boolean;
  message: string;
  apiKey?: string;
  apiKeyPrefix?: string;
  sdkDownloadUrl?: string;
  email?: string;
  name?: string;
  alreadyRegistered?: boolean;
}

export function SdkRegistrationView() {
  const [form, setForm] = useState({ name: "", email: "", company: "", useCase: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function register() {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/sdk/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as RegisterResult & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }
      setResult(data);
      toast.success(data.alreadyRegistered ? "Welcome back!" : "Registration successful!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  function copyKey() {
    if (result?.apiKey) {
      navigator.clipboard.writeText(result.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("API key copied");
    }
  }

  function downloadSdk() {
    if (result?.sdkDownloadUrl) {
      window.open(result.sdkDownloadUrl, "_blank");
    }
  }

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      <div className="mx-auto max-w-2xl space-y-5">
        {/* Header */}
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Get the AGENTMARK SDK</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Register to get your free API key + 100K tokens/day + SDK download.
              </p>
            </div>
          </div>
        </Card>

        {/* Benefits */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center">
            <Zap className="mx-auto h-5 w-5 text-amber-500" />
            <div className="mt-1 text-xs font-medium">100K tokens/day</div>
            <div className="text-[10px] text-muted-foreground">Free forever</div>
          </Card>
          <Card className="p-3 text-center">
            <FileCode className="mx-auto h-5 w-5 text-primary" />
            <div className="mt-1 text-xs font-medium">Web SDK</div>
            <div className="text-[10px] text-muted-foreground">TypeScript</div>
          </Card>
          <Card className="p-3 text-center">
            <Gift className="mx-auto h-5 w-5 text-emerald-500" />
            <div className="mt-1 text-xs font-medium">Free API key</div>
            <div className="text-[10px] text-muted-foreground">Instant access</div>
          </Card>
        </div>

        {!result ? (
          /* Registration form */
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold">Register for free access</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Full name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="John Doe"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@example.com"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Company (optional)</Label>
                <Input
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="Acme Inc."
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Use case (optional)</Label>
                <Input
                  value={form.useCase}
                  onChange={(e) => setForm((f) => ({ ...f, useCase: e.target.value }))}
                  placeholder="Customer support automation"
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <Button onClick={register} disabled={loading} className="w-full gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {loading ? "Registering…" : "Register & Get API Key"}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              By registering, you agree to the AGENTMARK Terms of Service.
              Your email is used only for account management — never sold.
            </p>
          </Card>
        ) : (
          /* Success — show API key + download */
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <Check className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  {result.alreadyRegistered ? "Welcome back!" : "Registration successful!"}
                </p>
                <p className="text-xs text-muted-foreground">{result.message}</p>
              </div>
            </div>

            {/* API Key */}
            {result.apiKey && (
              <div className="space-y-1.5">
                <Label className="text-xs">Your API Key (shown once — save it now!)</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={result.apiKey}
                    readOnly
                    className="h-9 font-mono text-sm"
                  />
                  <Button size="sm" onClick={copyKey} className="gap-1.5 shrink-0">
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <KeyRound className="h-4 w-4" />}
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
                <p className="text-[11px] text-amber-500">
                  ⚠️ This key is shown only once. Copy it now — you won't see it again.
                </p>
              </div>
            )}

            {/* SDK Download */}
            {result.sdkDownloadUrl && (
              <div className="space-y-2">
                <Label className="text-xs">Download the SDK</Label>
                <Button onClick={downloadSdk} variant="outline" className="w-full gap-1.5">
                  <Download className="h-4 w-4" />
                  Download agentmark-sdk.ts
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  The SDK source code is private — only available to registered users.
                  Do not redistribute.
                </p>
              </div>
            )}

            {/* Usage example */}
            <div className="space-y-1.5">
              <Label className="text-xs">Quick start</Label>
              <pre className="rounded-md bg-muted/40 p-3 text-xs font-mono overflow-x-auto">
{`import { AgentMark } from "./agentmark-sdk";

const client = new AgentMark("${result.apiKey?.slice(0, 12) || "am_live_..."}...");

// List agents
const agents = await client.listAgents();

// Run an agent
const result = await client.runAgent("agent-id", "Hello!");
console.log(result.output);`}
              </pre>
            </div>

            <Button variant="outline" size="sm" onClick={() => setResult(null)} className="w-full">
              Register another account
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
