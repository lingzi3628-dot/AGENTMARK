// Distributed job queue using BullMQ + Redis.
// Replaces the in-process scheduler with a robust, distributed queue.
// Supports: scheduled agent runs, webhook triggers, retry logic, dead-letter queues.
//
// In production, set REDIS_URL env var to connect to a Redis instance.
// In dev (no REDIS_URL), falls back to the in-process scheduler.

import { Queue, Worker, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import { db } from "./db";
import { executeAgent } from "./ai";
import type { WorkflowNode, WorkflowEdge } from "./types";

let _connection: IORedis | null = null;
let _agentQueue: Queue | null = null;
let _worker: Worker | null = null;

export function redisEnabled(): boolean {
  return !!process.env.REDIS_URL;
}

function getConnection(): IORedis | null {
  if (!process.env.REDIS_URL) return null;
  if (!_connection) {
    _connection = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return _connection;
}

/**
 * Get the agent execution queue (singleton).
 */
export function getAgentQueue(): Queue | null {
  const conn = getConnection();
  if (!conn) return null;
  if (!_agentQueue) {
    _agentQueue = new Queue("agent-execution", {
      connection: conn,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    });
  }
  return _agentQueue;
}

export interface AgentJobData {
  agentId: string;
  input: string;
  source: "schedule" | "webhook" | "api" | "manual";
  userId?: string;
  scheduleId?: string;
  webhookTriggerId?: string;
}

/**
 * Enqueue an agent run to the distributed queue.
 * Returns the job ID for tracking.
 */
export async function enqueueAgentRun(data: AgentJobData): Promise<string | null> {
  const queue = getAgentQueue();
  if (!queue) return null;

  const job = await queue.add(`agent:${data.agentId}`, data, {
    jobId: `run-${data.agentId}-${Date.now()}`,
  });
  return job.id ?? null;
}

/**
 * Start the worker that processes agent execution jobs.
 * Call this once on server startup (in production with Redis only).
 */
export function startAgentWorker(): void {
  const conn = getConnection();
  if (!conn || _worker) return;

  _worker = new Worker(
    "agent-execution",
    async (job) => {
      const data = job.data as AgentJobData;
      console.log(`[worker] Processing agent ${data.agentId} (job ${job.id})`);

      const agent = await db.agent.findUnique({ where: { id: data.agentId } });
      if (!agent) throw new Error(`Agent ${data.agentId} not found`);

      const nodes = JSON.parse(agent.nodes || "[]") as WorkflowNode[];
      const edges = JSON.parse(agent.edges || "[]") as WorkflowEdge[];

      // Execute the agent
      const events: { type: string; output?: string; tokens?: number }[] = [];
      for await (const event of executeAgent(nodes, edges, {
        input: data.input,
        history: [],
        agentId: agent.id,
      })) {
        events.push(event);
      }

      const doneEvent = events.find((e) => e.type === "done");
      const output = doneEvent?.output || "";
      const tokens = doneEvent?.tokens || 0;

      // Save to run history
      await db.runHistory.create({
        data: {
          agentId: agent.id,
          userId: data.userId,
          input: data.input,
          output,
          status: "completed",
          tokens,
          duration: 0,
          source: data.source,
        },
      });

      // Update schedule lastRun if this was a scheduled run
      if (data.scheduleId) {
        await db.schedule.update({
          where: { id: data.scheduleId },
          data: {
            lastRunAt: new Date(),
            lastRunStatus: "success",
          },
        }).catch(() => undefined);
      }

      return { output, tokens };
    },
    {
      connection: conn,
      concurrency: 5,
    },
  );

  _worker.on("completed", (job) => {
    console.log(`[worker] Job ${job.id} completed`);
  });

  _worker.on("failed", (job, err) => {
    console.error(`[worker] Job ${job?.id} failed:`, err.message);
  });

  console.log("[worker] Agent execution worker started (concurrency: 5)");
}

/**
 * Get queue stats (active, waiting, completed, failed jobs).
 */
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
} | null> {
  const queue = getAgentQueue();
  if (!queue) return null;

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}
