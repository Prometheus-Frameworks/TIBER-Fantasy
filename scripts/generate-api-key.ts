import { createHash, randomBytes } from "node:crypto";
import { db } from "../server/infra/db";
import { apiKeys } from "../shared/schema";

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const label = getArg("label");
  const tier = getArg("tier") ?? "internal";

  if (!label) {
    throw new Error('Missing --label. Example: --label "BossManJ"');
  }

  if (!["internal", "trusted", "public"].includes(tier)) {
    throw new Error('Invalid --tier. Must be one of: internal | trusted | public');
  }

  const rawKey = `tiber_sk_${randomBytes(32).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  await db.insert(apiKeys).values({
    keyHash,
    ownerLabel: label,
    tier,
  });

  console.log(`Generated API key for ${label} (${tier})`);
  console.log(`Key: ${rawKey}`);
  console.log("Key hash stored in database. This is the only time the raw key is shown.");
}

main().catch((err) => {
  console.error("Failed to generate API key:", err instanceof Error ? err.message : err);
  process.exit(1);
});
