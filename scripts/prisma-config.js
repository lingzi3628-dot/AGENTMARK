// Pre-build hook: auto-switch Prisma provider based on DATABASE_URL.
// Runs before `prisma generate` and `prisma db push`.
// - If DATABASE_URL starts with "postgres" → set provider to "postgresql"
// - Otherwise → set provider to "sqlite" (default for dev)
//
// This file is plain CommonJS because it runs before the build pipeline
// (and we don't want TS/ESM resolution issues blocking Prisma).

/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("fs");
const path = require("path");

const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");
const dbUrl = process.env.DATABASE_URL || "";

const isPostgres = dbUrl.startsWith("postgresql://") || dbUrl.startsWith("postgres://");
const provider = isPostgres ? "postgresql" : "sqlite";

let schema = fs.readFileSync(schemaPath, "utf8");

// Replace the provider line in the datasource block
const newSchema = schema.replace(
  /datasource db \{\s*\n\s*provider\s*=\s*"[^"]*"/,
  `datasource db {\n  provider = "${provider}"`,
);

if (schema !== newSchema) {
  fs.writeFileSync(schemaPath, newSchema);
  console.log(`[prisma-config] Set Prisma provider to "${provider}" based on DATABASE_URL`);
} else {
  console.log(`[prisma-config] Provider already set to "${provider}"`);
}

// For Postgres, we need to handle JSON fields differently. SQLite stores them as String,
// Postgres can use Json type. But since we use JSON.stringify/parse manually in the code,
// keeping them as String works on both — Postgres will use TEXT type.
// No further changes needed.
