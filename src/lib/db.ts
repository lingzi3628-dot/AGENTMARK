import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Validate the cached client still exposes the latest models. After a
// `prisma db push` regenerates @prisma/client, a long-lived dev server can
// keep an old PrismaClient instance in `globalThis` that lacks newly added
// models (e.g. ApiKey, Team). Detect that and rebuild the client in dev.
function isValidClient(c: PrismaClient | undefined): c is PrismaClient {
  return !!c && typeof (c as unknown as { apiKey?: unknown }).apiKey === 'object'
}

export const db = isValidClient(globalForPrisma.prisma)
  ? globalForPrisma.prisma!
  : new PrismaClient({
      log: ['query'],
    })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db