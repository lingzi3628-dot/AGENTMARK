"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth-store";
import { useStudio } from "@/lib/store";

interface PresenceUser {
  userId: string;
  userName: string;
  userAvatar: string;
  color: string;
  cursorX?: number;
  cursorY?: number;
  selectedNodeId?: string;
}

/**
 * PresenceOverlay — shows other users' cursors + selections on the Studio canvas.
 * Connects to /api/presence/[agentId] via SSE and renders floating cursor labels.
 */
export function PresenceOverlay() {
  const { user } = useAuth();
  const { activeAgent } = useStudio();
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const cursorPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastBroadcastRef = useRef(0);

  // Connect to presence SSE stream when an agent is active
  useEffect(() => {
    if (!activeAgent || !user) return;

    const params = new URLSearchParams({
      uid: user.firebaseUid,
      name: user.name || user.email,
      avatar: user.photoURL || "",
    });
    const url = `/api/presence/${activeAgent.id}?${params}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "presence") {
          setUsers(data.users || []);
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
      // Fire-and-forget DELETE to leave
      fetch(`/api/presence/${activeAgent.id}?uid=${user.firebaseUid}`, {
        method: "DELETE",
      }).catch(() => undefined);
    };
  }, [activeAgent?.id, user?.firebaseUid]);

  // Track mouse movement on the canvas + broadcast cursor position (throttled)
  useEffect(() => {
    if (!activeAgent || !user) return;

    function handleMouseMove(e: MouseEvent) {
      cursorPosRef.current = { x: e.clientX, y: e.clientY };

      // Throttle broadcasts to every 100ms
      const now = Date.now();
      if (now - lastBroadcastRef.current < 100) return;
      lastBroadcastRef.current = now;

      fetch(`/api/presence/${activeAgent!.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          uid: user!.firebaseUid,
          cursorX: e.clientX,
          cursorY: e.clientY,
        }),
      }).catch(() => undefined);
    }

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [activeAgent?.id, user?.firebaseUid]);

  // Also broadcast selected node changes
  const { selectedNodeId } = useStudio();
  useEffect(() => {
    if (!activeAgent || !user) return;
    fetch(`/api/presence/${activeAgent.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        uid: user.firebaseUid,
        selectedNodeId: selectedNodeId || undefined,
      }),
    }).catch(() => undefined);
  }, [selectedNodeId, activeAgent?.id, user?.firebaseUid]);

  if (users.length === 0) return null;

  return (
    <>
      {/* Other users' cursors */}
      {users.map((u) => (
        <div
          key={u.userId}
          className="pointer-events-none fixed z-[9999] transition-all duration-100 ease-out"
          style={{
            left: u.cursorX ?? -100,
            top: u.cursorY ?? -100,
          }}
        >
          {/* Cursor arrow */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}
          >
            <path
              d="M5 3 L5 16 L9 12 L12 18 L14 17 L11 11 L17 11 Z"
              fill={u.color}
              stroke="white"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
          {/* Name label */}
          <div
            className="absolute left-4 top-3 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white shadow-md"
            style={{ background: u.color }}
          >
            {u.userName}
            {u.selectedNodeId && (
              <span className="ml-1 opacity-75">● editing</span>
            )}
          </div>
        </div>
      ))}

      {/* Presence badge (top-right of canvas) */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[9998] flex -space-x-2">
        {users.slice(0, 5).map((u) => (
          <div
            key={u.userId}
            className="h-7 w-7 rounded-full border-2 border-background overflow-hidden flex items-center justify-center text-[10px] font-medium text-white shadow-md"
            style={{ background: u.color }}
            title={`${u.userName} is viewing this agent`}
          >
            {u.userAvatar ? (
              <img src={u.userAvatar} alt={u.userName} className="h-full w-full object-cover" />
            ) : (
              u.userName?.[0]?.toUpperCase() || "?"
            )}
          </div>
        ))}
        {users.length > 5 && (
          <div className="h-7 w-7 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground shadow-md">
            +{users.length - 5}
          </div>
        )}
      </div>
    </>
  );
}
