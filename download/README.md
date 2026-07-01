Here are all the generated files.

---

# Deploying AGENTMARK to Railway

AGENTMARK ships with locked-down Nixpacks configuration (`nixpacks.toml` + `railway.json`) so deploys are deterministic. No Dockerfile needed — Railway auto-detects the Nixpacks builder.

## Quick start

1. Push your repo to GitHub (it already includes `nixpacks.toml`, `railway.json`, and the updated `package.json` scripts).
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → pick the AGENTMARK repo.
3. Railway detects `railway.json` and uses the `NIXPACKS` builder automatically. The build runs `bun install --frozen-lockfile` then `bun run build` (which calls `prisma generate && next build`).
4. Add the required environment variables (see below).
5. (Optional but recommended) Attach a persistent volume mounted at `/data` so your SQLite database survives redeploys.
6. Click **Deploy**. The first deploy takes ~2-3 minutes.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ Yes | SQLite on Railway: `file:/data/agentmark.db` (mount a volume at `/data`). MySQL/Postgres also works if you swap the Prisma provider. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | ✅ Yes | Firebase web app config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | ✅ Yes | e.g. `your-app.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ✅ Yes | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | ✅ Yes | e.g. `your-app.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | ✅ Yes | Firebase sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | ✅ Yes | Firebase app ID |
| `APP_ENCRYPTION_KEY` | ✅ Yes | 64-char hex string used for AES-256-GCM encryption of user-supplied API keys. Generate one with `openssl rand -hex 32`. If unset, the app falls back to a deterministic dev key (loud console warning — never use in production). |
| `ZAI_BASE_URL` | Optional | Override the Z.AI SDK base URL. |
| `ZAI_API_KEY` | Optional | Z.AI API key for the built-in LLM provider. Users can also supply their own via BYOK. |
| `PAYSTACK_SECRET_KEY` | Optional | Paystack key for the billing/upgrade flow. Omit to show "Coming Soon" for paid plans. |
| `PAYSTACK_PLAN_PRO` | Optional | Paystack plan code for the Pro tier. |
| `PAYSTACK_PLAN_TEAM` | Optional | Paystack plan code for the Team tier. |
| `WHATSAPP_VERIFY_TOKEN` | Optional | Any string — used to verify Meta WhatsApp webhooks. Must match the value you enter in the Meta dashboard. |
| `SLACK_SIGNING_SECRET` | Optional | Used per-integration (also stored in each integration's config), but a global fallback can be set here. |

## How the start script works

The Railway deploy uses `bun run start:railway`, which:

1. Runs `prisma db push --accept-data-loss` — creates/syncs the SQLite schema on the mounted volume on every boot. Safe for SQLite since the file persists across redeploys.
2. Runs `next start` — serves the Next.js production build on the port Railway assigns (auto-detected via `PORT` env var).

The `postinstall` script (`prisma generate || true`) ensures the Prisma client is generated during install — important because Railway sometimes caches the build step. The `|| true` keeps it from failing in environments without `DATABASE_URL`.

## Persistent volume (recommended)

Without a volume, your SQLite database resets on every redeploy. To persist:

1. In Railway → your service → **Settings** → **Volumes** → **Add Volume**.
2. Mount path: `/data`.
3. Set `DATABASE_URL=file:/data/agentmark.db`.
4. Redeploy.

## Troubleshooting

- **Build fails with "prisma generate" error** — make sure `DATABASE_URL` is set, even to a dummy SQLite path like `file:/tmp/build.db`. Prisma needs it to generate the client.
- **App boots but `prisma db push` fails** — check that the volume is mounted at `/data` and `DATABASE_URL=file:/data/agentmark.db`.
- **Webhooks not receiving messages** — Railway provides a public URL like `agentmark-production.up.railway.app`. Use that as your webhook base in Telegram/WhatsApp/Slack dashboards.
- **Prisma client out of sync after schema change** — bump the schema, redeploy, and the `start:railway` script will run `prisma db push` automatically.
