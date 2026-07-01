// Context-aware AI — generates responses based on the user's actual workflow.
// When a user runs an agent, the AI sees the full node graph + system prompts
// and responds accordingly.

import { db } from "./db";
import type { WorkflowNode, WorkflowEdge, WorkflowNodeData } from "./types";

export interface AgentContext {
  agentName: string;
  agentDescription: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  nodeCount: number;
  hasRAG: boolean;
  hasMemory: boolean;
  hasRouter: boolean;
  hasApproval: boolean;
  hasCode: boolean;
  hasPython: boolean;
  modelProviders: string[];
  toolTypes: string[];
  systemPrompts: string[];
}

/**
 * Build a context object from an agent's workflow graph.
 * This is passed to the AI so it understands what the user built.
 */
export function buildAgentContext(
  agentName: string,
  agentDescription: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): AgentContext {
  const systemPrompts: string[] = [];
  const modelProviders: string[] = [];
  const toolTypes: string[] = [];

  for (const node of nodes) {
    const data = node.data;
    if (data.kind === "model" && data.systemPrompt) {
      systemPrompts.push(data.systemPrompt);
      if (data.provider) modelProviders.push(data.provider);
    }
    if (data.kind === "tool" && data.tool) {
      toolTypes.push(data.tool);
    }
  }

  return {
    agentName,
    agentDescription,
    nodes,
    edges,
    nodeCount: nodes.length,
    hasRAG: nodes.some((n) => n.data?.kind === "knowledge" && n.data?.useRAG),
    hasMemory: nodes.some((n) => n.data?.kind === "memory"),
    hasRouter: nodes.some((n) => n.data?.kind === "router"),
    hasApproval: nodes.some((n) => n.data?.kind === "approval"),
    hasCode: nodes.some((n) => n.data?.kind === "code"),
    hasPython: nodes.some((n) => n.data?.kind === "python"),
    modelProviders: [...new Set(modelProviders)],
    toolTypes: [...new Set(toolTypes)],
    systemPrompts,
  };
}

/**
 * Generate a context-aware system prompt for the AI.
 * Instead of a generic "You are a helpful assistant", this builds a prompt
 * that tells the AI exactly what the user's agent does, what nodes it has,
 * and how to respond based on the workflow configuration.
 */
export function generateContextAwarePrompt(ctx: AgentContext): string {
  const parts: string[] = [];

  // Agent identity
  parts.push(`You are "${ctx.agentName}", an AI agent built with AGENTMARK.`);
  if (ctx.agentDescription) {
    parts.push(`Your purpose: ${ctx.agentDescription}`);
  }

  // Workflow awareness
  parts.push(`\nYour workflow has ${ctx.nodeCount} nodes:`);

  // List the node chain
  const orderedNodes = topologicalSort(ctx.nodes, ctx.edges);
  for (const node of orderedNodes) {
    const data = node.data;
    let desc = `- ${data.label || data.kind} (${data.kind})`;
    if (data.kind === "model" && data.systemPrompt) {
      desc += `: ${data.systemPrompt.slice(0, 200)}`;
    }
    if (data.kind === "tool" && data.tool) {
      desc += `: uses ${data.tool}`;
    }
    if (data.kind === "knowledge" && data.content) {
      desc += `: knows about ${data.content.slice(0, 100)}`;
    }
    if (data.kind === "memory") {
      desc += `: ${data.memoryMode}s to ${data.memoryKey}`;
    }
    if (data.kind === "router") {
      desc += `: branches based on keywords`;
    }
    if (data.kind === "code") {
      desc += `: runs custom JavaScript`;
    }
    if (data.kind === "python") {
      desc += `: runs custom Python`;
    }
    if (data.kind === "approval") {
      desc += `: waits for human approval`;
    }
    parts.push(desc);
  }

  // Capabilities awareness
  const capabilities: string[] = [];
  if (ctx.hasRAG) capabilities.push("semantic document search (RAG)");
  if (ctx.hasMemory) capabilities.push("conversation memory (remembers past interactions)");
  if (ctx.hasRouter) capabilities.push("conditional branching (routes based on keywords)");
  if (ctx.hasApproval) capabilities.push("human-in-the-loop approval");
  if (ctx.hasCode) capabilities.push("custom JavaScript execution");
  if (ctx.hasPython) capabilities.push("custom Python execution");
  if (ctx.toolTypes.length > 0) capabilities.push(`tools: ${ctx.toolTypes.join(", ")}`);

  if (capabilities.length > 0) {
    parts.push(`\nYour capabilities: ${capabilities.join("; ")}.`);
  }

  // Behavioral guidance based on what the user built
  parts.push("\nBehavioral guidelines:");
  parts.push("- Respond according to your system prompts and workflow configuration.");
  parts.push("- If you have memory, reference past interactions when relevant.");
  parts.push("- If you have RAG/knowledge, use the provided context to answer accurately.");
  parts.push("- If you have tools available, suggest using them when appropriate.");
  parts.push("- Be concise, helpful, and stay in character as defined by your workflow.");
  parts.push("- If the input is unclear, ask for clarification.");

  return parts.join("\n");
}

/**
 * Topological sort of nodes by edges (execution order).
 */
function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of nodes) {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of edges) {
    if (!indeg.has(e.target)) indeg.set(e.target, 0);
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }
  const queue = [...indeg.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adj.get(id) ?? []) {
      indeg.set(next, (indeg.get(next) ?? 1) - 1);
      if ((indeg.get(next) ?? 0) === 0) queue.push(next);
    }
  }
  for (const n of nodes) if (!order.includes(n.id)) order.push(n.id);
  return order.map((id) => nodes.find((n) => n.id === id)!).filter(Boolean);
}
