# Security Policy

## 🔒 Reporting a Vulnerability

If you discover a security vulnerability in AGENTMARK, please report it responsibly:

1. **DO NOT** open a public GitHub issue
2. Email: **lingzi3628@gmail.com** with details
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within **48 hours** and work with you to fix the issue before any public disclosure.

## 🛡️ Security Measures

AGENTMARK implements the following security measures:

### API Key Encryption
- All user-supplied API keys are encrypted at rest with **AES-256-GCM**
- Encryption key (`APP_ENCRYPTION_KEY`) is a server-side env var — never in source code
- Keys are never returned in plaintext after storage

### Admin Panel Protection
- Admin panel at `/admin` is protected by `ADMIN_SECRET_KEY` env var
- Not linked anywhere in the public UI
- All `/api/admin/*` routes require key verification
- Returns 503 if not configured, 401 if wrong key

### SDK Access Control
- SDK source code is only downloadable by registered users
- API keys required for all `/api/v1/*` endpoints
- Rate limited: 100 req/min general, 20 runs/min per key
- Scopes: `agents:read`, `agents:run`, `agents:write`, `templates:read`

### Sandboxed Code Execution
- JavaScript code nodes run in a `vm` sandbox (no `require`, `process`, `fs`)
- Python code nodes run in Pyodide WASM sandbox (isolated from host)
- `isolated-vm` available for hard V8 isolate-based execution
- Memory + CPU limits enforced

### Webhook Security
- Telegram webhooks auto-registered with integration ID
- Slack webhooks verified with HMAC-SHA256 signatures
- WhatsApp webhooks verified with verify tokens
- Custom webhook triggers support HMAC signature verification

### Branch Protection
- `main` branch is protected
- Pull requests require review from the code owner (`@lingzi3628-dot`)
- CI checks (lint + build + tests) must pass before merge
- No direct pushes to `main` (except by owner)

## 🔐 Environment Variables

The following env vars contain secrets and must **never** be committed to git:
- `APP_ENCRYPTION_KEY` — AES-256-GCM encryption key
- `ADMIN_SECRET_KEY` — Admin panel access key
- `AI_API_KEY` — LLM provider API key
- `SCHEDULER_API_KEY` — Cron endpoint protection
- `EMAIL_POLL_API_KEY` — Email poller protection
- `REDIS_URL` — Redis connection (may contain password)
- `PINECONE_API_KEY` / `QDRANT_API_KEY` / `WEAVIATE_API_KEY` — Vector DB keys
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` — Twilio credentials
- `GOOGLE_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_ID` — OAuth credentials

## ✅ Security Checklist for Self-Hosters

If you're self-hosting AGENTMARK:

1. ✅ Generate a unique `APP_ENCRYPTION_KEY` (`openssl rand -hex 32`)
2. ✅ Generate a unique `ADMIN_SECRET_KEY` (`openssl rand -hex 32`)
3. ✅ Set `SCHEDULER_API_KEY` and `EMAIL_POLL_API_KEY` to random strings
4. ✅ Use HTTPS (not HTTP) for your deployment
5. ✅ Set up a firewall if self-hosting on a VPS
6. ✅ Regularly update dependencies (`bun update`)
7. ✅ Monitor the admin panel for suspicious activity
8. ❌ NEVER commit `.env` files to git
9. ❌ NEVER share your `ADMIN_SECRET_KEY` with anyone
10. ❌ NEVER use the dev fallback encryption key in production

## 📅 Security Updates

Security patches are released as soon as vulnerabilities are confirmed.
Watch the repository (⭐ Star + 👁️ Watch) to be notified of new releases.

## 🏢 Responsible Disclosure

We follow responsible disclosure practices:
- Vulnerability reports are kept confidential until a fix is released
- Credit is given to the reporter (unless they prefer anonymity)
- We request a 90-day window before public disclosure

---

**Built by [Spyro Technology](https://spyro.tech) × AGENTMARK**
