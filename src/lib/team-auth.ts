import { db } from "./db";

export type TeamRole = "owner" | "admin" | "editor" | "viewer";

const ROLE_RANK: Record<TeamRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

export class TeamAuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "TeamAuthError";
  }
}

/**
 * Resolve a user's role on a team. Returns null if:
 *   - the team does not exist
 *   - the user is not a member
 *   - the user has a pending invite (joinedAt is null) and is not the owner
 *
 * Owners (Team.ownerId) are always considered to have role "owner" even if the
 * TeamMember row is missing or has joinedAt = null.
 */
export async function getTeamRole(
  userId: string,
  teamId: string,
): Promise<TeamRole | null> {
  const team = await db.team.findUnique({
    where: { id: teamId },
    select: { ownerId: true },
  });
  if (!team) return null;
  if (team.ownerId === userId) return "owner";

  const member = await db.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { role: true, joinedAt: true },
  });
  if (!member || !member.joinedAt) return null;
  return member.role as TeamRole;
}

/**
 * Ensure the user has AT LEAST `minRole` on the team. Throws TeamAuthError on
 * insufficient permissions. Returns the matching TeamMember row on success.
 */
export async function requireTeamRole(
  userId: string,
  teamId: string,
  minRole: TeamRole,
) {
  const team = await db.team.findUnique({
    where: { id: teamId },
    include: {
      members: { where: { userId } },
    },
  });
  if (!team) {
    throw new TeamAuthError("Team not found", 404);
  }
  if (team.ownerId === userId) {
    // Owner bypasses everything.
    return (
      team.members[0] ?? {
        id: "owner",
        teamId,
        userId,
        role: "owner",
        invitedAt: team.createdAt,
        joinedAt: team.createdAt,
        createdAt: team.createdAt,
      }
    );
  }
  const member = team.members[0];
  if (!member || !member.joinedAt) {
    throw new TeamAuthError("You are not a member of this team", 403);
  }
  const role = member.role as TeamRole;
  if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
    throw new TeamAuthError(
      `This action requires the ${minRole} role (you are ${role})`,
      403,
    );
  }
  return member;
}

/**
 * Write a single entry to the team's audit log. IP + UA are extracted from the
 * incoming request when available. Safe to await (fire-and-forget is also OK).
 */
export async function logAction(opts: {
  teamId: string | null;
  userId: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  meta?: Record<string, unknown>;
  req?: Request;
}): Promise<void> {
  const ip = extractIp(opts.req);
  const ua = opts.req?.headers.get("user-agent") ?? "";
  await db.auditLog
    .create({
      data: {
        teamId: opts.teamId,
        userId: opts.userId,
        action: opts.action,
        resourceType: opts.resourceType ?? "",
        resourceId: opts.resourceId ?? "",
        ipAddress: ip,
        userAgent: ua,
        meta: JSON.stringify(opts.meta ?? {}),
      },
    })
    .catch(() => undefined);
}

function extractIp(req?: Request): string {
  if (!req) return "";
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "";
}

/** True if `role` is at least `min`. */
export function roleAtLeast(role: TeamRole, min: TeamRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}
