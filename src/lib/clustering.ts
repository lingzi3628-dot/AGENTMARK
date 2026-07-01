// Clustering support — enables multi-instance deployments.
// Uses Redis for distributed session state + presence when REDIS_URL is set.
// Falls back to in-memory (single instance) when no Redis.

import IORedis from "ioredis";
import type { PresenceUser } from "./presence";

let _pub: IORedis | null = null;
let _sub: IORedis | null = null;

export function clusteringEnabled(): boolean {
  return !!process.env.REDIS_URL;
}

function getPubConnection(): IORedis | null {
  if (!process.env.REDIS_URL) return null;
  if (!_pub) {
    _pub = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return _pub;
}

function getSubConnection(): IORedis | null {
  if (!process.env.REDIS_URL) return null;
  if (!_sub) {
    _sub = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return _sub;
}

/**
 * Publish a presence update to all instances (via Redis pub/sub).
 * Other instances update their local presence store.
 */
export async function publishPresence(agentId: string, user: PresenceUser): Promise<void> {
  const pub = getPubConnection();
  if (!pub) return; // single instance — no-op
  await pub.publish(`presence:${agentId}`, JSON.stringify(user));
}

/**
 * Subscribe to presence updates for an agent (via Redis pub/sub).
 * Returns an unsubscribe function.
 */
export function subscribePresence(
  agentId: string,
  callback: (user: PresenceUser) => void,
): () => void {
  const sub = getSubConnection();
  if (!sub) return () => {}; // single instance — no-op

  const channel = `presence:${agentId}`;
  sub.subscribe(channel);

  const handler = (_channel: string, message: string) => {
    try {
      callback(JSON.parse(message) as PresenceUser);
    } catch {
      // ignore parse errors
    }
  };

  sub.on("message", handler);

  return () => {
    sub.unsubscribe(channel);
    sub.off("message", handler);
  };
}

/**
 * Publish an agent run event to all instances (for real-time UI updates).
 */
export async function publishRunEvent(agentId: string, event: { type: string; [key: string]: unknown }): Promise<void> {
  const pub = getPubConnection();
  if (!pub) return;
  await pub.publish(`run:${agentId}`, JSON.stringify(event));
}

/**
 * Subscribe to run events for an agent.
 */
export function subscribeRunEvents(
  agentId: string,
  callback: (event: { type: string; [key: string]: unknown }) => void,
): () => void {
  const sub = getSubConnection();
  if (!sub) return () => {};

  const channel = `run:${agentId}`;
  sub.subscribe(channel);

  const handler = (_channel: string, message: string) => {
    try {
      callback(JSON.parse(message) as { type: string; [key: string]: unknown });
    } catch {
      // ignore
    }
  };

  sub.on("message", handler);

  return () => {
    sub.unsubscribe(channel);
    sub.off("message", handler);
  };
}

/**
 * Get instance info for health checks.
 */
export function getInstanceInfo(): {
  id: string;
  clustering: boolean;
  redisConnected: boolean;
} {
  const id = process.env.HOSTNAME || process.env.DYNO || `instance-${process.pid}`;
  const connected = clusteringEnabled() && !!_pub?.status && _pub.status === "ready";
  return {
    id,
    clustering: clusteringEnabled(),
    redisConnected: connected,
  };
}
