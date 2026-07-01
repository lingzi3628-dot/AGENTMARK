# 🤖 AGENTMARK

### Build, Run & Ship AI Agents on a Visual Canvas

[![CI](https://github.com/lingzi3628-dot/AGENTMARK/actions/workflows/ci.yml/badge.svg)](https://github.com/lingzi3628-dot/AGENTMARK/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org)
[![PWA](https://img.shields.io/badge/PWA-Installable-purple.svg)](https://web.dev/progressive-web-apps/)

AGENTMARK is a full-stack, AI-native automation platform that lets you design multi-model agentic workflows on a drag-and-drop canvas, run them via chat/API/schedule/webhook, and ship them to production. Think **n8n meets Giselle**, but AI-first and built for the African market with Paystack billing.

---

## 🎯 Why AGENTMARK?

| Feature | AGENTMARK | n8n | Giselle |
|---|---|---|---|
| Visual workflow builder | ✅ | ✅ | ✅ |
| AI-native (LLM nodes built-in) | ✅ | ❌ | ✅ |
| Human-in-the-loop approvals | ✅ | Basic | ❌ |
| AI workflow optimizer | ✅ | ❌ | ❌ |
| Per-node analytics + bottleneck detection | ✅ | ❌ | ❌ |
| Real-time collaboration (live cursors) | ✅ | ❌ | ❌ |
| OAuth connector marketplace | ✅ | ✅ | ❌ |
| Run replay + diff | ✅ | ❌ | ❌ |
| Mobile PWA (offline + installable) | ✅ | ❌ | ❌ |
| Paystack billing (African market) | ✅ | ❌ | ❌ |
| Self-host or cloud | ✅ | ✅ | Cloud only |

---

## ✨ Features

### 🎨 Visual Studio
- **Drag-and-drop canvas** powered by React Flow (@xyflow/react)
- **12 node types**: Trigger, Language Model, Tool, Knowledge, Image Gen, Vision, Router, Memory, HTTP Request, TTS, Sub-Agent, Approval, Code
- **Undo/redo** (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z) with 50-entry history stack
- **Copy/paste nodes** (Cmd/Ctrl+C/V)
- **Keyboard shortcuts** (Delete, Escape, etc.)
- **Inspector panel** for editing node properties
- **Real-time collaboration** — see other users' cursors + selections live

### 🧠 AI Engine
- **Multi-model support**: GLM-4.6/4.5/4.5-air/4.5v, OpenAI, Anthropic, Mistral, Cohere, Together, Groq, OpenRouter, DeepSeek, + any OpenAI-compatible endpoint
- **Bring Your Own Key (BYOK)** — encrypted at rest with AES-256-GCM
- **RAG over uploaded docs** — Xenova all-MiniLM-L6-v2 embeddings, semantic retrieval
- **Smart retries** with exponential backoff + jitter (handles 429, 5xx, timeouts)
- **AI Agent Builder** — describe an idea in plain English, AI generates the full workflow
- **Multi-turn refinement** — iterate on the generated workflow with chat
- **AI Workflow Optimizer** — analyzes your workflow and suggests cost/latency/reliability improvements

### 🔌 Integrations
- **9 platform integrations**: Web Widget, REST API, Facebook Messenger, WhatsApp, Telegram, Slack, Discord, Email (IMAP), SMS, Voice (Twilio)
- **Real webhook receivers** for Telegram, WhatsApp, Slack, Email, Voice
- **OAuth connectors** — one-click connect to Google, GitHub, Slack, Notion, Microsoft 365, Discord
- **Monitoring panel** — live health, message counts, uptime per integration
- **Rate limiting** — free plan = 2 integrations per agent (drives upgrades)

### ⏰ Automation
- **Scheduled agents** — cron-based auto-runs with timezone support
- **Webhook triggers** — unique URL per trigger, HMAC signature verification, JMESPath filtering
- **Zapier/Make.com integration** — step-by-step connection guide
- **Human-in-the-loop approvals** — pause workflow, notify user, wait for decision

### 📊 Analytics & Insights
- **Usage dashboard** — token trends (AreaChart), run counts (BarChart), per-agent stats
- **Real-time cost tracking** — USD spend per agent, per day, with plan limits
- **Per-node performance** — avg/max duration, error rate, bottleneck detection
- **AI Insights** — rule-based analysis of agent health (success rate, token trends, cost)
- **Run replay + diff** — re-run past runs and compare outputs line-by-line

### 👥 Teams & Collaboration
- **Team workspaces** — shared agents with owner/admin/editor/viewer roles
- **Audit log** — track every action (create, update, delete, invite, etc.)
- **Team invite links** — no email required
- **Real-time presence** — see who's viewing/editing the same agent

### 💳 Billing (Paystack)
- **3 tiers**: Free ($0, 2 agents), Pro ($19/mo, 25 agents), Team ($79/mo, 100 agents)
- **Paystack integration** — supports NGN, GHS, ZAR, KES, USD
- **Coming Soon state** — billing shows "Coming Soon" with email signup until you set `PAYSTACK_SECRET_KEY`
- **Plan-based limits** — agents, integrations, schedules, webhook triggers, daily tokens, daily spend

### 🌐 Platform
- **Public REST API** + JS SDK — build on AGENTMARK programmatically
- **API keys** with scopes (agents:read, agents:run, agents:write, templates:read)
- **Templates marketplace** — publish your agents, install others', rate 1-5 stars
- **Agent versioning + branching** — auto-snapshot on save, branch to experiment, restore old versions
- **Customer Mode** — AI generates talking points + message drafts for your business
- **Bulk operations** — delete/export/pin/duplicate/categorize up to 50 agents at once

### 🌍 Internationalization
- **4 languages**: English, 中文 (Chinese), Español (Spanish), Français (French)
- **Auto-detects** browser language
- **Language picker** in the topbar

### 📱 PWA
- **Installable** on mobile + desktop home screen
- **Offline support** via service worker (caches app shell)
- **App shortcuts** — long-press icon for quick access to Dashboard, New Agent, Approvals, Analytics

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) 18+ or [Bun](https://bun.sh/) 1.0+
- A [Firebase](https://console.firebase.google.com) project (free) for Google login

### Local Development

```bash
git clone https://github.com/lingzi3628-dot/AGENTMARK.git
cd AGENTMARK
bun install
```

Create a `.env` file (copy from `.env.example`):

```env
DATABASE_URL=file:/home/z/my-project/db/custom.db
APP_ENCRYPTION_KEY=<run: openssl rand -hex 32>
NEXT_PUBLIC_FIREBASE_API_KEY=<from firebase console>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=yourproject.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=yourproject
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=yourproject.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:000000000000
```

Start the dev server:

```bash
bun run dev
```

Open http://localhost:3000 and sign in with Google.

---

## 🚢 Deployment

### Option 1: Vercel (Recommended) ⭐

**One-command deploy:**

```bash
bash scripts/vercel-deploy.sh
```

This script automatically:
1. Installs Vercel CLI
2. Creates a Vercel Postgres database
3. Generates `APP_ENCRYPTION_KEY` + cron API keys
4. Prompts for your Firebase keys
5. Sets all env vars in Vercel
6. Deploys to production

**Manual deploy:** See [DEPLOY.md](./DEPLOY.md) for step-by-step instructions.

### Option 2: Railway

AGENTMARK includes a locked-down `Dockerfile` + `railway.json`:

1. Connect your repo to Railway
2. Set env vars (same as above, but use `file:/data/agentmark.db` for `DATABASE_URL` with a persistent volume)
3. Deploy — Railway auto-detects the Dockerfile

### Option 3: Docker

```bash
docker build -t agentmark .
docker run -p 3000:3000 \
  -e DATABASE_URL=file:/data/agentmark.db \
  -e APP_ENCRYPTION_KEY=<your-key> \
  -e NEXT_PUBLIC_FIREBASE_API_KEY=<your-key> \
  ... \
  agentmark
```

---

## 🔧 Environment Variables

See [`.env.example`](./.env.example) for the complete list. Key variables:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | SQLite (dev) or Postgres (prod) connection string |
| `APP_ENCRYPTION_KEY` | ✅ | 64-char hex for encrypting API keys at rest |
| `NEXT_PUBLIC_FIREBASE_*` | ✅ | Firebase config (6 vars) for Google login |
| `PAYSTACK_SECRET_KEY` | ❌ | Enable billing (leave empty for "Coming Soon") |
| `SCHEDULER_API_KEY` | ❌ | Protects cron endpoint |
| `EMAIL_POLL_API_KEY` | ❌ | Protects email poller |
| `ZAI_API_KEY` | ❌ | GLM-4.6 model access |
| `TWILIO_*` | ❌ | Voice + SMS agents |
| `GOOGLE_OAUTH_CLIENT_ID` | ❌ | Google OAuth connector |
| `GITHUB_OAUTH_CLIENT_ID` | ❌ | GitHub OAuth connector |

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript 5 |
| **UI** | React 19, Tailwind CSS 4, shadcn/ui |
| **State** | Zustand |
| **Database** | Prisma ORM (SQLite for dev, Postgres for prod) |
| **Auth** | Firebase Google Login |
| **Canvas** | @xyflow/react (React Flow) |
| **AI** | z-ai-web-dev-sdk, Xenova Transformers (RAG embeddings) |
| **Charts** | Recharts |
| **Payments** | Paystack |
| **Email** | ImapFlow + Nodemailer |
| **Voice/SMS** | Twilio |
| **CI/CD** | GitHub Actions (lint + build + Playwright E2E) |
| **Deploy** | Vercel / Railway / Docker |

---

## 📁 Project Structure

```
AGENTMARK/
├── prisma/
│   └── schema.prisma              # Database schema (20+ models)
├── public/
│   ├── manifest.json              # PWA manifest
│   ├── sw.js                      # Service worker (offline caching)
│   └── icon-192.png, icon-512.png
├── scripts/
│   ├── prisma-config.js           # Auto-switches SQLite/Postgres
│   └── vercel-deploy.sh           # One-command Vercel deploy
├── src/
│   ├── app/
│   │   ├── api/                   # 62+ API routes
│   │   │   ├── agents/[id]/       # CRUD + run + debug + optimize + insights
│   │   │   ├── billing/           # Paystack checkout + webhook
│   │   │   ├── connectors/        # OAuth flow + callback
│   │   │   ├── presence/[agentId] # SSE for real-time collaboration
│   │   │   ├── webhooks/          # Telegram, WhatsApp, Slack receivers
│   │   │   ├── voice/             # Twilio voice agents
│   │   │   ├── v1/                # Public REST API
│   │   │   └── ...
│   │   ├── layout.tsx             # Root layout + PWA meta + SW registration
│   │   └── page.tsx               # Main app (24 views routed)
│   ├── components/
│   │   ├── studio/
│   │   │   ├── views/             # 24 sidebar views
│   │   │   ├── nodes/             # React Flow node components
│   │   │   ├── sidebar.tsx        # Navigation (24 items)
│   │   │   ├── topbar.tsx         # Header + language picker
│   │   │   ├── inspector-panel.tsx
│   │   │   ├── presence-overlay.tsx # Live cursors
│   │   │   └── ...
│   │   └── ui/                    # shadcn/ui components
│   ├── lib/
│   │   ├── ai.ts                  # Workflow execution engine
│   │   ├── crypto.ts              # AES-256-GCM encryption
│   │   ├── embeddings.ts          # RAG embeddings (Xenova)
│   │   ├── retry.ts               # Smart retries with backoff
│   │   ├── presence.ts            # Real-time collaboration store
│   │   ├── paystack.ts            # Payment integration
│   │   ├── plans.ts               # Billing tier definitions
│   │   ├── oauth-providers.ts     # OAuth connector definitions
│   │   ├── i18n.ts                # Internationalization
│   │   └── ...
│   └── messages/                  # i18n translations (en, zh, es, fr)
├── tests/                         # Playwright E2E tests
├── Dockerfile                     # Docker deploy config
├── railway.json                   # Railway deploy config
├── vercel.json                    # Vercel deploy config + cron jobs
├── nixpacks.toml                  # Nixpacks build config
├── .env.example                   # Environment variable template
└── DEPLOY.md                      # Detailed deploy guide
```

---

## 🧪 Testing

```bash
# Run lint
bun run lint

# Run production build
bun run build

# Run Playwright E2E tests
bunx playwright test
```

CI runs automatically on every push and pull request via GitHub Actions.

---

## 📜 License

MIT License — see [LICENSE](./LICENSE) for details.

---

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org) — React framework
- [shadcn/ui](https://ui.shadcn.com) — UI components
- [React Flow](https://reactflow.dev) — Visual workflow canvas
- [Prisma](https://prisma.io) — Database ORM
- [Paystack](https://paystack.com) — African payment gateway
- [Xenova Transformers](https://xenova.github.io/transformers.js/) — In-browser ML embeddings

---

## 💬 Support

- 🐛 [Report a bug](https://github.com/lingzi3628-dot/AGENTMARK/issues)
- 💡 [Request a feature](https://github.com/lingzi3628-dot/AGENTMARK/issues)
- ⭐ [Star this repo](https://github.com/lingzi3628-dot/AGENTMARK) if you find it useful!

---

**Built with ❤️ for the African AI ecosystem.**
