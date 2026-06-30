"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import type { WorkflowNodeData, NodeKind } from "@/lib/types";

const KIND_STYLES: Record<NodeKind, { ring: string; chip: string; label: string }> = {
  trigger: { ring: "border-emerald-500/40", chip: "bg-emerald-500/15 text-emerald-500", label: "Trigger" },
  model: { ring: "border-primary/50", chip: "bg-primary/15 text-primary", label: "Model" },
  tool: { ring: "border-amber-500/40", chip: "bg-amber-500/15 text-amber-500", label: "Tool" },
  knowledge: { ring: "border-violet-500/40", chip: "bg-violet-500/15 text-violet-400", label: "Knowledge" },
  "image-gen": { ring: "border-pink-500/40", chip: "bg-pink-500/15 text-pink-500", label: "Image" },
  vision: { ring: "border-cyan-500/40", chip: "bg-cyan-500/15 text-cyan-500", label: "Vision" },
  router: { ring: "border-orange-500/40", chip: "bg-orange-500/15 text-orange-500", label: "Router" },
  memory: { ring: "border-teal-500/40", chip: "bg-teal-500/15 text-teal-500", label: "Memory" },
  "sub-agent": { ring: "border-violet-500/50", chip: "bg-violet-500/15 text-violet-400", label: "Sub-Agent" },
  code: { ring: "border-amber-500/40", chip: "bg-amber-500/15 text-amber-500", label: "Code" },
  approval: { ring: "border-amber-500/50", chip: "bg-amber-500/20 text-amber-400", label: "Approval" },
  output: { ring: "border-rose-500/40", chip: "bg-rose-500/15 text-rose-500", label: "Output" },
};

