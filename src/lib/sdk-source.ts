// The AGENTMARK Web SDK source code.
// This is served ONLY to registered users via /api/sdk/download.
// It is NOT stored in the public GitHub repo — the source is kept private.

export const SDK_SOURCE = `// AGENTMARK Web SDK v1.0.0
// © Spyro Technology. All rights reserved.
// This SDK is provided to registered users only. Do not redistribute.

export class AgentMark {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = "") {
    if (!apiKey) throw new Error("API key required. Register at your AGENTMARK instance to get one.");
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  }

  /** List all agents */
  async listAgents() {
    const res = await fetch(\`\${this.baseUrl}/api/v1/agents\`, {
      headers: { authorization: \`Bearer \${this.apiKey}\` },
    });
    if (!res.ok) throw new Error(\`Failed: \${res.status}\`);
    return res.json();
  }

  /** Get a single agent by ID */
  async getAgent(id: string) {
    const res = await fetch(\`\${this.baseUrl}/api/v1/agents/\${id}\`, {
      headers: { authorization: \`Bearer \${this.apiKey}\` },
    });
    if (!res.ok) throw new Error(\`Failed: \${res.status}\`);
    return res.json();
  }

  /** Create a new agent */
  async createAgent(data: { name: string; description?: string; nodes?: unknown[]; edges?: unknown[] }) {
    const res = await fetch(\`\${this.baseUrl}/api/v1/agents\`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: \`Bearer \${this.apiKey}\` },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(\`Failed: \${res.status}\`);
    return res.json();
  }

  /** Run an agent with input text */
  async runAgent(id: string, input: string, history?: { role: string; content: string }[]) {
    const res = await fetch(\`\${this.baseUrl}/api/v1/agents/\${id}/run\`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: \`Bearer \${this.apiKey}\` },
      body: JSON.stringify({ input, history }),
    });
    if (!res.ok) throw new Error(\`Failed: \${res.status}\`);
    return res.json();
  }

  /** Delete an agent */
  async deleteAgent(id: string) {
    const res = await fetch(\`\${this.baseUrl}/api/v1/agents/\${id}\`, {
      method: "DELETE",
      headers: { authorization: \`Bearer \${this.apiKey}\` },
    });
    if (!res.ok) throw new Error(\`Failed: \${res.status}\`);
    return res.json();
  }

  /** List marketplace templates */
  async listTemplates() {
    const res = await fetch(\`\${this.baseUrl}/api/v1/templates\`, {
      headers: { authorization: \`Bearer \${this.apiKey}\` },
    });
    if (!res.ok) throw new Error(\`Failed: \${res.status}\`);
    return res.json();
  }
}

// Usage:
// import { AgentMark } from "./agentmark-sdk";
// const client = new AgentMark("am_live_your_key");
// const agents = await client.listAgents();
// const result = await client.runAgent("agent-id", "Hello!");
// console.log(result.output);
`;
