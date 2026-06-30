import type {
  Agent, Template, KnowledgeItem, RunRecord,
  WorkflowNode, WorkflowEdge,
} from "./types";

type AgentRow = {
  id: string; name: string; description: string; icon: string;
  category: string; nodes: string; edges: string; pinned: number | boolean;
  createdAt: Date | string; updatedAt: Date | string;
};

type TemplateRow = {
  id: string; name: string; description: string; icon: string;
  category: string; tags: string; nodes: string; edges: string;
  featured: number | boolean; installs: number;
  createdAt: Date | string;
};

type KnowledgeRow = {
  id: string; agentId: string | null; title: string; content: string;
  type: string; source: string; createdAt: Date | string;
};

type RunRow = {
  id: string; agentId: string; input: string; output: string;
  status: string; tokens: number; duration: number;
  createdAt: Date | string;
};

function parseNodes(s: string): WorkflowNode[] {
  try { return JSON.parse(s) as WorkflowNode[]; } catch { return []; }
}
function parseEdges(s: string): WorkflowEdge[] {
  try { return JSON.parse(s) as WorkflowEdge[]; } catch { return []; }
}
function iso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

export function toAgent(r: AgentRow): Agent {
  return {
    id: r.id, name: r.name, description: r.description, icon: r.icon,
    category: r.category, pinned: !!r.pinned,
    nodes: parseNodes(r.nodes), edges: parseEdges(r.edges),
    createdAt: iso(r.createdAt), updatedAt: iso(r.updatedAt),
  };
}

export function toTemplate(r: TemplateRow): Template {
  return {
    id: r.id, name: r.name, description: r.description, icon: r.icon,
    category: r.category, tags: r.tags ? r.tags.split(",").filter(Boolean) : [],
    nodes: parseNodes(r.nodes), edges: parseEdges(r.edges),
    featured: !!r.featured, installs: r.installs,
    createdAt: iso(r.createdAt),
  };
}

export function toKnowledge(r: KnowledgeRow): KnowledgeItem {
  return {
    id: r.id, agentId: r.agentId, title: r.title, content: r.content,
    type: r.type as KnowledgeItem["type"], source: r.source,
    createdAt: iso(r.createdAt),
  };
}

export function toRun(r: RunRow): RunRecord {
  return {
    id: r.id, agentId: r.agentId, input: r.input, output: r.output,
    status: r.status as RunRecord["status"], tokens: r.tokens,
    duration: r.duration, createdAt: iso(r.createdAt),
  };
}
