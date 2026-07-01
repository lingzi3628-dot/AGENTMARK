// Connector SDK — lets developers build custom integrations for AGENTMARK.
// A connector is a TypeScript module that defines:
//   1. Metadata (name, icon, fields)
//   2. An `execute` function that receives input + config and returns output
//   3. Optional: webhook handler, test function, field validation
//
// Connectors are loaded from the `connectors/` directory at runtime.
// Community connectors can be installed via npm packages prefixed with `agentmark-connector-`.

export interface ConnectorField {
  key: string;
  label: string;
  type: "text" | "password" | "number" | "boolean" | "select" | "json";
  placeholder?: string;
  default?: string;
  options?: { label: string; value: string }[];
  required?: boolean;
}

export interface ConnectorMetadata {
  id: string;
  name: string;
  icon: string; // emoji or lucide icon name
  color: string; // tailwind color class
  description: string;
  category: "messaging" | "email" | "storage" | "database" | "analytics" | "crm" | "devops" | "other";
  fields: ConnectorField[];
  // Optional: does this connector support receiving webhooks?
  supportsWebhook?: boolean;
  // Optional: does this connector support triggering (outbound)?
  supportsTrigger?: boolean;
  docsUrl?: string;
}

export interface ConnectorContext {
  input: string;
  config: Record<string, string>;
  history: { role: string; content: string }[];
  agentId: string;
  userId?: string;
}

export interface ConnectorResult {
  ok: boolean;
  output: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface Connector {
  metadata: ConnectorMetadata;
  // Execute the connector — called when a "connector" node runs in the workflow
  execute: (ctx: ConnectorContext) => Promise<ConnectorResult>;
  // Optional: test the connection with the given config
  test?: (config: Record<string, string>) => Promise<{ ok: boolean; message: string }>;
  // Optional: handle an incoming webhook
  handleWebhook?: (payload: unknown, config: Record<string, string>) => Promise<{ response: unknown; input: string }>;
}

// Registry of loaded connectors
const connectorRegistry = new Map<string, Connector>();

/**
 * Register a connector in the registry.
 * Called by connector modules on load.
 *
 * @example
 * import { registerConnector, type Connector } from "@/lib/connector-sdk";
 *
 * const myConnector: Connector = {
 *   metadata: { id: "my-service", name: "My Service", ... },
 *   execute: async (ctx) => { ... },
 * };
 * registerConnector(myConnector);
 */
export function registerConnector(connector: Connector): void {
  connectorRegistry.set(connector.metadata.id, connector);
  console.log(`[connector-sdk] Registered: ${connector.metadata.id}`);
}

/**
 * Get a connector by ID.
 */
export function getConnector(id: string): Connector | undefined {
  return connectorRegistry.get(id);
}

/**
 * List all registered connectors.
 */
export function listConnectors(): ConnectorMetadata[] {
  return Array.from(connectorRegistry.values()).map((c) => c.metadata);
}

/**
 * Execute a connector by ID.
 */
export async function executeConnector(
  id: string,
  ctx: ConnectorContext,
): Promise<ConnectorResult> {
  const connector = connectorRegistry.get(id);
  if (!connector) {
    return { ok: false, output: "", error: `Connector "${id}" not found` };
  }
  try {
    return await connector.execute(ctx);
  } catch (err) {
    return {
      ok: false,
      output: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Test a connector's connection.
 */
export async function testConnector(
  id: string,
  config: Record<string, string>,
): Promise<{ ok: boolean; message: string }> {
  const connector = connectorRegistry.get(id);
  if (!connector?.test) {
    return { ok: true, message: "No test function available — connector loaded successfully" };
  }
  return connector.test(config);
}

// === Built-in connectors ===

// Built-in: HTTP Request (generic)
const httpConnector: Connector = {
  metadata: {
    id: "http-request",
    name: "HTTP Request",
    icon: "🌐",
    color: "bg-blue-500/15 text-blue-500",
    description: "Make any HTTP request to any API",
    category: "devops",
    fields: [
      { key: "method", label: "Method", type: "select", default: "GET", options: [
        { label: "GET", value: "GET" }, { label: "POST", value: "POST" },
        { label: "PUT", value: "PUT" }, { label: "DELETE", value: "DELETE" },
      ]},
      { key: "url", label: "URL", type: "text", placeholder: "https://api.example.com/data", required: true },
      { key: "headers", label: "Headers (JSON)", type: "json", placeholder: '{"Authorization": "Bearer ..."}' },
      { key: "body", label: "Body (POST/PUT)", type: "json" },
    ],
    supportsTrigger: true,
  },
  execute: async (ctx) => {
    const { method = "GET", url, headers, body } = ctx.config;
    if (!url) return { ok: false, output: "", error: "URL is required" };
    try {
      const reqHeaders: Record<string, string> = {};
      if (headers) Object.assign(reqHeaders, JSON.parse(headers));
      const res = await fetch(url, {
        method,
        headers: reqHeaders,
        body: method !== "GET" ? body : undefined,
      });
      const text = await res.text();
      return { ok: true, output: `HTTP ${res.status}\n\n${text.slice(0, 4000)}` };
    } catch (err) {
      return { ok: false, output: "", error: err instanceof Error ? err.message : String(err) };
    }
  },
  test: async (config) => {
    if (!config.url) return { ok: false, message: "URL is required" };
    try {
      const res = await fetch(config.url, { method: "HEAD" });
      return { ok: true, message: `Reachable (${res.status})` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "unreachable" };
    }
  },
};

// Built-in: Webhook (generic trigger)
const webhookConnector: Connector = {
  metadata: {
    id: "webhook",
    name: "Webhook",
    icon: "🔗",
    color: "bg-purple-500/15 text-purple-500",
    description: "Receive webhooks from any external system",
    category: "devops",
    fields: [
      { key: "secret", label: "Secret (for HMAC verification)", type: "password" },
    ],
    supportsWebhook: true,
  },
  execute: async (ctx) => {
    return { ok: true, output: ctx.input };
  },
  handleWebhook: async (payload, _config) => {
    return { response: { ok: true }, input: JSON.stringify(payload) };
  },
};

// Register built-in connectors
registerConnector(httpConnector);
registerConnector(webhookConnector);
