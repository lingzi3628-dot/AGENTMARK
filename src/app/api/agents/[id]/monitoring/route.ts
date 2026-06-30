import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Returns monitoring stats for all integrations of an agent:
// - connection status (active/inactive)
// - total messages (in/out)
// - last message time + content preview
// - uptime (time since integration created)
// - platform health check (for telegram: is the polling bridge alive?)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const integrations = await db.integration.findMany({
    where: { agentId: id },
    orderBy: { createdAt: "desc" },
  });

  const stats = await Promise.all(
    integrations.map(async (integ) => {
      const [incoming, outgoing, lastMessage] = await Promise.all([
        db.messageLog.count({ where: { integrationId: integ.id, direction: "incoming" } }),
        db.messageLog.count({ where: { integrationId: integ.id, direction: "outgoing" } }),
        db.messageLog.findFirst({
          where: { integrationId: integ.id },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      const config = safeParse(integ.config);
      const ageMs = Date.now() - integ.createdAt.getTime();

      // Platform-specific health check
      let health: "active" | "inactive" | "error" | "unknown" = "unknown";
      let healthDetail = "";

      if (integ.platform === "telegram") {
        // Check if the bot token is valid by calling getMe
        try {
          const res = await fetch(`https://api.telegram.org/bot${config.botToken}/getMe`, {
            signal: AbortSignal.timeout(5000),
          });
          const data = await res.json();
          if (data.ok) {
            health = integ.enabled ? "active" : "inactive";
            healthDetail = `Bot @${data.result.username} is reachable`;
          } else {
            health = "error";
            healthDetail = data.description || "Token invalid";
          }
        } catch {
          health = "error";
          healthDetail = "Could not reach Telegram API";
        }
      } else if (integ.platform === "web") {
        health = integ.enabled ? "active" : "inactive";
        healthDetail = integ.enabled ? "Widget is live" : "Widget disabled";
      } else if (integ.platform === "api") {
        health = integ.enabled ? "active" : "inactive";
        healthDetail = integ.enabled ? "API endpoint ready" : "API disabled";
      } else {
        health = integ.enabled ? "active" : "inactive";
        healthDetail = integ.enabled ? "Configured" : "Disabled";
      }

      return {
        integrationId: integ.id,
        platform: integ.platform,
        enabled: integ.enabled,
        health,
        healthDetail,
        stats: {
          incoming,
          outgoing,
          total: incoming + outgoing,
        },
        lastMessage: lastMessage
          ? {
              direction: lastMessage.direction,
              content: lastMessage.content.slice(0, 100),
              senderName: lastMessage.senderName,
              time: lastMessage.createdAt.toISOString(),
            }
          : null,
        uptime: {
          created: integ.createdAt.toISOString(),
          ageMs,
          ageLabel: formatAge(ageMs),
        },
      };
    }),
  );

  return NextResponse.json({ integrations: stats });
}

function safeParse(s: string): Record<string, string> {
  try { return JSON.parse(s) as Record<string, string>; } catch { return {}; }
}

function formatAge(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
