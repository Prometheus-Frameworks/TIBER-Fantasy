#!/usr/bin/env node
/**
 * TIBER API Key Generator
 * Run this in Replit shell: node scripts/generate-api-key.js <owner-label>
 * Example: node scripts/generate-api-key.js "max-openclaw"
 */

import { createHash, randomBytes } from "node:crypto";

const label = process.argv[2];
if (!label) {
  console.error("Usage: node scripts/generate-api-key.js <owner-label>");
  process.exit(1);
}

// Generate a random key: tiber_sk_<32 random hex bytes>
const raw = "tiber_sk_" + randomBytes(32).toString("hex");
const hash = createHash("sha256").update(raw).digest("hex");

console.log("\n=== TIBER API Key ===");
console.log("Owner label:", label);
console.log("\nYour API key (save this — it won't be shown again):");
console.log(raw);
console.log("\nRun this SQL in your Neon DB console to activate it:");
console.log(`
INSERT INTO api_keys (key_hash, owner_label, tier, rate_limit_rpm)
VALUES (
  '${hash}',
  '${label}',
  'internal',
  120
);
`);
console.log("===================\n");
