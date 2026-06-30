# 🚀 Deploy AGENTMARK to Vercel — Fast & Easy

You have **two options** to deploy. Pick whichever you prefer.

---

## Option 1: One-Command Deploy (Recommended) ⭐

Run this single command in your terminal:

```bash
cd AGENTMARK
bash scripts/vercel-deploy.sh
```

**What it does automatically:**
1. ✅ Installs Vercel CLI
2. ✅ Links your project to Vercel
3. ✅ Creates a Vercel Postgres database (free tier)
4. ✅ Generates `APP_ENCRYPTION_KEY` (for encrypting user API keys)
5. ✅ Generates `SCHEDULER_API_KEY` + `EMAIL_POLL_API_KEY` (for cron protection)
6. ✅ Prompts for your Firebase keys (with links to where to find them)
7. ✅ Sets ALL env vars in Vercel
8. ✅ Deploys to production

**You only need:**
- A [Vercel account](https://vercel.com/signup) (free)
- A [Firebase project](https://console.firebase.google.com) with Google sign-in enabled (free)
- 5 minutes

---

## Option 2: Manual Deploy via Vercel Dashboard

If you prefer clicking through a UI:

### Step 1: Create the database
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard) → **Storage** → **Create Database**
2. Choose **Postgres (Neon)** → Name it `agentmark-db` → Create
3. Click **Connect to Project** → Select your repo

### Step 2: Import the repo
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import `lingzi3628-dot/AGENTMARK`
3. Vercel auto-detects Next.js — **don't change any build settings**

### Step 3: Add env vars
Before clicking **Deploy**, expand **Environment Variables** and add each one from `.env.example`.

**Required (8 vars):**
| Variable | Value |
|---|---|
| `DATABASE_URL` | (auto-set if you connected Vercel Postgres in Step 1) |
| `APP_ENCRYPTION_KEY` | Run `openssl rand -hex 32` locally, paste the output |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | From Firebase Console → Project Settings → General |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `yourproject.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Your Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `yourproject.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | From Firebase Console |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | From Firebase Console |

**Optional (set only if you want these features):**
- `PAYSTACK_SECRET_KEY`, `PAYSTACK_PLAN_PRO`, `PAYSTACK_PLAN_TEAM` — for billing
- `SCHEDULER_API_KEY` — random string to protect the cron endpoint
- `EMAIL_POLL_API_KEY` — random string to protect the email poller
- `ZAI_API_KEY`, `ZAI_BASE_URL` — for GLM-4.6 model access
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` — for voice/SMS
- `WHATSAPP_VERIFY_TOKEN`, `SLACK_SIGNING_SECRET` — for those platforms

### Step 4: Deploy
Click **Deploy**. Vercel runs `vercel-build` automatically (prisma generate + db push + next build). Takes 2-3 minutes.

### Step 5: Enable Cron Jobs
After the first deploy, Vercel auto-detects the cron jobs from `vercel.json`:
- `/api/scheduler/tick` — runs every minute (scheduled agents)
- `/api/email/poll` — runs every 5 minutes (email auto-responder)

No action needed — they just work.

---

## 🔥 Firebase Setup (one-time, 5 minutes)

If you don't have a Firebase project yet:

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
2. Name it `agentmark` → Continue
3. **Build → Authentication → Sign-in method → Google → Enable**
4. **Project Settings (gear icon) → General → Your apps → `</>` (Web app)**
5. Register app name `agentmark-web` → Register
6. Copy the 6 config values (apiKey, authDomain, projectId, etc.) — these go in your Vercel env vars
7. **Authentication → Settings → Authorized domains → Add your Vercel domain** (e.g. `agentmark.vercel.app`)

---

## ✅ Verify Your Deploy

After deploy completes, visit your Vercel URL. You should see:
1. AGENTMARK login screen with Google button
2. Click "Continue with Google" → sign in
3. Land on the dashboard
4. Click "New Agent" → describe an idea → AI generates the workflow
5. Click "Run" → chat with your agent

---

## 🆘 Troubleshooting

**"Database connection failed"**
- Make sure `DATABASE_URL` is set in Vercel env vars (Production environment)
- If using Vercel Postgres, click "Connect to Project" in the Storage tab

**"Firebase: auth/unauthorized-domain"**
- Go to Firebase Console → Authentication → Settings → Authorized domains
- Add your Vercel domain (e.g. `agentmark-xxx.vercel.app`)

**"Prisma: Client was generated for SQLite, but you're using Postgres"**
- This shouldn't happen — our `scripts/prisma-config.js` auto-detects the database type
- If it does, redeploy (Vercel will re-run the build)

**"Billing shows Coming Soon"**
- This is expected! Set `PAYSTACK_SECRET_KEY` env var to enable billing
- Until then, the Free tier (2 agents) works fully

---

## 💡 Tips

- **Vercel free tier** is enough for getting started (100GB bandwidth, 100GB-hrs serverless)
- **Vercel Postgres free tier** includes 60 compute hours + 256MB storage (plenty for dev)
- **Cron jobs** on free tier run up to 100 times/day (way more than our 2 jobs need)
- **Function timeouts**: We set 60s max for run/email/voice routes — Vercel free tier allows up to 60s on Pro
