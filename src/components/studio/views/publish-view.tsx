"use client";

import { useEffect, useState } from "react";
import { useStudio } from "@/lib/store";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Rocket, Code2, Copy, Check, ExternalLink, Globe, Sparkles, Loader2, Play, Info,
} from "lucide-react";
import { toast } from "sonner";
import type { Agent } from "@/lib/types";

interface PublishState {
  published: boolean;
  slug: string | null;
  enabled: boolean;
}

function getHost(): string {
  return typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";
}

export function PublishView() {
  const { activeAgent, agents, setActiveAgent, setView } = useStudio();

  if (!activeAgent) {
    return (
      <AgentPicker
        agents={agents}
        onPick={(a) => setActiveAgent(a)}
        onCreate={() => setView("studio")}
      />
    );
  }

  return <PublishBody agent={activeAgent} />;
}

function PublishBody({ agent }: { agent: Agent }) {
  const [state, setState] = useState<PublishState>({ published: false, slug: null, enabled: false });
  const [loading, setLoading] = useState(true);
  const [slugDraft, setSlugDraft] = useState("");
  const [toggling, setToggling] = useState(false);
  const [savingSlug, setSavingSlug] = useState(false);
  const [host, setHost] = useState<string>("https://your-domain.com");

  // Resolve client-side host once mounted to avoid SSR mismatch.
  useEffect(() => {
    setHost(getHost());
  }, []);

  // Load current publish status whenever the active agent changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/agents/${agent.id}/publish`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PublishState | null) => {
        if (cancelled || !data) return;
        setState(data);
        setSlugDraft(data.slug ?? "");
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agent.id]);

  const published = state.published && !!state.slug;
  const publicUrl = state.slug ? `${host}/embed/${state.slug}` : "";

  async function togglePublish(on: boolean) {
    setToggling(true);
    try {
      if (on) {
        const res = await fetch(`/api/agents/${agent.id}/publish`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(slugDraft ? { slug: slugDraft } : {}),
        });
        if (!res.ok) throw new Error("publish failed");
        const data = (await res.json()) as { slug: string; enabled: boolean };
        setState({ published: true, slug: data.slug, enabled: data.enabled });
        setSlugDraft(data.slug);
        toast.success("Agent published", {
          description: `Live at /embed/${data.slug}`,
        });
      } else {
        const res = await fetch(`/api/agents/${agent.id}/publish`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("unpublish failed");
        setState({ published: false, slug: null, enabled: false });
        toast.success("Agent unpublished", {
          description: "The widget is no longer accessible.",
        });
      }
    } catch {
      toast.error("Could not update publish status");
    } finally {
      setToggling(false);
    }
  }

  async function updateSlug() {
    const slug = slugDraft
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (!slug) {
      toast.error("Slug cannot be empty");
      return;
    }
    setSavingSlug(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (!res.ok) throw new Error("update failed");
      const data = (await res.json()) as { slug: string; enabled: boolean };
      setState({ published: true, slug: data.slug, enabled: data.enabled });
      setSlugDraft(data.slug);
      toast.success("Slug updated", { description: `/embed/${data.slug}` });
    } catch {
      toast.error("Could not update slug");
    } finally {
      setSavingSlug(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Section 1 — Publish status */}
        <Card className="p-5">
          <header className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <Icon name={agent.icon} className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold">{agent.name}</h2>
              <p className="truncate text-xs text-muted-foreground">
                {agent.category} · {agent.nodes.length} nodes
              </p>
            </div>
            {published && (
              <Badge variant="default" className="gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse" />
                Live
              </Badge>
            )}
          </header>

          <div className="mt-5 space-y-4">
            {/* Toggle */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Rocket className="h-4 w-4 text-primary" />
                  Publish this agent
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Make your agent accessible via an embeddable widget on any website.
                </p>
              </div>
              <Switch
                checked={published}
                disabled={loading || toggling}
                onCheckedChange={togglePublish}
                aria-label="Publish this agent"
              />
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading publish status…
              </div>
            ) : published ? (
              <div className="space-y-4">
                {/* Slug editor */}
                <div>
                  <label
                    htmlFor="publish-slug"
                    className="mb-1.5 block text-xs font-medium text-muted-foreground"
                  >
                    Public slug
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="publish-slug"
                      value={slugDraft}
                      onChange={(e) =>
                        setSlugDraft(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, "")
                            .slice(0, 48),
                        )
                      }
                      placeholder="my-agent"
                      className="flex-1 font-mono text-sm"
                    />
                    <Button
                      onClick={updateSlug}
                      disabled={savingSlug || slugDraft === state.slug}
                      className="gap-1.5 sm:w-auto"
                    >
                      {savingSlug ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Update slug
                    </Button>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Lowercase letters, numbers, and hyphens only.
                  </p>
                </div>

                {/* Public URL */}
                <div>
                  <label
                    htmlFor="publish-url"
                    className="mb-1.5 block text-xs font-medium text-muted-foreground"
                  >
                    Public URL
                  </label>
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <input
                      id="publish-url"
                      readOnly
                      value={publicUrl}
                      className="flex-1 min-w-0 truncate bg-transparent font-mono text-xs outline-none"
                    />
                    <a
                      href={`/embed/${state.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-primary hover:opacity-80"
                      aria-label="Open public URL"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        {/* Sections 2 & 3 — only when published */}
        {published && state.slug && (
          <>
            {/* Section 2 — Embed code */}
            <Card className="p-5">
              <header className="mb-4 flex items-center gap-2">
                <Code2 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Embed code</h3>
              </header>
              <Tabs defaultValue="script">
                <TabsList className="grid w-full max-w-sm grid-cols-3">
                  <TabsTrigger value="script">Script</TabsTrigger>
                  <TabsTrigger value="iframe">iframe</TabsTrigger>
                  <TabsTrigger value="react">React</TabsTrigger>
                </TabsList>
                <TabsContent value="script" className="mt-3">
                  <CodeBlock code={scriptSnippet(host, state.slug)} />
                </TabsContent>
                <TabsContent value="iframe" className="mt-3">
                  <CodeBlock code={iframeSnippet(host, state.slug)} />
                </TabsContent>
                <TabsContent value="react" className="mt-3">
                  <CodeBlock code={reactSnippet(host, state.slug)} />
                </TabsContent>
              </Tabs>
            </Card>

            {/* Section 3 — Live preview */}
            <Card className="p-5">
              <header className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Play className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Live preview</h3>
                </div>
                <a href={`/embed/${state.slug}`} target="_blank" rel="noreferrer">
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" /> Open
                  </Button>
                </a>
              </header>
              <iframe
                src={`/embed/${state.slug}`}
                title={`${agent.name} live preview`}
                className="h-[480px] w-full rounded-lg border border-border bg-background"
                allow="clipboard-write"
              />
            </Card>
          </>
        )}

        {/* Section 4 — Tips */}
        <div
          className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-xs text-muted-foreground"
          role="note"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            <span className="font-medium text-foreground">Tip:</span> publish your
            agent, then paste the embed code into your website&apos;s HTML. The widget
            works on any site that allows iframes.
          </p>
        </div>
      </div>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy code");
    }
  }

  return (
    <div className="group relative">
      <pre className="max-h-72 overflow-auto studio-scroll rounded-lg border border-border bg-muted/40 p-3.5 text-[12px] leading-relaxed">
        <code className="whitespace-pre font-mono text-foreground/90">{code}</code>
      </pre>
      <Button
        variant="secondary"
        size="sm"
        onClick={copy}
        className="absolute right-2 top-2 h-7 gap-1.5 px-2 text-xs opacity-80 hover:opacity-100"
        aria-label="Copy code"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function scriptSnippet(host: string, slug: string): string {
  return `<script>
  (function(){
    var s=document.createElement('script');
    // Lightweight loader
    var d=document.createElement('div'); d.id='giselle-widget';
    document.body.appendChild(d);
    var f=document.createElement('iframe');
    f.src='${host}/embed/${slug}';
    f.style.cssText='position:fixed;bottom:16px;right:16px;width:380px;height:600px;border:none;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.3);z-index:99999';
    f.setAttribute('allow','clipboard-write');
    document.body.appendChild(f);
  })();
</script>`;
}

function iframeSnippet(host: string, slug: string): string {
  return `<iframe src="${host}/embed/${slug}" width="380" height="600" style="border:none;border-radius:12px" allow="clipboard-write"></iframe>`;
}

function reactSnippet(host: string, slug: string): string {
  return `import { useRef } from "react";

export function AgentWidget() {
  const ref = useRef<HTMLIFrameElement>(null);
  return (
    <iframe
      ref={ref}
      src="${host}/embed/${slug}"
      width={380}
      height={600}
      style={{ border: "none", borderRadius: 12 }}
      allow="clipboard-write"
      title="AI Agent"
    />
  );
}`;
}

function AgentPicker({
  agents,
  onPick,
  onCreate,
}: {
  agents: Agent[];
  onPick: (a: Agent) => void;
  onCreate: () => void;
}) {
  const { setView } = useStudio();
  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto studio-scroll p-6">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <Rocket className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Select an agent to publish</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a saved agent, or build a new one in the Studio.
        </p>
        <div className="mt-5 max-h-72 space-y-1.5 overflow-y-auto studio-scroll text-left">
          {agents.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No agents yet.
            </p>
          )}
          {agents.map((a) => (
            <button
              key={a.id}
              onClick={() => onPick(a)}
              className="flex w-full items-center gap-2.5 rounded-lg border border-border p-2.5 transition-all hover:border-primary/50 hover:bg-accent"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/12 text-primary">
                <Icon name={a.icon} className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{a.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {a.nodes.length} nodes
                </div>
              </div>
              <Rocket className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
        <div className="mt-5 flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setView("templates")}
          >
            Templates
          </Button>
          <Button className="flex-1 gap-1.5" onClick={onCreate}>
            <Sparkles className="h-4 w-4" /> New agent
          </Button>
        </div>
      </Card>
    </div>
  );
}
