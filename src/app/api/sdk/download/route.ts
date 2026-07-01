import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SDK_SOURCE } from "@/lib/sdk-source";

export const dynamic = "force-dynamic";

// GET /api/sdk/download?uid=<firebaseUid>
// Returns the AGENTMARK Web SDK source code.
// Only accessible to registered users (verified by uid).
export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) {
    return NextResponse.json({ error: "uid required" }, { status: 400 });
  }

  // Verify the user exists
  const user = await db.user.findUnique({ where: { firebaseUid: uid } });
  if (!user) {
    return NextResponse.json({ error: "User not found. Please register first." }, { status: 404 });
  }

  // Verify they have at least one API key
  const keyCount = await db.apiKey.count({ where: { userId: user.id, isActive: true } });
  if (keyCount === 0) {
    return NextResponse.json({ error: "No API key found. Please register to get access." }, { status: 403 });
  }

  // Return the SDK source as a downloadable file
  return new NextResponse(SDK_SOURCE, {
    status: 200,
    headers: {
      "content-type": "application/javascript",
      "content-disposition": 'attachment; filename="agentmark-sdk.ts"',
      "cache-control": "no-store",
    },
  });
}
