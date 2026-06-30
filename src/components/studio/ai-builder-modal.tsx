"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sparkles, PenTool, Wand2, Loader2, ArrowRight, Send, RefreshCw, Check, Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useStudio } from "@/lib/store";
import { useAuth } from "@/lib/auth-store";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import type { WorkflowNode, WorkflowEdge, Agent, NodeKind } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 10);

interface GeneratedWorkflow {
  name: string;
  description: string;
  icon: string;
  category: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  _fallback?: boolean;
}

interface BuilderMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  workflow?: GeneratedWorkflow;
  iteration?: number;
}

// Map a node kind to the icon name used by <Icon />.
const KIND_ICON: Record<NodeKind, string> = {
  trigger: "play",
  model: "sparkles",
  tool: "wrench",
  knowledge: "database",
  "image-gen": "image",
  vision: "eye",
  router: "git-branch",
  memory: "brain",
  output: "flag",
};

export function AIBuilderModal({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [mode, setMode] = useState<"choose" | "scratch" | "describe">("choose");
  const [scratchName, setScratchName] = useState("");
  // Multi-turn describe state
  const [messages, setMessages] = useState<BuilderMessage[]>([]);
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);

  const { setView, setGraph, setActiveAgent, upsertAgent } = useStudio();
  const { user } = useAuth();

  // Auto-scroll the message container to the bottom whenever a new message
  // arrives so the latest assistant summary is always visible.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, generating]);

  const iterationCount = messages.filter((m) => m.workflow).length;
  const latestWorkflow = [...messages].reverse().find((m) => m.workflow)?.workflow;

  function reset() {
    setMode("choose");
    setScratchName("");
    setMessages([]);
    setInput("");
    setGenerating(false);
  }

  function startOver() {
    setMessages([]);
    setInput("");
    setGenerating(false);
  }

  function createScratch() {
    // Create a blank agent with default nodes
    const nodes: WorkflowNode[] = [
      { id: `trigger-${uid()}`, type: "agent", position: { x: 80, y: 240 }, data: { label: "Input", kind: "trigger", content: "User message" } },
      { id: `model-${uid()}`, type: "agent", position: { x: 400, y: 240 }, data: { label: "GLM Model", kind: "model", provider: "glm-4.5-air", systemPrompt: "You are a helpful AI agent. Respond clearly and concisely." } },
      { id: `output-${uid()}`, type: "agent", position: { x: 720, y: 240 }, data: { label: "Response", kind: "output" } },
    ];
    const edges: WorkflowEdge[] = [
      { id: `e-${uid()}`, source: nodes[0].id, target: nodes[1].id, animated: true },
      { id: `e-${uid()}`, source: nodes[1].id, target: nodes[2].id, animated: true },
    ];
    void finishCreate(scratchName || "Untitled Agent", "", "sparkles", nodes, edges);
  }

  async function sendInitial() {
    if (!input.trim() || generating) return;
    const description = input.trim();
    const userMsg: BuilderMessage = { id: uid(), role: "user", content: description };
    // Append the user bubble to the UI; pass the PRIOR messages (before this
    // userMsg) as conversation history to the API so the latest user turn is
    // sent only via the `description` field and not duplicated.
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    await generate(messages, userMsg, description, false);
  }

  async function sendRefine() {
    if (!input.trim() || generating) return;
    const description = input.trim();
    const userMsg: BuilderMessage = { id: uid(), role: "user", content: description };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    await generate(messages, userMsg, description, true);
  }

  async function generate(
    priorMessages: BuilderMessage[],
    userMsg: BuilderMessage,
    description: string,
    refine: boolean,
  ) {
    setGenerating(true);
    try {
      // Build the history payload the API expects. For assistant turns we
      // send back the JSON we previously produced so the model can refine
      // against its own prior output. The current user turn is sent as
      // `description`, NOT included in history.
      const apiHistory = priorMessages
        .filter((m) => m.role === "user" || m.workflow)
        .map((m) => ({
          role: m.role,
          content:
            m.role === "assistant" && m.workflow
              ? JSON.stringify(m.workflow)
              : m.content,
        })) as { role: "user" | "assistant"; content: string }[];

      const res = await fetch("/api/agents/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description, history: apiHistory, refine }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as GeneratedWorkflow & { _error?: string };

      const nextIteration = priorMessages.filter((m) => m.workflow).length + 1;
      const assistantMsg: BuilderMessage = {
        id: uid(),
        role: "assistant",
        content: refine
          ? `Updated workflow — here's v${nextIteration}.`
          : `Here's a starter workflow based on your description.`,
        workflow: data,
        iteration: nextIteration,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (data._fallback) {
        toast.success("Workflow generated (using a template — AI had an issue)");
      } else {
        toast.success(refine ? `Workflow refined to v${nextIteration}` : "Workflow generated by AI");
      }
    } catch {
      toast.error("Could not generate workflow — try again");
      // Remove the user bubble that triggered this failed generation so the
      // user can edit and retry without a dangling message.
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setGenerating(false);
    }
  }

  async function finishCreate(name: string, description: string, icon: string, nodes: WorkflowNode[], edges: WorkflowEdge[]) {
    // Persist to DB
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, description, icon, nodes, edges, firebaseUid: user?.firebaseUid }),
      });
      if (res.ok) {
        const agent = (await res.json()) as Agent;
        upsertAgent(agent);
        setActiveAgent(agent);
      }
    } catch {
      // non-fatal
    }
    setGraph(nodes, edges);
    onOpenChange(false);
    reset();
    setView("studio");
  }

  async function createFromLatest() {
    if (!latestWorkflow) return;
    await finishCreate(
      latestWorkflow.name || "Untitled Agent",
      latestWorkflow.description,
      latestWorkflow.icon || "sparkles",
      latestWorkflow.nodes,
      latestWorkflow.edges,
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className={cn("gap-0 p-0", mode === "describe" ? "max-w-2xl" : "max-w-lg")}>
        <DialogHeader className={cn("p-6 pb-3", mode === "describe" && "border-b border-border")}>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {mode === "choose" && "Create a New Agent"}
            {mode === "scratch" && "Create from Scratch"}
            {mode === "describe" && "Describe an Idea"}
            {mode === "describe" && iterationCount > 0 && (
              <Badge variant="secondary" className="ml-1 gap-1">
                <Wand2 className="h-3 w-3" /> v{iterationCount}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === "choose" && "Choose how you'd like to build your agent."}
            {mode === "scratch" && "Start with a blank canvas and a basic Input → Model → Output workflow."}
            {mode === "describe" && "Describe what your agent should do — then refine it over multiple turns until it's right."}
          </DialogDescription>
        </DialogHeader>

        {mode === "choose" && (
          <div className="grid gap-3 px-6 pb-6">
            <button
              onClick={() => setMode("describe")}
              className="group flex items-start gap-3 rounded-xl border border-border p-4 text-left transition-all hover:border-primary/50 hover:bg-accent"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Wand2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5 font-medium">
                  Describe an Idea
                  <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-primary">AI</span>
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-semibold uppercase text-secondary-foreground">Multi-turn</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Tell the AI what you want, then refine over multiple turns until the workflow is right.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </button>

            <button
              onClick={() => setMode("scratch")}
              className="group flex items-start gap-3 rounded-xl border border-border p-4 text-left transition-all hover:border-primary/50 hover:bg-accent"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <PenTool className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Create from Scratch</div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Start with a blank canvas. Drag nodes, connect them, and build manually.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        )}

        {mode === "scratch" && (
          <div className="space-y-3 px-6 pb-6">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Agent name</label>
              <Input
                value={scratchName}
                onChange={(e) => setScratchName(e.target.value)}
                placeholder="My New Agent"
                className="h-9"
                autoFocus
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setMode("choose")}>Back</Button>
              <Button onClick={createScratch} className="flex-1 gap-1.5">
                <PenTool className="h-4 w-4" /> Create Agent
              </Button>
            </div>
          </div>
        )}

        {mode === "describe" && (
          <div className="flex flex-col">
            {/* Message stream */}
            <div
              ref={scrollRef}
              className="max-h-[400px] min-h-[180px] overflow-y-auto studio-scroll px-6 py-4"
            >
              {messages.length === 0 ? (
                <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Describe your agent idea</p>
                    <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                      e.g. "A research assistant that searches the web, summarizes sources, and writes a structured brief."
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        onClick={() => setInput(ex)}
                        className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                      >
                        {ex.length > 38 ? `${ex.slice(0, 38)}…` : ex}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {messages.map((m) =>
                    m.role === "user" ? (
                      <div key={m.id} className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground shadow-sm">
                          {m.content}
                        </div>
                      </div>
                    ) : (
                      <div key={m.id} className="flex justify-start">
                        <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-border bg-card px-3.5 py-2.5 text-sm shadow-sm">
                          {m.workflow ? (
                            <WorkflowSummary msg={m} />
                          ) : (
                            <p className="text-muted-foreground">{m.content}</p>
                          )}
                        </div>
                      </div>
                    ),
                  )}
                  {generating && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-border bg-card px-3.5 py-2.5 text-sm text-muted-foreground shadow-sm">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {iterationCount > 0 ? "Refining workflow…" : "Designing workflow…"}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-border p-4">
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    iterationCount > 0
                      ? "Refine: e.g. add a web search node, switch to glm-4.6, make the system prompt more concise…"
                      : "Describe what your agent should do…"
                  }
                  rows={2}
                  className="min-h-[44px] resize-none text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      if (iterationCount > 0) void sendRefine();
                      else void sendInitial();
                    }
                  }}
                />
                <Button
                  onClick={() => (iterationCount > 0 ? void sendRefine() : void sendInitial())}
                  disabled={!input.trim() || generating}
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  aria-label={iterationCount > 0 ? "Refine workflow" : "Generate workflow"}
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : iterationCount > 0 ? (
                    <RefreshCw className="h-4 w-4" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Action row */}
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {iterationCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={startOver}
                      className="h-8 gap-1.5 text-muted-foreground"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Start over
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMode("choose")}
                    className="h-8 gap-1.5 text-muted-foreground"
                  >
                    <ArrowRight className="h-3.5 w-3.5 rotate-180" /> Back
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  {iterationCount === 0 ? (
                    <p className="text-[11px] text-muted-foreground">Press Cmd/Ctrl+Enter to generate</p>
                  ) : (
                    <>
                      <span className="hidden text-[11px] text-muted-foreground sm:inline">
                        Latest: <span className="font-medium text-foreground">{latestWorkflow?.name}</span> · {latestWorkflow?.nodes.length ?? 0} nodes
                      </span>
                      <Button
                        onClick={createFromLatest}
                        disabled={generating || !latestWorkflow}
                        size="sm"
                        className="gap-1.5"
                      >
                        <Check className="h-4 w-4" /> Create Agent
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function WorkflowSummary({ msg }: { msg: BuilderMessage }) {
  const wf = msg.workflow;
  if (!wf) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        {msg.iteration && (
          <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">v{msg.iteration}</Badge>
        )}
        {wf._fallback && (
          <Badge variant="outline" className="h-4 px-1.5 text-[9px] text-amber-500 border-amber-500/40">template</Badge>
        )}
        <span className="font-medium">{wf.name}</span>
      </div>
      {wf.description && (
        <p className="text-xs text-muted-foreground">{wf.description}</p>
      )}
      <div className="space-y-1">
        {wf.nodes.map((n) => (
          <div key={n.id} className="flex items-center gap-2 text-xs">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/12 text-primary">
              <Icon name={KIND_ICON[n.data.kind] ?? "sparkles"} className="h-3 w-3" />
            </span>
            <span className="font-medium">{n.data.label || n.data.kind}</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{n.data.kind}</span>
            {n.data.kind === "model" && n.data.provider && (
              <span className="ml-auto text-[10px] text-muted-foreground">{n.data.provider}</span>
            )}
            {n.data.kind === "tool" && n.data.tool && (
              <span className="ml-auto text-[10px] text-muted-foreground">{n.data.tool}</span>
            )}
          </div>
        ))}
      </div>
      <p className="pt-0.5 text-[11px] text-muted-foreground">
        <Plus className="mr-1 inline h-3 w-3" />
        {wf.edges.length} connection{wf.edges.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}

const EXAMPLES = [
  "A research assistant that searches the web and writes a structured brief",
  "An AI code reviewer that finds bugs and rates severity",
  "A social media content generator that creates posts and images",
  "A support bot that routes tickets by keyword to different experts",
];
