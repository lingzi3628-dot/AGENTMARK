FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build
COPY . .
RUN bun run build

# Production
FROM oven/bun:1 AS runner
WORKDIR /app
COPY --from=base /app ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["bun", "run", "start"]
