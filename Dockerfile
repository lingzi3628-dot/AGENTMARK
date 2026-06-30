# AGENTMARK Dockerfile — works on Railway, Vercel, and any Docker host
# Uses Bun for install + build, Node for runtime (smaller image)

# ---- Build stage ----
FROM oven/bun:1 AS base
WORKDIR /app

# Copy lockfile + package.json FIRST (better layer caching)
COPY package.json bun.lock ./

# Install all dependencies (including devDependencies for build)
RUN bun install --frozen-lockfile

# Copy prisma schema and generate client EARLY (so it's cached separately)
COPY prisma ./prisma
COPY scripts ./scripts
RUN node scripts/prisma-config.js && bunx prisma generate

# Copy the rest of the source
COPY . .

# Build the Next.js app (prisma generate already ran above, so just build)
# Sets placeholder env vars for the build — real values come from Railway env vars at runtime
ENV DATABASE_URL="file:/tmp/build.db"
ENV NEXT_PUBLIC_FIREBASE_API_KEY="build-placeholder"
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="build.firebaseapp.com"
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID="build"
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="build.appspot.com"
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="000000000000"
ENV NEXT_PUBLIC_FIREBASE_APP_ID="1:000000000000:web:0000000000000000000000"
RUN node_modules/.bin/next build

# ---- Runtime stage (smaller image) ----
FROM oven/bun:1 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy only what we need at runtime
COPY --from=base /app/package.json ./
COPY --from=base /app/bun.lock ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/.next ./.next
COPY --from=base /app/public ./public
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/scripts ./scripts
COPY --from=base /app/next.config.ts ./
COPY --from=base /app/tsconfig.json ./
COPY --from=base /app/tailwind.config.ts ./
COPY --from=base /app/postcss.config.mjs ./
COPY --from=base /app/components.json ./

# Install only production dependencies (smaller image)
RUN bun install --frozen-lockfile --production

# Re-generate Prisma client (in case production install removed it)
RUN node scripts/prisma-config.js && bunx prisma generate

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Railway sets DATABASE_URL via env vars at runtime
# start:railway pushes the schema then starts Next.js
CMD ["sh", "-c", "node_modules/.bin/prisma db push --accept-data-loss || true && node_modules/.bin/next start"]
