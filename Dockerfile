FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Generate Prisma client + build
COPY . .
RUN bunx prisma generate
RUN bun run build

# Production — slim image
FROM oven/bun:1 AS runner
WORKDIR /app

COPY --from=base /app/package.json ./
COPY --from=base /app/bun.lock ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/.next ./.next
COPY --from=base /app/public ./public
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/next.config.ts ./
COPY --from=base /app/tsconfig.json ./
COPY --from=base /app/postcss.config.mjs ./
COPY --from=base /app/components.json ./
COPY --from=base /app/tailwind.config.ts ./

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000
CMD ["bun", "run", "start"]