function AgentNodeBase({ data, selected }: NodeProps) {
  const d = data as WorkflowNodeData;
  const style = KIND_STYLES[d.kind];
  const hasTarget = d.kind !== "trigger";
  const hasSource = d.kind !== "output";

  return (
    <div
      className={cn(
        "relative w-56 rounded-xl border bg-card/95 shadow-md backdrop-blur transition-all",
        style.ring,
        selected && "ring-2 ring-primary glow-primary",
      )}
    >
      {hasTarget && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-3 !w-3 !border-2 !border-background"
          style={{ background: "var(--primary)" }}
        />
      )}

      <div className="flex items-center gap-2 border-b border-border/60 p-3">
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", style.chip)}>
          <Icon name={iconForKind(d.kind)} className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium leading-tight">{d.label || style.label}</div>
          <div className={cn("mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide", style.chip)}>
            {style.label}
          </div>
        </div>
        {d.status === "running" && (
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary pulse-ring" />
        )}
        {d.status === "done" && (
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
        )}
      </div>

      <div className="space-y-1 p-3 pt-2">
        {d.kind === "model" && (
          <>
            <NodeRow k="Model" v={providerName(d.provider)} />
            {d.systemPrompt && (
              <p className="line-clamp-2 rounded-md bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground">
                {d.systemPrompt}
              </p>
            )}
          </>
        )}
        {d.kind === "tool" && <NodeRow k="Tool" v={toolName(d.tool)} />}
        {d.kind === "knowledge" && (
          d.knowledgeIds && d.knowledgeIds.length > 0 ? (
            <NodeRow k="Linked" v={`${d.knowledgeIds.length} item${d.knowledgeIds.length > 1 ? "s" : ""}`} />
          ) : (
            <p className="line-clamp-2 text-[11px] text-muted-foreground">
              {d.content ? d.content : "No content"}
            </p>
          )
        )}
        {d.kind === "image-gen" && (
          <>
            <NodeRow k="Size" v={d.imageSize ?? "1024×1024"} />
            <p className="line-clamp-2 text-[11px] text-muted-foreground">
              Generates an image from the upstream prompt.
            </p>
          </>
        )}
        {d.kind === "vision" && (
          <>
            <NodeRow k="Model" v="GLM-4.5V" />
            {d.imageUrl ? (
              <div className="mt-1 overflow-hidden rounded-md border border-border">
                <img src={d.imageUrl} alt="vision input" className="h-16 w-full object-cover" />
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">No image attached</p>
            )}
          </>
        )}
        {d.kind === "router" && (
          <>
            <NodeRow k="Branches" v={`${d.routerConditions?.length ?? 0}`} />
            {(d.routerConditions ?? []).slice(0, 2).map((c, i) => (
              <p key={i} className="truncate text-[11px] text-muted-foreground">→ “{c.keyword}”</p>
            ))}
          </>
        )}
        {d.kind === "memory" && (
          <>
            <NodeRow k="Key" v={d.memoryKey || "default"} />
            <NodeRow k="Mode" v={d.memoryMode ?? "load"} />
          </>
        )}
        {d.kind === "sub-agent" && (
          <>
            <NodeRow k="Agent" v={d.subAgentId ? d.subAgentId.slice(0, 12) + "…" : "Not set"} />
            <p className="line-clamp-2 text-[11px] text-muted-foreground">
              {d.subAgentId
                ? "Invokes the selected agent's full workflow."
                : "Pick an agent to invoke from the inspector."}
            </p>
            {d.subAgentInputTemplate && d.subAgentInputTemplate !== "{{input}}" && (
              <p className="truncate rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {d.subAgentInputTemplate}
              </p>
            )}
          </>
        )}
        {d.kind === "code" && (
          <>
            <NodeRow k="Timeout" v={`${d.codeTimeout ?? 5000}ms`} />
            <pre className="line-clamp-3 rounded-md bg-muted/50 px-2 py-1 font-mono text-[10px] text-muted-foreground whitespace-pre-wrap">
              {d.code || "// Write custom JS in the inspector"}
            </pre>
          </>
        )}
        {d.kind === "approval" && (
          <>
            <NodeRow k="Timeout" v={`${d.approvalTimeoutHours ?? 168}h`} />
            <p className="line-clamp-2 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-500">
              {d.approvalMessage || "Pauses the workflow for human review."}
            </p>
          </>
        )}
        {d.kind === "tool" && d.tool === "http-request" && (
          <>
            <NodeRow k="Method" v={d.httpMethod ?? "GET"} />
            <p className="truncate text-[11px] text-muted-foreground">{d.httpUrl || "No URL set"}</p>
          </>
        )}
        {d.kind === "tool" && d.tool === "tts" && (
          <NodeRow k="Voice" v={d.ttsVoice ?? "default"} />
        )}
        {d.kind === "trigger" && (
          <p className="text-[11px] text-muted-foreground">{d.content || "User input"}</p>
        )}
        {d.kind === "output" && (
          <p className="text-[11px] text-muted-foreground">Final response</p>
        )}
      </div>

      {hasSource && (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-3 !w-3 !border-2 !border-background"
          style={{ background: "var(--primary)" }}
        />
      )}
    </div>
  );
}

function NodeRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-muted-foreground">{k}</span>
      <span className="truncate font-medium">{v}</span>
    </div>
  );
}

function iconForKind(kind: NodeKind): string {
  switch (kind) {
    case "trigger": return "play";
    case "model": return "sparkles";
    case "tool": return "wrench";
    case "knowledge": return "database";
    case "image-gen": return "image";
    case "vision": return "eye";
    case "router": return "git-branch";
    case "memory": return "brain";
    case "sub-agent": return "network";
    case "code": return "code";
    case "approval": return "shield-check";
    case "output": return "flag";
    default: return "sparkles";
  }
}
function providerName(p?: string): string {
  const map: Record<string, string> = {
    "free-openai": "AGENTMARK Free",
    "free-mistral": "Mistral (Free)",
    "free-llama": "Llama (Free)",
    "free-qwen": "Qwen (Free)",
    "glm-4.6": "GLM-4.6",
    "glm-4.5": "GLM-4.5",
    "glm-4.5-air": "GLM-4.5 Air",
    "glm-4.5v": "GLM-4.5V",
    custom: "Custom Model",
  };
  return p ? (map[p] ?? p) : "AGENTMARK Free";
}
function toolName(t?: string): string {
  const map: Record<string, string> = {
    "web-search": "Web Search",
    "page-reader": "Page Reader",
    summarize: "Summarize",
    translate: "Translate",
    code: "Code",
    classify: "Classify",
  };
  return t ? (map[t] ?? t) : "—";
}

export const AgentNode = memo(AgentNodeBase);
