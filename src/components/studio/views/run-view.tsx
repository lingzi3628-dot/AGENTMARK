"use client";

import { useEffect, useRef, useState } from "react";
import { useStudio } from "@/lib/store";
import { useAuth } from "@/lib/auth-store";
import { Icon } from "@/components/icon";
import { Markdown } from "@/components/studio/markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Send, Square, Bot, User, Sparkles, Workflow, Play, ArrowLeft,
  CheckCircle2, Loader2, AlertCircle, Clock, MessageSquare, History,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import type { ChatMessage, Agent, RunRecord } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 10);

export function RunView() {
  const { activeAgent, agents, setActiveAgent, setView, messages, setMessages, addMessage, appendToMessage, finalizeMessage, isRunning, setRunning, runTrace, setRunTrace, addRun, runs, setRuns } = useStudio();
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [historyTab, setHistoryTab] = useState<"trace" | "history">("trace");
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, runTrace]);

  // Load run history when an agent is selected
  useEffect(() => {
    if (!activeAgent) return;
    fetch(`/api/agents/${activeAgent.id}/runs`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: RunRecord[]) => setRuns(data))
      .catch(() => setRuns([]));
     
  }, [activeAgent?.id]);

  if (!activeAgent) {
    return <AgentPicker agents={agents} onPick={(a) => { setActiveAgent(a); }} onCreate={() => setView("studio")} />;
  }

  async function send() {
    const text = input.trim();
    if (!text || isRunning) return;
    setInput("");

    const userMsg: ChatMessage = { id: uid(), role: "user", content: text };
    const aiMsg: ChatMessage = { id: uid(), role: "assistant", content: "", streaming: true, trace: [] };
    addMessage(userMsg);
    addMessage(aiMsg);
    setRunning(true);
    setRunTrace([]);
    setHistoryTab("trace");

    const history = messages
      .filter((m) => m.role !== "system" && !m.streaming)
      .slice(-8)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/agents/${activeAgent!.id}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: text, history, firebaseUid: user?.firebaseUid }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error("Run failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalOutput = "";
      let tokens = 0;
      let duration = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const evt of events) {
          const lines = evt.split("\n");
          let type = "";
          let data = "";
          for (const line of lines) {
            if (line.startsWith("event:")) type = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (!type || !data) continue;
          let payload: { content?: string; node?: string; label?: string; status?: string; output?: string; tokens?: number; duration?: number; message?: string };
          try { payload = JSON.parse(data); } catch { continue; }

          if (type === "trace") {
            setRunTrace([...useStudio.getState().runTrace, { node: payload.node!, label: payload.label!, status: payload.status! }]);
          } else if (type === "delta") {
            appendToMessage(aiMsg.id, payload.content ?? "");
          } else if (type === "done") {
            finalOutput = payload.output ?? useStudio.getState().messages.find((m) => m.id === aiMsg.id)?.content ?? "";
            tokens = payload.tokens ?? 0;
            duration = payload.duration ?? 0;
          } else if (type === "error") {
            toast.error(payload.message ?? "Agent error");
          }
        }
      }

      finalizeMessage(aiMsg.id);
      // Persist the run to the database
      const run: RunRecord = {
        id: uid(), agentId: activeAgent!.id, input: text,
        output: finalOutput, status: "completed", tokens, duration,
        createdAt: new Date().toISOString(),
      };
      addRun(run);
      fetch(`/api/agents/${activeAgent!.id}/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(run),
      }).catch(() => undefined);
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        finalizeMessage(aiMsg.id);
        toast.info("Run stopped");
      } else {
        finalizeMessage(aiMsg.id);
        toast.error("Agent run failed");
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function loadHistoryRun(r: RunRecord) {
    setMessages([
      { id: uid(), role: "user", content: r.input },
      { id: uid(), role: "assistant", content: r.output },
    ]);
    setHistoryTab("trace");
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar: agent info + trace/history */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-card/40 lg:flex">
        <div className="border-b border-border p-4">
          <button onClick={() => setView("studio")} className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to studio
          </button>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <Icon name={activeAgent.icon} className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{activeAgent.name}</div>
              <div className="text-[11px] text-muted-foreground">{activeAgent.nodes.length} nodes · {activeAgent.category}</div>
            </div>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-border px-3 pt-2">
          {(["trace", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setHistoryTab(t)}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium capitalize transition-colors",
                historyTab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "trace" ? <Workflow className="h-3.5 w-3.5" /> : <History className="h-3.5 w-3.5" />}
              {t}
              {t === "history" && runs.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 text-[10px]">{runs.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto studio-scroll p-4">
          {historyTab === "trace" ? (
            <>
              <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <Workflow className="h-3.5 w-3.5" /> Execution trace
              </h4>
              {runTrace.length === 0 && !isRunning ? (
                <p className="text-xs text-muted-foreground">Send a message to see the agent execute its workflow.</p>
              ) : (
                <ol className="space-y-1.5">
                  {runTrace.map((t, i) => (
                    <li key={i} className="flex items-center gap-2 rounded-md border border-border bg-background p-2 text-xs">
                      <TraceIcon status={t.status} />
                      <span className="flex-1 truncate font-medium">{t.label}</span>
                      <span className="text-[10px] uppercase text-muted-foreground">{t.status}</span>
                    </li>
                  ))}
                  {isRunning && (
                    <li className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-2 text-xs text-primary">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Executing…
                    </li>
                  )}
                </ol>
              )}

              <h4 className="mb-2 mt-6 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" /> Workflow
              </h4>
              <div className="space-y-1">
                {activeAgent.nodes.map((n) => (
                  <div key={n.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-[11px]">
                    <span className={cn("h-1.5 w-1.5 rounded-full", kindDot(n.data.kind))} />
                    <span className="truncate">{n.data.label || n.data.kind}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <History className="h-3.5 w-3.5" /> Past runs
              </h4>
              {runs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No runs yet. Send a message to start.</p>
              ) : (
                <div className="space-y-1.5">
                  {runs.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => loadHistoryRun(r)}
                      className="block w-full rounded-md border border-border bg-background p-2 text-left transition-colors hover:border-primary/50 hover:bg-accent"
                    >
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                        <span className="ml-auto">{r.tokens} tok</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs">{r.input}</p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Chat */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                  <Bot className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="font-semibold">Run {activeAgent.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Send a message to execute this agent&apos;s workflow.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <MessageBubble key={m.id} m={m} />
            ))}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-border bg-card/60 p-3 backdrop-blur lg:p-4">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={`Message ${activeAgent.name}…`}
              rows={1}
              className="min-h-[44px] max-h-40 resize-none bg-background"
            />
            {isRunning ? (
              <Button size="icon" variant="destructive" onClick={stop} className="h-11 w-11 shrink-0" aria-label="Stop">
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="icon" onClick={send} disabled={!input.trim()} className="h-11 w-11 shrink-0" aria-label="Send">
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="mx-auto mt-1.5 max-w-3xl text-center text-[11px] text-muted-foreground">
            Agents execute their node graph with GLM models. Press Enter to send, Shift+Enter for newline.
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ m }: { m: ChatMessage }) {
  const isUser = m.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
        isUser ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary",
      )}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm", isUser ? "bg-primary text-primary-foreground" : "bg-card border border-border")}>
        {m.content ? (
          isUser ? (
            <div className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</div>
          ) : (
            <Markdown content={m.content} />
          )
        ) : m.streaming ? (
          <div className="flex items-center gap-1.5 py-1 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
          </div>
        ) : null}
        {m.streaming && m.content && (
          <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-current align-middle" />
        )}
      </div>
    </div>
  );
}

function TraceIcon({ status }: { status: string }) {
  if (status === "done") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  if (status === "error") return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
  if (status === "running" || status === "streaming") return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
  return <div className="h-3.5 w-3.5 rounded-full border border-border" />;
}

function kindDot(kind: string): string {
  switch (kind) {
    case "trigger": return "bg-emerald-500";
    case "model": return "bg-primary";
    case "tool": return "bg-amber-500";
    case "knowledge": return "bg-violet-500";
    case "image-gen": return "bg-pink-500";
    case "vision": return "bg-cyan-500";
    case "output": return "bg-rose-500";
    default: return "bg-muted-foreground";
  }
}

const SUGGESTIONS = [
  "Summarize the latest in AI agents",
  "Write a haiku about workflows",
  "Review this idea: an AI triage bot",
];

function AgentPicker({ agents, onPick, onCreate }: { agents: Agent[]; onPick: (a: Agent) => void; onCreate: () => void }) {
  const { setView } = useStudio();
  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto studio-scroll p-6">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <Play className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Select an agent to run</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a saved agent, or build a new one in the Studio.
        </p>
        <div className="mt-5 max-h-72 space-y-1.5 overflow-y-auto studio-scroll text-left">
          {agents.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No agents yet.</p>
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
                <div className="text-[11px] text-muted-foreground">{a.nodes.length} nodes</div>
              </div>
              <Play className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setView("templates")}>Templates</Button>
          <Button className="flex-1 gap-1.5" onClick={onCreate}>
            <Sparkles className="h-4 w-4" /> New agent
          </Button>
        </div>
      </Card>
    </div>
  );
}

// Keep MessageSquare import used for tree-shaking clarity
void MessageSquare;
