# 🖥️ Local Setup Guide (Windows + macOS + Linux)

Get AGENTMARK running on your local machine in 5 minutes.

---

## 🪟 Windows Setup

### Step 1: Install Bun (JavaScript runtime)

Open **PowerShell** (press `Win + X` → "Windows PowerShell" or "Terminal") and run:

```powershell
irm bun.sh/install.ps1 | iex
```

**After installation completes, CLOSE PowerShell and open a new window** (this refreshes your PATH so `bun` is recognized).

Verify it installed:

```powershell
bun --version
```

You should see something like `1.3.14`.

> **Don't want to use Bun?** You can use Node.js instead:
> 1. Download Node.js LTS from https://nodejs.org
> 2. Install it
> 3. Reopen your terminal
> 4. Replace `bun` with `npm` and `bunx` with `npx` in all commands below

### Step 2: Clone the repo

```powershell
git clone https://github.com/lingzi3628-dot/AGENTMARK.git
cd AGENTMARK
```

> **Already cloned?** Just `cd AGENTMARK`

### Step 3: Install dependencies

```powershell
bun install
```

### Step 4: Create a `.env` file

Create a file named `.env` in the AGENTMARK folder with this content:

```env
# Database (SQLite — stored locally in db/custom.db)
DATABASE_URL=file:./db/custom.db

# Encryption key for API keys (generate any 64-char hex string)
APP_ENCRYPTION_KEY=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2

# Firebase (for Google login — see Step 6 if you don't have this yet)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

> You can use any 64-character hex string (0-9 and a-f) for `APP_ENCRYPTION_KEY`.

### Step 5: Set up the database

```powershell
bunx prisma db push
```

This creates the SQLite database file with all the tables.

### Step 6: Start the dev server

```powershell
bun run dev
```

Open http://localhost:3000 in your browser. ✅

---

## 🍎 macOS Setup

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Close and reopen terminal, then:
git clone https://github.com/lingzi3628-dot/AGENTMARK.git
cd AGENTMARK
bun install
bunx prisma db push
bun run dev
```

Open http://localhost:3000

---

## 🐧 Linux Setup

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Close and reopen terminal, then:
git clone https://github.com/lingzi3628-dot/AGENTMARK.git
cd AGENTMARK
bun install
bunx prisma db push
bun run dev
```

Open http://localhost:3000

---

## 🔥 Firebase Setup (for Google Login)

The app uses Firebase for Google authentication. You need a free Firebase project:

### 1. Create a Firebase project

1. Go to https://console.firebase.google.com
2. Click **"Add project"**
3. Name it `agentmark` (or anything you want)
4. Click through the prompts (you can disable Google Analytics)

### 2. Enable Google Sign-In

1. In the Firebase Console, click **"Build"** → **"Authentication"**
2. Click **"Get started"**
3. Go to **"Sign-in method"** tab
4. Click **"Google"** → **Enable** → select your email → **Save**

### 3. Register a web app

1. Click the **gear icon** (Project Settings) top-left
2. Scroll down to **"Your apps"** → click **`</>` (Web app)**
3. Register an app nickname: `agentmark-local`
4. **Copy the 6 config values** — these go in your `.env` file:
   - `apiKey` → `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `authDomain` → `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `projectId` → `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `storageBucket` → `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `messagingSenderId` → `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `appId` → `NEXT_PUBLIC_FIREBASE_APP_ID`

### 4. Add localhost as an authorized domain

1. In Firebase Console → **Authentication** → **Settings** → **Authorized domains**
2. Click **"Add domain"**
3. Add `localhost`
4. Save

### 5. Put the values in your `.env` file

Your `.env` should now look like:

```env
DATABASE_URL=file:./db/custom.db
APP_ENCRYPTION_KEY=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=agentmark-xxxxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=agentmark-xxxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=agentmark-xxxxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123def456
```

### 6. Restart the dev server

```powershell
# Stop the server (Ctrl+C), then:
bun run dev
```

Now you can sign in with Google! 🎉

---

## 🦙 Optional: Use Local AI Models (100% Free)

Want to use Ollama or LM Studio instead of cloud APIs? See [LOCAL_MODELS.md](./LOCAL_MODELS.md) for setup.

Quick version:
1. Install [Ollama](https://ollama.ai)
2. Run `ollama pull llama3.2`
3. In AGENTMARK → Settings → Custom API Keys → Add Key → Provider: "🦙 Ollama (Local)"
4. Done — your agents now use a free local model!

---

## 🐛 Troubleshooting

### "bun is not recognized"
- **Windows:** Close and reopen PowerShell after installing Bun
- **macOS/Linux:** Close and reopen terminal, or run `source ~/.bashrc`
- **Verify:** `bun --version` should print a version number

### "Prisma schema validation error: Environment variable not found: DATABASE_URL"
- Make sure you created a `.env` file in the AGENTMARK folder (not in a subfolder)
- The file must be named exactly `.env` (not `.env.txt`)
- Make sure `DATABASE_URL=file:./db/custom.db` is in it

### "Firebase: auth/unauthorized-domain"
- Go to Firebase Console → Authentication → Settings → Authorized domains
- Add `localhost`

### Port 3000 already in use
- Find what's using it: `netstat -ano | findstr :3000` (Windows)
- Kill the process or use a different port: `bun run dev -- -p 3001`

### "Module not found" errors
- Delete `node_modules` and reinstall:
  ```powershell
  Remove-Item -Recurse -Force node_modules
  bun install
  ```

---

## 📝 Summary of Commands

| Step | Command |
|---|---|
| Install Bun (Windows) | `irm bun.sh/install.ps1 \| iex` |
| Install Bun (Mac/Linux) | `curl -fsSL https://bun.sh/install \| bash` |
| Clone repo | `git clone https://github.com/lingzi3628-dot/AGENTMARK.git` |
| Install deps | `bun install` |
| Set up DB | `bunx prisma db push` |
| Start server | `bun run dev` |
| Open app | http://localhost:3000 |

---

**Need help?** [Open an issue](https://github.com/lingzi3628-dot/AGENTMARK/issues)
