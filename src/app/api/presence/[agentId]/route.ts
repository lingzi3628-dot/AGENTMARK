import { NextRequest } from "next/server";
import { joinAgent, leaveAgent, updateCursor, getPresence } from "@/lib/presence";

export const dynamic = "force-dynamic";

// GET /api/presence/[agentId]?uid=<firebaseUid> — SSE stream of presence updates
// Client opens this connection and receives updates every 2 seconds.
export async function GET(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const uid = req.nextUrl.searchParams.get("uid") || "anonymous";
  const name = req.nextUrl.searchParams.get("name") || "Anonymous";
  const avatar = req.nextUrl.searchParams.get("avatar") || "";

  // Join the agent
  joinAgent(agentId, { userId: uid, userName: name, userAvatar: avatar });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial presence
      const users = getPresence(agentId, uid);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "presence", users })}\n\n`));

      // Poll every 2 seconds
      const interval = setInterval(() => {
        try {
          const users = getPresence(agentId, uid);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "presence", users })}\n\n`));
        } catch {
          // stream closed
        }
      }, 2000);

      // Cleanup on close
      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        leaveAgent(agentId, uid);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}

// POST /api/presence/[agentId] — update cursor position
// Body: { uid, cursorX?, cursorY?, selectedNodeId? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const body = await req.json().catch(() => ({}));
  const uid = body.uid as string;
  if (!uid) return Response.json({ error: "uid required" }, { status: 400 });

  updateCursor(agentId, uid, {
    cursorX: body.cursorX,
    cursorY: body.cursorY,
    selectedNodeId: body.selectedNodeId,
  });

  return Response.json({ ok: true });
}

// DELETE /api/presence/[agentId]?uid=<firebaseUid> — leave the agent
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return Response.json({ error: "uid required" }, { status: 400 });

  leaveAgent(agentId, uid);
  return Response.json({ ok: true });
}
