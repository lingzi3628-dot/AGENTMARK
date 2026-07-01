"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Terminal, Play, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const METHODS = ["GET", "POST", "PATCH", "DELETE"] as const;
type Method = typeof METHODS[number];

const ENDPOINTS = [
  { method: "GET" as Method, path: "/api/v1/agents", desc: "List your agents" },
  { method: "GET" as Method, path: "/api/v1/agents/{id}", desc: "Get agent details" },
  { method: "POST" as Method, path: "/api/v1/agents", desc: "Create agent" },
  { method: "POST" as Method, path: "/api/v1/agents/{id}/run", desc: "Run agent" },
  { method: "DELETE" as Method, path: "/api/v1/agents/{id}", desc: "Delete agent" },
  { method: "GET" as Method, path: "/api/v1/templates", desc: "List templates" },
  { method: "GET" as Method, path: "/api/v1/keys", desc: "List API keys" },
  { method: "POST" as Method, path: "/api/v1/keys", desc: "Create API key" },
];

export function ApiPlaygroundView() {
  const { user } = useAuth();
  const [method, setMethod] = useState<Method>("GET");
  const [path, setPath] = useState("/api/v1/agents");
  const [body, setBody] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [response, setResponse] = useState<string>("");
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function sendRequest() {
    setLoading(true);
    setResponse("");
    setStatus(null);
    try {
      const headers: Record<string, string> = {};
      if (apiKey) headers.authorization = `Bearer ${apiKey}`;
      if (body && (method === "POST" || method === "PATCH")) {
        headers["content-type"] = "application/json";
      }

      const res = await fetch(path, {
        method,
        headers,
        body: body && (method === "POST" || method === "PATCH") ? body : undefined,
      });
      setStatus(res.status);
      const text = await res.text();
      try {
        setResponse(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setResponse(text);
      }
    } catch (e) {
      setResponse(e instanceof Error ? e.message : "Request failed");
      setStatus(0);
    } finally {
      setLoading(false);
    }
  }

  function selectEndpoint(ep: { method: Method; path: string }) {
    setMethod(ep.method);
    setPath(ep.path);
    if (ep.method === "POST" && ep.path === "/api/v1/agents") {
      setBody(JSON.stringify({ name: "Test Agent", description: "Created via API Playground" }, null, 2));
    } else if (ep.method === "POST" && ep.path.includes("run")) {
      setBody(JSON.stringify({ input: "Hello! What can you do?" }, null, 2));
    } else {
      setBody("");
    }
  }

  function copyResponse() {
    navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        {/* Header */}
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">API Playground</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Test AGENTMARK's REST API interactively. Use your API key (from API Keys view).
              </p>
            </div>
          </div>
        </Card>

        {/* Endpoint presets */}
        <Card className="p-4">
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">Quick select</h3>
          <div className="flex flex-wrap gap-2">
            {ENDPOINTS.map((ep) => (
              <button
                key={`${ep.method}-${ep.path}`}
                onClick={() => selectEndpoint(ep)}
                className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <Badge variant="outline" className={cn(
                  "text-[9px] font-mono",
                  ep.method === "GET" && "text-blue-500",
                  ep.method === "POST" && "text-emerald-500",
                  ep.method === "PATCH" && "text-amber-500",
                  ep.method === "DELETE" && "text-red-500",
                )}>{ep.method}</Badge>
                <span className="font-mono">{ep.path}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* Request builder */}
        <Card className="p-4 space-y-3">
          <div className="flex gap-2">
            <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              className="flex-1 font-mono text-sm"
              placeholder="/api/v1/agents"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">API Key (Bearer token)</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="am_live_..."
              className="h-9 font-mono text-sm"
            />
          </div>

          {(method === "POST" || method === "PATCH") && (
            <div className="space-y-1.5">
              <Label className="text-xs">Request body (JSON)</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                className="font-mono text-xs"
                placeholder='{"key": "value"}'
              />
            </div>
          )}

          <Button onClick={sendRequest} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Send Request
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
      </div>
    </div>
  );
}
