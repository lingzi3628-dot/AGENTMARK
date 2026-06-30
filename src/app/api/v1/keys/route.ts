import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateApiKey } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const ALLOWED_SCOPES = ["agents:read", "agents:run", "agents:write", "templates:read"];
const MAX_KEYS_PER_USER = 25;

interface ApiKeyRow {
  id: string;
  label: string;
  prefix: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

function serialize(row: {
  id: string;
  label: string;
  prefix: string;
  scopes: string;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
}): ApiKeyRow {
  return {
    id: row.id,
    label: row.label,
    prefix: row.prefix,
    scopes: row.scopes.split(",").map((s) => s.trim()).filter(Boolean),
    isActive: row.isActive,
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** GET /api/v1/keys?firebaseUid=<uid> — list a user's API keys (never plaintext). */
export async function GET(req: NextRequest) {
  const firebaseUid = req.nextUrl.searchParams.get("firebaseUid");
  if (!firebaseUid) {
    return NextResponse.json({ error: "firebaseUid is required" }, { status: 400 });
  }
  const user = await db.user.findUnique({ where: { firebaseUid } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const rows = await db.apiKey.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(rows.map(serialize));
}

/** POST /api/v1/keys {label, scopes, firebaseUid} — create a new key. Returns the plaintext ONCE. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const firebaseUid = body.firebaseUid as string | undefined;
  const label = (body.label as string | undefined)?.trim();
  const rawScopes = body.scopes;
  if (!firebaseUid) {
    return NextResponse.json({ error: "firebaseUid is required" }, { status: 400 });
  }
  if (!label) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }
  if (!Array.isArray(rawScopes) || rawScopes.length === 0) {
    return NextResponse.json({ error: "scopes must be a non-empty array" }, { status: 400 });
  }
  const scopes = rawScopes.filter((s): s is string => typeof s === "string" && ALLOWED_SCOPES.includes(s));
  if (scopes.length === 0) {
    return NextResponse.json({ error: `scopes must be one of: ${ALLOWED_SCOPES.join(", ")}` }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { firebaseUid } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const existing = await db.apiKey.count({ where: { userId: user.id } });
  if (existing >= MAX_KEYS_PER_USER) {
    return NextResponse.json(
      { error: `You already have ${MAX_KEYS_PER_USER} API keys. Revoke one before creating another.` },
      { status: 429 },
    );
  }

  const { plaintext, hashedKey, prefix } = generateApiKey();
  const created = await db.apiKey.create({
    data: {
      userId: user.id,
      label,
      hashedKey,
      prefix,
      scopes: scopes.join(","),
      isActive: true,
    },
  });

  return NextResponse.json(
    {
      id: created.id,
      label: created.label,
      prefix: created.prefix,
      scopes,
      key: plaintext, // returned ONCE — caller must store it
      createdAt: created.createdAt.toISOString(),
    },
    { status: 201 },
  );
}
