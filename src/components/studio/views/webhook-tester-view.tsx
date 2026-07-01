"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Webhook, Play, Loader2, Copy, Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const METHODS = ["POST", "GET", "PUT", "DELETE"] as const;

export function WebhookTesterView() {
  const [method, setMethod] = useState<(typeof METHODS)[number]>("POST");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [body, setBody] = useState(JSON.stringify({ event: "test", data: { message: "Hello from AGENTMARK" } }, null, 2));
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState<number | null>(null);
  const [headers, setHeaders] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function sendTest() {
    if (!url.trim()) {
      toast.error("Webhook URL is required");
      return;
    }
    setLoading(true);
    setResponse("");
    setStatus(null);
    try {
      const reqHeaders: Record<string, string> = {
        "content-type": "application/json",
      };
      // If a secret is provided, generate HMAC-SHA256 signature
      if (secret) {
        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey(
          "raw", enc.encode(secret),
          { name: "HMAC", hash: "SHA-256" },
          false, ["sign"],
        );
        const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
        const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
        reqHeaders["X-Webhook-Signature"] = hex;
      }
      // Parse custom headers
      if (headers.trim()) {
        try {
          const parsed = JSON.parse(headers);
          Object.assign(reqHeaders, parsed);
        } catch {
          // ignore invalid JSON
        }
      }

      const res = await fetch(url, {
        method,
        headers: reqHeaders,
        body: method !== "GET" ? body : undefined,
      });
      setStatus(res.status);
      const text = await res.text();
      try {
        setResponse(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setResponse(text.slice(0, 2000));
      }
      toast.success(`Webhook responded with ${res.status}`);
    } catch (e) {
      setResponse(e instanceof Error ? e.message : "Request failed");
      setStatus(0);
      toast.error("Webhook request failed");
    } finally {
      setLoading(false);
    }
  }

  function copyResponse() {
    navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Header */}
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Webhook className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Webhook Tester</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Send test requests to any webhook URL. Optionally sign with HMAC-SHA256.
              </p>
            </div>
          </div>
        </Card>

        {/* Request config */}
        <Card className="p-4 space-y-3">
          <div className="flex gap-2">
            <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-app.com/api/triggers/webhook/am_xxx"
              className="flex-1 font-mono text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Secret (optional — generates HMAC-SHA256 signature)
            </Label>
            <Input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="webhook secret"
              className="h-9 font-mono text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Custom headers (JSON, optional)</Label>
            <Textarea
              value={headers}
              onChange={(e) => setHeaders(e.target.value)}
              rows={2}
              className="font-mono text-xs"
              placeholder='{"X-Custom-Header": "value"}'
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Body (JSON)</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              className="font-mono text-xs"
            />
          </div>

          <Button onClick={sendTest} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Send Test Webhook
          </Button>
        </Card>

        {/* Response */}
        {response && (
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium">Response</h3>
                {status !== null && (
                  <Badge variant="outline" className={cn(
                    "text-[10px]",
                    status >= 200 && status < 300 ? "text-emerald-500" : "text-red-500",
                  )}>
                    {status}
                  </Badge>
                )}
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={copyResponse}>
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <pre className="max-h-96 overflow-auto rounded-md bg-muted/40 p-3 text-xs font-mono">
              {response}
            </pre>
          </Card>
        )}

        {/* Help */}
        <Card className="p-4 border-dashed">
          <h3 className="mb-2 text-sm font-medium">How to use</h3>
          <ol className="space-y-1 text-xs text-muted-foreground">
            <li>1. Go to <strong>Schedules</strong> → create a webhook trigger for any agent</li>
            <li>2. Copy the webhook URL</li>
            <li>3. Paste it above, add a secret if you set one on the trigger</li>
            <li>4. Click "Send Test Webhook" — see the agent's response</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
