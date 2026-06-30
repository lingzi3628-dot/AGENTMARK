#!/bin/bash
# ===========================================
# AGENTMARK — One-Command Vercel Deploy
# ===========================================
# This script:
#   1. Installs Vercel CLI (if missing)
#   2. Links the project to Vercel (or creates a new one)
#   3. Prompts for required env vars and sets them
#   4. Creates a Vercel Postgres database and links it
#   5. Generates an APP_ENCRYPTION_KEY for you
#   6. Deploys to production
#
# Usage: bash scripts/vercel-deploy.sh
# ===========================================

set -e
cd "$(dirname "$0")/.."

echo "🚀 AGENTMARK — Vercel Deploy Script"
echo "==================================="
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
  echo "📦 Installing Vercel CLI..."
  npm install -g vercel
fi

# Check if logged in
if ! vercel whoami &> /dev/null; then
  echo "🔐 Please log in to Vercel:"
  vercel login
fi

echo ""
echo "📋 Linking project to Vercel..."
echo "  (If prompted, choose: Link to existing project? N → New project name: agentmark → all defaults)"
vercel link --yes || true

# Generate APP_ENCRYPTION_KEY if not set
ENCRYPTION_KEY=$(openssl rand -hex 32)
echo ""
echo "🔐 Generated APP_ENCRYPTION_KEY: $ENCRYPTION_KEY"

# Set required env vars
echo ""
echo "📝 Setting required environment variables..."

# APP_ENCRYPTION_KEY (auto-generated)
echo "  - APP_ENCRYPTION_KEY (auto-generated)"
vercel env add APP_ENCRYPTION_KEY production <<< "$ENCRYPTION_KEY" 2>/dev/null || \
  vercel env add APP_ENCRYPTION_KEY production << EOF
$ENCRYPTION_KEY
EOF

# DATABASE_URL — prompt or create Postgres
echo ""
echo "🗄️  Database setup:"
echo "  Option 1: I already have a DATABASE_URL (paste it)"
echo "  Option 2: Create a new Vercel Postgres database (recommended)"
read -p "Choose 1 or 2: " DB_CHOICE

if [ "$DB_CHOICE" = "2" ]; then
  echo ""
  echo "Creating Vercel Postgres database..."
  echo "  (This opens your browser — accept the defaults)"
  vercel storage create --store-name agentmark-db --database-type postgres || true
  echo ""
  echo "✅ Database created. Now linking it to the project..."
  vercel storage link agentmark-db production || true
  echo ""
  echo "ℹ️  Vercel automatically added DATABASE_URL to your env vars."
  DATABASE_URL="auto-set-by-vercel"
else
  read -p "Paste your DATABASE_URL (postgresql://...): " DATABASE_URL
  vercel env add DATABASE_URL production <<< "$DATABASE_URL" 2>/dev/null || \
    vercel env add DATABASE_URL production << EOF
$DATABASE_URL
EOF
fi

# Firebase — prompt for each
echo ""
echo "🔥 Firebase setup (required for Google login):"
echo "  Get these from: https://console.firebase.google.com → Project Settings → General → Your apps"
read -p "  NEXT_PUBLIC_FIREBASE_API_KEY: " FB_API_KEY
read -p "  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN (e.g. yourproject.firebaseapp.com): " FB_AUTH_DOMAIN
read -p "  NEXT_PUBLIC_FIREBASE_PROJECT_ID: " FB_PROJECT_ID
read -p "  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET (e.g. yourproject.appspot.com): " FB_STORAGE_BUCKET
read -p "  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: " FB_SENDER_ID
read -p "  NEXT_PUBLIC_FIREBASE_APP_ID: " FB_APP_ID

for var_val in \
  "NEXT_PUBLIC_FIREBASE_API_KEY:$FB_API_KEY" \
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:$FB_AUTH_DOMAIN" \
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID:$FB_PROJECT_ID" \
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:$FB_STORAGE_BUCKET" \
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:$FB_SENDER_ID" \
  "NEXT_PUBLIC_FIREBASE_APP_ID:$FB_APP_ID"; do
  VAR_NAME="${var_val%%:*}"
  VAR_VALUE="${var_val#*:}"
  if [ -n "$VAR_VALUE" ]; then
    echo "  - $VAR_NAME"
    vercel env add "$VAR_NAME" production <<< "$VAR_VALUE" 2>/dev/null || \
      vercel env add "$VAR_NAME" production << EOF
$VAR_VALUE
EOF
  fi
done

# Optional vars — generate random keys for cron protection
SCHEDULER_KEY=$(openssl rand -hex 16)
EMAIL_KEY=$(openssl rand -hex 16)
echo ""
echo "🔐 Setting cron protection keys (auto-generated)..."
vercel env add SCHEDULER_API_KEY production <<< "$SCHEDULER_KEY" 2>/dev/null || \
  vercel env add SCHEDULER_API_KEY production << EOF
$SCHEDULER_KEY
EOF
vercel env add EMAIL_POLL_API_KEY production <<< "$EMAIL_KEY" 2>/dev/null || \
  vercel env add EMAIL_POLL_API_KEY production << EOF
$EMAIL_KEY
EOF

# Deploy
echo ""
echo "🚀 Deploying to production..."
echo "  (This takes 2-3 minutes — Vercel runs: prisma generate + db push + next build)"
vercel --prod

echo ""
echo "✅ Deploy complete!"
echo ""
echo "📋 Summary:"
echo "  - APP_ENCRYPTION_KEY: $ENCRYPTION_KEY (saved to Vercel)"
echo "  - SCHEDULER_API_KEY: $SCHEDULER_KEY (saved to Vercel)"
echo "  - EMAIL_POLL_API_KEY: $EMAIL_KEY (saved to Vercel)"
echo "  - DATABASE_URL: set via Vercel Postgres"
echo ""
echo "🔍 Next steps:"
echo "  1. Visit your deployment URL (printed above)"
echo "  2. Sign in with Google"
echo "  3. Create your first agent!"
echo ""
echo "💳 To enable billing later:"
echo "  Set PAYSTACK_SECRET_KEY + PAYSTACK_PLAN_PRO + PAYSTACK_PLAN_TEAM in Vercel env vars"
echo ""
echo "🔔 Note: Vercel Cron jobs (scheduler + email poll) are configured in vercel.json"
echo "  They'll start running automatically after the first deploy."
