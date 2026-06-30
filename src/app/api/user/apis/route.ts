import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encrypt, maskKey } from "@/lib/crypto";

export const dynamic = "force-dynamic";

// List all custom APIs for a user (NEVER returns plaintext keys)
export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });
  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const apis = await db.customApi.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    apis.map((a) => ({
      id: a.id,
      label: a.label,
      provider: a.provider,
      baseUrl: a.baseUrl,
      modelName: a.modelName,
      maskedKey: a.maskedKey || maskKey(""),
      isActive: a.isActive,
      lastUsedAt: a.lastUsedAt,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })),
  );
}

// Create a new custom API entry — encrypts the key at rest
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const uid = body.firebaseUid as string;
  if (!uid) return NextResponse.json({ error: "firebaseUid required" }, { status: 400 });
  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const label = (body.label as string)?.trim();
  const provider = (body.provider as string)?.trim();
  const apiKey = (body.apiKey as string)?.trim();
  if (!label || !provider || !apiKey) {
    return NextResponse.json({ error: "label, provider, and apiKey are required" }, { status: 400 });
  }

  // Per-user cap on stored APIs (generous to keep schema light)
  const count = await db.customApi.count({ where: { userId: user.id } });
  if (count >= 25) {
    return NextResponse.json({ error: "Limit of 25 custom APIs reached" }, { status: 429 });
  }

  const created = await db.customApi.create({
    data: {
      userId: user.id,
      label,
      provider,
      baseUrl: (body.baseUrl as string)?.trim() || "",
      modelName: (body.modelName as string)?.trim() || "",
      encryptedKey: encrypt(apiKey),
      maskedKey: maskKey(apiKey),
      isActive: body.isActive !== false,
    },
  });

  return NextResponse.json({
    id: created.id,
    label: created.label,
    provider: created.provider,
    baseUrl: created.baseUrl,
    modelName: created.modelName,
    maskedKey: created.maskedKey,
    isActive: created.isActive,
    createdAt: created.createdAt,
  }, { status: 201 });
}
