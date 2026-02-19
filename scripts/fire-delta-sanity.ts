import http from "http";

const BASE = "http://localhost:5000";

function get(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}${path}`, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Bad JSON from ${path}: ${data.slice(0, 200)}`));
        }
      });
    }).on("error", reject);
  });
}

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function testFireBatch(season: number, week: number) {
  console.log(`\n--- FIRE batch season=${season} week=${week} ---`);
  const res = await get(`/api/fire/eg/batch?season=${season}&week=${week}`);

  assert("has metadata", !!res.metadata);
  assert("has data array", Array.isArray(res.data));
  const eligible = res.data.filter((d: any) => d.eligible);
  assert("eligible count > 0", eligible.length > 0, `got ${eligible.length}`);
  assert("no QBs", eligible.every((d: any) => d.position !== "QB"));

  for (const p of eligible.slice(0, 5)) {
    assert(
      `${p.playerName} fireScore bounded [0,100]`,
      p.fireScore >= 0 && p.fireScore <= 100,
      `got ${p.fireScore}`
    );
    assert(
      `${p.playerName} has windowGamesPlayed`,
      typeof p.windowGamesPlayed === "number" && p.windowGamesPlayed >= 0,
      `got ${p.windowGamesPlayed}`
    );
    assert(
      `${p.playerName} has confidence`,
      ["HIGH", "MED", "LOW"].includes(p.confidence),
      `got ${p.confidence}`
    );
    assert(
      `${p.playerName} no NaN in pillars`,
      !isNaN(p.pillars.opportunity) && !isNaN(p.pillars.role) && !isNaN(p.pillars.conversion),
      `opp=${p.pillars.opportunity} role=${p.pillars.role} conv=${p.pillars.conversion}`
    );
  }
}

async function testDeltaBatch(season: number, week: number) {
  console.log(`\n--- DELTA batch season=${season} week=${week} ---`);
  const res = await get(`/api/delta/eg/batch?season=${season}&week=${week}`);

  assert("has metadata", !!res.metadata);
  assert("has data array", Array.isArray(res.data));
  assert("total > 0", res.metadata.total > 0, `got ${res.metadata.total}`);
  assert("no QBs", res.data.every((d: any) => d.position !== "QB"));
  assert("mode present", !!res.metadata.mode, `got ${res.metadata.mode}`);

  const sorted = res.data;
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i - 1].delta.rankZ) < Math.abs(sorted[i].delta.rankZ)) {
      assert("sort order by |rankZ| desc", false, `index ${i - 1} < index ${i}`);
      break;
    }
  }
  if (sorted.length > 1) assert("sort order by |rankZ| desc", true);

  for (const p of sorted.slice(0, 5)) {
    assert(
      `${p.playerName} has confidence`,
      ["HIGH", "MED", "LOW"].includes(p.confidence),
      `got ${p.confidence}`
    );
    assert(
      `${p.playerName} has windowGamesPlayed`,
      typeof p.windowGamesPlayed === "number",
      `got ${p.windowGamesPlayed}`
    );
    assert(
      `${p.playerName} has why object`,
      typeof p.why === "object" && p.why !== null,
      `missing why`
    );
    assert(
      `${p.playerName} why.window defined`,
      typeof p.why?.window === "string",
      `got ${p.why?.window}`
    );
    assert(
      `${p.playerName} direction valid`,
      ["BUY_LOW", "SELL_HIGH", "NEUTRAL"].includes(p.delta.direction),
      `got ${p.delta.direction}`
    );
    assert(
      `${p.playerName} no NaN in delta`,
      !isNaN(p.delta.rankZ) && !isNaN(p.delta.displayPct),
      `rankZ=${p.delta.rankZ} pct=${p.delta.displayPct}`
    );
  }

  const lowConfBuyLows = sorted.filter(
    (p: any) => p.confidence === "LOW" && p.delta.direction === "BUY_LOW" && Math.abs(p.delta.rankZ) < 1
  );
  assert(
    "no LOW-confidence pct-only BUY_LOW labels",
    lowConfBuyLows.length === 0,
    `found ${lowConfBuyLows.length} suspect labels`
  );
}

async function main() {
  console.log("=== FIRE + Delta Integration Sanity Test ===");

  const testWeeks = [10, 14, 17];
  const season = 2025;

  for (const week of testWeeks) {
    await testFireBatch(season, week);
    await testDeltaBatch(season, week);
  }

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
