import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { createHash, randomBytes } from "crypto";

export const dynamic = "force-dynamic";

// POST /api/sdk/register
// Users register with their email + name to get:
//   1. A free API key (am_live_...) for the Web SDK
//   2. 100K free tokens/day
//   3. Access to download the SDK source code
//
// The registration creates a User record WITHOUT Firebase —
// this is a standalone registration for SDK access only.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = (body.email as string)?.trim().toLowerCase();
  const name = (body.name as string)?.trim();
  const company = (body.company as string)?.trim() || "";
  const useCase = (body.useCase as string)?.trim() || "";

  if (!email || !name) {
    return NextResponse.json({ error: "email and name are required" }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  try {
    // Check if user already exists by email
    let user = await db.user.findFirst({ where: { email } });

    if (user) {
      // User already registered — return existing info
      // Generate a new API key if they don't have one
      const existingKeys = await db.apiKey.findMany({
        where: { userId: user.id, isActive: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      });

      if (existingKeys.length > 0) {
        return NextResponse.json({
          ok: true,
          message: "You're already registered! Here's your existing info.",
          userId: user.id,
          email: user.email,
          name: user.name,
          apiKeyId: existingKeys[0].id,
          apiKeyPrefix: existingKeys[0].prefix,
          sdkDownloadUrl: `/api/sdk/download?uid=${user.firebaseUid}`,
          alreadyRegistered: true,
        });
      }
    } else {
      // Create new user (without Firebase — standalone registration)
      user = await db.user.create({
        data: {
          firebaseUid: `sdk_${createHash("sha256").update(email).digest("hex").slice(0, 16)}`,
          email,
          name,
          plan: "free",
          maxAgents: 2,
          dailyTokenLimit: 100000,
          tokenResetDate: new Date().toISOString().slice(0, 10),
        },
      });
    }

    // Generate API key
    const random = randomBytes(24).toString("base64url");
    const plaintextKey = `am_live_${random}`;
    const hashedKey = createHash("sha256").update(plaintextKey).digest("hex");
    const prefix = plaintextKey.slice(0, 12);

    const apiKey = await db.apiKey.create({
      data: {
        userId: user.id,
        label: company ? `${name} (${company})` : name,
        hashedKey,
        prefix,
        scopes: "agents:read,agents:run,agents:write,templates:read",
        isActive: true,
      },
    });

    // Log registration
    console.log(`[sdk/register] New registration: ${email} (${name})${company ? ` from ${company}` : ""}${useCase ? ` — use case: ${useCase}` : ""}`);

    return NextResponse.json({
      ok: true,
      message: "Registration successful! Your API key is below.",
      userId: user.id,
      email: user.email,
      name: user.name,
      apiKey: plaintextKey, // Returned ONCE — never again
      apiKeyId: apiKey.id,
      apiKeyPrefix: prefix,
      sdkDownloadUrl: `/api/sdk/download?uid=${user.firebaseUid}`,
      freeTokens: "100,000 tokens/day",
      docs: "See SDK source file for usage examples",
      alreadyRegistered: false,
    }, { status: 201 });
  } catch (err) {
    console.error("[sdk/register] error:", err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
