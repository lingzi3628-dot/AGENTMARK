// AGENTMARK JavaScript SDK — copy this into your project.
// No build step required: works in browsers, Node 18+, Deno, Bun.
//
// Usage:
//   const am = new AgentMark("am_live_xxxxxxxx", "https://your-app.vercel.app");
//   const agents = await am.listAgents();
//   const out = await am.runAgent(agents[0].id, "Hello!");

export interface AgentMarkAgent {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentMarkAgentDetail extends AgentMarkAgent {
  nodes: unknown[];
  edges: unknown[];
  pinned: boolean;
}

export interface AgentMarkAgentCreateInput {
  name: string;
  description?: string;
  icon?: string;
  category?: string;
  nodes?: unknown[];
  edges?: unknown[];
}

export interface AgentMarkRunResult {
  runId: string;
  output: string;
  tokens: number;
  durationMs: number;
}

export interface AgentMarkTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tags: string[];
  featured: boolean;
  installs: number;
  createdAt: string;
}

export class AgentMark {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://your-app.vercel.app",
  ) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
        ...(init.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = (data as { error?: string }).error || `HTTP ${res.status}`;
      throw new Error(err);
    }
    return data as T;
  }

  /** List your agents (lightweight — no nodes/edges). Requires `agents:read`. */
  async listAgents() {
    return this.request<AgentMarkAgent[]>("/api/v1/agents");
  }

  /** Get a full agent definition (includes nodes/edges). Requires `agents:read`. */
  async getAgent(id: string) {
    return this.request<AgentMarkAgentDetail>(`/api/v1/agents/${id}`);
  }

  /** Create a new agent. Requires `agents:write`. */
  async createAgent(data: AgentMarkAgentCreateInput) {
    return this.request<AgentMarkAgentDetail>("/api/v1/agents", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /** Update an existing agent. Requires `agents:write`. */
  async updateAgent(id: string, data: Partial<AgentMarkAgentCreateInput>) {
    return this.request<AgentMarkAgentDetail>(`/api/v1/agents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  /** Delete an agent. Requires `agents:write`. */
  async deleteAgent(id: string) {
    return this.request<{ ok: true }>(`/api/v1/agents/${id}`, { method: "DELETE" });
  }

  /**
   * Run an agent and return the final output (non-streaming).
   * Requires `agents:run`.
   *
   * For streaming, open an EventSource against `/api/agents/:id/run` from the
   * browser instead — this SDK helper is for server-to-server use.
   */
  async runAgent(id: string, input: string, history?: { role: "user" | "assistant"; content: string }[]) {
    return this.request<AgentMarkRunResult>(`/api/v1/agents/${id}/run`, {
      method: "POST",
      body: JSON.stringify({ input, history }),
    });
  }

  /** List marketplace templates. Requires `templates:read`. */
  async listTemplates() {
    return this.request<AgentMarkTemplate[]>("/api/v1/templates");
  }
}

export default AgentMark;
