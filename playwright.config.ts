import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for AGENTMARK.
 *
 * The dev server is started automatically (webServer.command) against a
 * dedicated test database file so the E2E suite doesn't disturb the dev DB.
 * Set `CI=1` to always start a fresh server (otherwise an existing
 * localhost:3000 instance is reused for speed).
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "DATABASE_URL=file:/home/z/my-project/db/test.db bun run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
