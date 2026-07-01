// Admin authentication middleware.
// The admin panel is protected by ADMIN_SECRET_KEY env var.
// This key is NEVER in the source code — it's set on the server only.
// The admin URL is /admin?key=<ADMIN_SECRET_KEY> — not linked anywhere in the UI.

import { NextRequest, NextResponse } from "next/server";

export function getAdminKey(): string {
  return process.env.ADMIN_SECRET_KEY || "";
}

export function isAdminConfigured(): boolean {
  return !!process.env.ADMIN_SECRET_KEY;
}

/**
 * Verify the admin key from request.
 * Checks: query param ?key=, header X-Admin-Key, or cookie admin_key.
 */
export function verifyAdmin(req: NextRequest): boolean {
  const adminKey = getAdminKey();
  if (!adminKey) return false;

  // Check query param
  const queryKey = req.nextUrl.searchParams.get("key");
  if (queryKey === adminKey) return true;

  // Check header
  const headerKey = req.headers.get("x-admin-key");
  if (headerKey === adminKey) return true;

  // Check cookie
  const cookieHeader = req.headers.get("cookie") || "";
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, value] = cookie.split("=");
    if (name === "admin_key" && value === adminKey) return true;
  }

  return false;
}

/**
 * Admin auth middleware for API routes.
 * Returns null if authorized, or a 401 response if not.
 */
export function adminGuard(req: NextRequest): NextResponse | null {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Admin panel not configured. Set ADMIN_SECRET_KEY env var." },
      { status: 503 },
    );
  }
  if (!verifyAdmin(req)) {
    return NextResponse.json(
      { error: "Unauthorized. Admin key required." },
      { status: 401 },
    );
  }
  return null;
}
