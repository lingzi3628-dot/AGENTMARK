// In-process presence store for real-time collaboration.
// Tracks who's viewing/editing each agent + their cursor position.
// For production with multiple instances, move this to Redis or Upstash.

export interface PresenceUser {
  userId: string;
  userName: string;
  userAvatar: string;
  color: string; // assigned color for cursor
  agentId: string;
  cursorX?: number;
  cursorY?: number;
  selectedNodeId?: string;
  lastSeen: number; // timestamp
}

// Map: agentId → Map<userId, PresenceUser>
const presence = new Map<string, Map<string, PresenceUser>>();

// Assign colors to users for cursor differentiation
const COLORS = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
];

export function joinAgent(agentId: string, user: Omit<PresenceUser, "color" | "lastSeen" | "agentId">): PresenceUser {
  if (!presence.has(agentId)) {
    presence.set(agentId, new Map());
  }
  const users = presence.get(agentId)!;
  const existing = users.get(user.userId);
  const color = existing?.color || COLORS[users.size % COLORS.length];
  const presenceUser: PresenceUser = {
    ...user,
    agentId,
    color,
    lastSeen: Date.now(),
  };
  users.set(user.userId, presenceUser);
  return presenceUser;
}

export function leaveAgent(agentId: string, userId: string): void {
  const users = presence.get(agentId);
  if (users) {
    users.delete(userId);
    if (users.size === 0) {
      presence.delete(agentId);
    }
  }
}

export function updateCursor(agentId: string, userId: string, cursor: { cursorX?: number; cursorY?: number; selectedNodeId?: string }): void {
  const users = presence.get(agentId);
  if (!users) return;
  const user = users.get(userId);
  if (!user) return;
  user.cursorX = cursor.cursorX ?? user.cursorX;
  user.cursorY = cursor.cursorY ?? user.cursorY;
  user.selectedNodeId = cursor.selectedNodeId ?? user.selectedNodeId;
  user.lastSeen = Date.now();
}

export function getPresence(agentId: string, excludeUserId?: string): PresenceUser[] {
  const users = presence.get(agentId);
  if (!users) return [];
  const now = Date.now();
  // Prune stale entries (not seen in 30 seconds)
  for (const [id, user] of users) {
    if (now - user.lastSeen > 30000) {
      users.delete(id);
    }
  }
  return Array.from(users.values()).filter((u) => u.userId !== excludeUserId);
}

export function getAllPresence(): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [agentId, users] of presence) {
    result[agentId] = users.size;
  }
  return result;
}
