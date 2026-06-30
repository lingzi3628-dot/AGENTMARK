import { test, expect } from "@playwright/test";

/**
 * Basic smoke tests — these do NOT require Firebase auth.
 *
 * They cover:
 *   - Homepage loads with a 200 status and shows the AGENTMARK brand.
 *   - /api/version returns 200 with the expected shape.
 *   - /api/templates returns 200 with an array (seeds defaults on first hit).
 */

test.describe("Smoke tests (no auth)", () => {
  test("homepage loads and shows AGENTMARK brand", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);
    // The login screen renders "AGENTMARK" prominently. Authenticated users
    // also see AGENTMARK in the sidebar — so this text is always present.
    await expect(page.locator("body")).toContainText("AGENTMARK", { timeout: 15000 });
  });

  test("homepage <title> or <h1> mentions AGENTMARK", async ({ page }) => {
    await page.goto("/");
    // Either the document title or a visible heading mentions the brand.
    const title = await page.title();
    const headingText = await page.locator("h1").first().textContent();
    const mentionsBrand =
      title.includes("AGENTMARK") || (headingText ?? "").includes("AGENTMARK");
    expect(mentionsBrand).toBeTruthy();
  });

  test("GET /api/version returns 200 with version info", async ({ request }) => {
    const res = await request.get("/api/version");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("version");
    expect(typeof body.version).toBe("string");
    expect(body).toHaveProperty("timestamp");
  });

  test("GET /api/templates returns 200 with an array", async ({ request }) => {
    const res = await request.get("/api/templates");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBeTruthy();
    // The endpoint seeds default templates on first hit, so we expect at
    // least one entry.
    expect(body.length).toBeGreaterThan(0);
  });

  test("GET /api/billing/status returns 200 with enabled boolean", async ({ request }) => {
    const res = await request.get("/api/billing/status");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("enabled");
    expect(typeof body.enabled).toBe("boolean");
  });
});
