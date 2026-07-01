# 🤖 AGENTMARK

### The Free, Open-Source AI Agent Studio

> **Built by [Spyro Technology](https://spyro.tech) × AGENTMARK**

[![CI](https://github.com/lingzi3628-dot/AGENTMARK/actions/workflows/ci.yml/badge.svg)](https://github.com/lingzi3628-dot/AGENTMARK/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org)
[![PWA](https://img.shields.io/badge/PWA-Installable-purple.svg)](https://web.dev/progressive-web-apps/)
[![Free](https://img.shields.io/badge/100%25-Free-success.svg)](#)

**AGENTMARK** is a full-stack, AI-native automation platform that lets you design multi-model agentic workflows on a drag-and-drop canvas, run them via chat/API/schedule/webhook, and ship them to production.

Think **n8n meets Giselle**, but AI-first, 100% free, and open source.

---

## 🎯 Why AGENTMARK?

| Feature | AGENTMARK | n8n | Giselle |
|---|---|---|---|
| Visual workflow builder | ✅ | ✅ | ✅ |
| AI-native (LLM nodes built-in) | ✅ | ❌ | ✅ |
| Local model support (Ollama, LM Studio) | ✅ | ❌ | ❌ |
| Human-in-the-loop approvals | ✅ | Basic | ❌ |
| AI workflow optimizer | ✅ | ❌ | ❌ |
| Per-node analytics + bottleneck detection | ✅ | ❌ | ❌ |
| Real-time collaboration (live cursors) | ✅ | ❌ | ❌ |
| OAuth connector marketplace | ✅ | ✅ | ❌ |
| Run replay + diff | ✅ | ❌ | ❌ |
| Mobile PWA (offline + installable) | ✅ | ❌ | ❌ |
| Self-host or cloud | ✅ | ✅ | Cloud only |
| **100% Free + Open Source** | ✅ | Partial | ❌ |

---

## ✨ Features

### 🎨 Visual Studio (33 views!)
- **Drag-and-drop canvas** powered by React Flow (@xyflow/react)
- **13 node types**: Trigger, Language Model, Tool, Knowledge, Image Gen, Vision, Router, Memory, HTTP Request, TTS, Sub-Agent, Approval, Code
- **Undo/redo** (Cmd/Ctrl+Z) with 50-entry history stack
- **Copy/paste nodes** (Cmd/Ctrl+C/V)
- **Auto-layout** — one-click arrange nodes in a clean flow
- **Fit-to-view, mini-map toggle, export canvas as SVG**
- **Node templates** — save + reuse node configurations
- **Real-time collaboration** — see other users' cursors + selections live
- **Inspector panel** for editing node properties

### 🧠 AI Engine
- **Multi-model support**: GLM-4.6/4.5, OpenAI, Anthropic, Mistral, Cohere, Together, Groq, OpenRouter, DeepSeek, + any OpenAI-compatible endpoint
- **🦙 Local model support**: Ollama, LM Studio, Jan, llama.cpp — run 100% free + private + offline
- **Bring Your Own Key (BYOK)** — encrypted at rest with AES-256-GCM
- **RAG over uploaded docs** — Xenova all-MiniLM-L6-v2 embeddings, semantic retrieval
- **Smart retries** with exponential backoff + jitter (handles 429, 5xx, timeouts)
- **AI Agent Builder** — describe an idea in plain English, AI generates the full workflow
- **Multi-turn refinement** — iterate on the generated workflow with chat
- **AI Workflow Optimizer** — analyzes your workflow and suggests cost/latency/reliability improvements
- **Custom JS code nodes** — sandboxed JavaScript execution (no require/process/fs)

> 📖 **Want to use local models?** See [LOCAL_MODELS.md](./LOCAL_MODELS.md) for step-by-step setup.

### 🔌 Integrations
- **10 platform integrations**: Web Widget, REST API, Facebook Messenger, WhatsApp, Telegram, Slack, Discord, Email (IMAP), SMS, Voice (Twilio)
- **Real webhook receivers** for Telegram, WhatsApp, Slack, Email, Voice
- **OAuth connectors** — one-click connect to Google, GitHub, Slack, Notion, Microsoft 365, Discord
- **Monitoring panel** — live health, message counts, uptime per integration
- **Webhook event log** — every incoming + outgoing message across all integrations

### ⏰ Automation
- **Scheduled agents** — cron-based auto-runs with timezone support
- **Webhook triggers** — unique URL per trigger, HMAC signature verification, JMESPath filtering
- **Zapier/Make.com integration** — step-by-step connection guide
- **Human-in-the-loop approvals** — pause workflow, notify user, wait for decision
- **Smart retries** with exponential backoff on all API calls

### 📊 Analytics & Insights
- **Usage dashboard** — token trends (AreaChart), run counts (BarChart), per-agent stats
- **Real-time cost tracking** — USD spend per agent, per day
- **Per-node performance** — avg/max duration, error rate, bottleneck detection
- **AI Insights** — rule-based analysis of agent health (success rate, token trends, cost)
- **Run replay + diff** — re-run past runs and compare outputs line-by-line
- **Agent comparison** — compare up to 4 agents side-by-side

### 👥 Teams & Collaboration
- **Team workspaces** — shared agents with owner/admin/editor/viewer roles
- **Audit log** — track every action (create, update, delete, invite, etc.)
- **Team invite links** — no email required
- **Real-time presence** — see who's viewing/editing the same agent

### 🌐 Platform
- **Public REST API** + JS SDK — build on AGENTMARK programmatically
- **API Playground** — test the REST API interactively in the browser
- **API keys** with scopes (agents:read, agents:run, agents:write, templates:read)
- **Rate limiting** — 100 req/min general, 20 runs/min per API key
- **Templates marketplace** — publish your agents, install others', rate 1-5 stars
- **Agent versioning + branching** — auto-snapshot on save, branch to experiment, restore old versions
- **Customer Mode** — AI generates talking points + message drafts for your business
- **Bulk operations** — delete/export/pin/duplicate/categorize up to 50 agents at once
- **Webhook Tester** — send test requests to any webhook with HMAC signatures
- **Prompt Library** — save reusable system prompts by category

### 🌍 Internationalization
- **4 languages**: English, 中文 (Chinese), Español (Spanish), Français (French)
- **Auto-detects** browser language
- **Language picker** in the topbar

### 📱 PWA
- **Installable** on mobile + desktop home screen
- **Offline support** via service worker (caches app shell)
- **App shortcuts** — long-press icon for quick access to Dashboard, New Agent, Approvals, Analytics

### 🔒 Privacy & Security
- **API keys encrypted at rest** with AES-256-GCM
- **OAuth tokens encrypted** in the database
- **Terms of Service + Privacy Policy** acceptance on first login
- **Anonymous analytics** — opt-in only, no personal data sent
- **Local model support** — your data never leaves your machine

### 💳 100% Free & Open Source
- **No paid plans** — no billing, no credit card, no Stripe/Paystack
- **MIT License** — use it, fork it, self-host it, modify it
- **2 agents, 100K tokens/day, all features included**
- **Local model support** — run 100% free with Ollama/LM Studio (zero API costs)

---

## 🚀 Quick Start

### Prerequisites
- [Bun](https://bun.sh/) 1.0+ (or Node.js 18+)
- A [Firebase](https://console.firebase.google.com) project (free) — for Google login *(optional: Demo Mode works without Firebase)*

### Local Development

**Full step-by-step guide:** See [LOCAL_SETUP.md](./LOCAL_SETUP.md) for Windows, macOS, and Linux instructions.

**Quick version:**

```bash
git clone https://github.com/lingzi3628-dot/AGENTMARK.git
cd AGENTMARK
bun install
```

Create a `.env` file (copy from `.env.example`):

```env
DATABASE_URL=file:./db/custom.db
APP_ENCRYPTION_KEY=<run: openssl rand -hex 32>

# Firebase (optional — Demo Mode works without these)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Set up the database and start the dev server:

```bash
bunx prisma db push
bun run dev
```

Open http://localhost:3000 → click **"Try Demo Mode"** (no login needed) or sign in with Google.

> **Don't have Bun?** Install it: `curl -fsSL https://bun.sh/install | bash` (Mac/Linux) or `irm bun.sh/install.ps1 | iex` (Windows PowerShell). You can also use `npm` instead of `bun`.

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
2. Set env vars (use `file:/data/agentmark.db` for `DATABASE_URL` with a persistent volume)
3. Deploy — Railway auto-detects the Dockerfile

### Option 3: Docker

```bash
docker build -t agentmark .
docker run -p 3000:3000 \
  -e DATABASE_URL=file:/data/agentmark.db \
  -e APP_ENCRYPTION_KEY=<your-key> \
  agentmark
```

---

## 🔧 Environment Variables

See [`.env.example`](./.env.example) for the complete list. Key variables:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | SQLite (dev) or Postgres (prod) connection string |
| `APP_ENCRYPTION_KEY` | ✅ | 64-char hex for encrypting API keys at rest |
| `NEXT_PUBLIC_FIREBASE_*` | ❌ | Firebase config (6 vars) for Google login *(optional — Demo Mode works without)* |
| `SCHEDULER_API_KEY` | ❌ | Protects cron endpoint |
| `EMAIL_POLL_API_KEY` | ❌ | Protects email poller |
| `AI_API_KEY` | ❌ | GLM-4.6 model access (or use local models) |
| `TWILIO_*` | ❌ | Voice + SMS agents |
| `GOOGLE_OAUTH_CLIENT_ID` | ❌ | Google OAuth connector |
| `GITHUB_OAUTH_CLIENT_ID` | ❌ | GitHub OAuth connector |

> **Note:** AGENTMARK is free + open source. No billing env vars needed.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript 5 |
| **UI** | React 19, Tailwind CSS 4, shadcn/ui |
| **State** | Zustand |
| **Database** | Prisma ORM (SQLite for dev, Postgres for prod) |
| **Auth** | Firebase Google Login + Demo Mode |
| **Canvas** | @xyflow/react (React Flow) |
| **AI** | Direct HTTP API (OpenAI-compatible), Xenova Transformers (RAG embeddings) |
| **Local Models** | Ollama, LM Studio, Jan, llama.cpp |
| **Charts** | Recharts |
| **Email** | ImapFlow + Nodemailer |
| **Voice/SMS** | Twilio |
| **Real-time** | Server-Sent Events (SSE) for presence + live cursors |
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
│   │   ├── api/                   # 68+ API routes
│   │   │   ├── agents/[id]/       # CRUD + run + debug + optimize + insights
│   │   │   ├── billing/           # Free-only status
│   │   │   ├── connectors/        # OAuth flow + callback
│   │   │   ├── presence/[agentId] # SSE for real-time collaboration
│   │   │   ├── webhooks/          # Telegram, WhatsApp, Slack receivers + log
│   │   │   ├── voice/             # Twilio voice agents
│   │   │   ├── v1/                # Public REST API (rate-limited)
│   │   │   ├── analytics/         # Anonymous usage data collection
│   │   │   └── ...
│   │   ├── layout.tsx             # Root layout + PWA meta + SW registration
│   │   └── page.tsx               # Main app (33 views routed)
│   ├── components/
│   │   ├── studio/
│   │   │   ├── views/             # 33 sidebar views
│   │   │   ├── nodes/             # React Flow node components
│   │   │   ├── sidebar.tsx        # Navigation (33 items)
│   │   │   ├── topbar.tsx         # Header + language picker
│   │   │   ├── inspector-panel.tsx
│   │   │   ├── presence-overlay.tsx # Live cursors
│   │   │   ├── terms-acceptance.tsx # ToS + Privacy modal
│   │   │   └── ...
│   │   └── ui/                    # shadcn/ui components
│   ├── lib/
│   │   ├── ai.ts                  # Workflow execution engine
│   │   ├── crypto.ts              # AES-256-GCM encryption
│   │   ├── embeddings.ts          # RAG embeddings (Xenova)
│   │   ├── retry.ts               # Smart retries with backoff
│   │   ├── rate-limit.ts          # API rate limiting
│   │   ├── presence.ts            # Real-time collaboration store
│   │   ├── plans.ts               # Free-only plan definition
│   │   ├── oauth-providers.ts     # OAuth connector definitions
│   │   ├── analytics.ts           # Anonymous analytics SDK
│   │   ├── i18n.ts                # Internationalization
│   │   └── ...
│   └── messages/                  # i18n translations (en, zh, es, fr)
├── tests/                         # Playwright E2E tests
├── Dockerfile                     # Docker deploy config
├── railway.json                   # Railway deploy config
├── vercel.json                    # Vercel deploy config + cron jobs
├── .env.example                   # Environment variable template
├── LOCAL_SETUP.md                 # Local dev setup guide
├── LOCAL_MODELS.md                # Local AI models guide
├── DEPLOY.md                      # Deployment guide
├── CONTRIBUTING.md                # Contribution guidelines
└── LICENSE                        # MIT License
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

## 🤝 Contributing

AGENTMARK is **open source** and free to use. Anyone can fork, self-host, and contribute via pull requests. Only the repository owner can merge to `main` to maintain quality.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## 🙏 Acknowledgments

**Built by [Spyro Technology](https://spyro.tech) × AGENTMARK**

- [Next.js](https://nextjs.org) — React framework
- [shadcn/ui](https://ui.shadcn.com) — UI components
- [React Flow](https://reactflow.dev) — Visual workflow canvas
- [Prisma](https://prisma.io) — Database ORM
- [Xenova Transformers](https://xenova.github.io/transformers.js/) — In-browser ML embeddings
- [Ollama](https://ollama.ai) — Local model runner

---

## 💬 Support

- 🐛 [Report a bug](https://github.com/lingzi3628-dot/AGENTMARK/issues)
- 💡 [Request a feature](https://github.com/lingzi3628-dot/AGENTMARK/issues)
- ⭐ [Star this repo](https://github.com/lingzi3628-dot/AGENTMARK) if you find it useful!

---

**Built with ❤️ by Spyro Technology. 100% free, 100% open source.**
