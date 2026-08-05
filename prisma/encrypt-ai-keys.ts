/**
 * One-time migration: encrypt any AI provider API keys that are still stored
 * in plaintext (rows written before at-rest encryption was enabled).
 *
 * Run with: npm run db:encrypt-ai-keys
 * Idempotent — already-encrypted rows are skipped.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { encryptSecret, isEncryptedSecret } from "../src/lib/secrets";

const prisma = new PrismaClient();

async function main() {
  const providers = await prisma.aiProviderConfig.findMany({
    select: { id: true, label: true, apiKeyEncrypted: true },
  });

  let encrypted = 0;
  let skipped = 0;

  for (const p of providers) {
    if (isEncryptedSecret(p.apiKeyEncrypted)) {
      skipped++;
      continue;
    }
    if (!p.apiKeyEncrypted) {
      skipped++;
      continue;
    }
    await prisma.aiProviderConfig.update({
      where: { id: p.id },
      data: { apiKeyEncrypted: encryptSecret(p.apiKeyEncrypted) },
    });
    console.log(`Encrypted key for "${p.label}"`);
    encrypted++;
  }

  console.log(`\nDone. ${encrypted} key(s) encrypted, ${skipped} already encrypted/empty.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
