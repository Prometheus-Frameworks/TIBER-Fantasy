#!/usr/bin/env tsx

const baseUrl = process.env.FANTASY_LAB_BASE_URL || 'http://127.0.0.1:5000';
const season = Number(process.argv[2] || 2025);
const week = Number(process.argv[3] || 14);
const position = (process.argv[4] || 'WR').toUpperCase();

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function getJson(path: string) {
  const resp = await fetch(`${baseUrl}${path}`);
  if (!resp.ok) throw new Error(`${path} failed (${resp.status})`);
  return resp.json();
}

async function main() {
  console.log(`🔎 Phase 3 smoke checks @ ${baseUrl}`);

  const delta = await getJson(`/api/delta/eg/batch?season=${season}&week=${week}&position=${position}&limit=150`);
  const rows = (delta?.data || []) as any[];
  assert(Array.isArray(rows) && rows.length > 0, 'delta returned no rows');

  for (const row of rows) {
    assert(['RB', 'WR', 'TE'].includes(row.position), `invalid position: ${row.position}`);
    assert(Number.isFinite(row?.delta?.rankZ), `rankZ invalid for ${row.playerId}`);
    assert(Number.isFinite(row?.delta?.displayPct), `displayPct invalid for ${row.playerId}`);
    assert(row.delta.displayPct >= -100 && row.delta.displayPct <= 100, `displayPct out of range for ${row.playerId}`);
    assert(['HIGH', 'MED', 'LOW'].includes(row.confidence), `confidence invalid for ${row.playerId}`);
    const pctBuy = row.delta.displayPct >= 20;
    const pctSell = row.delta.displayPct <= -20;
    const zBuy = row.delta.rankZ >= 1;
    const zSell = row.delta.rankZ <= -1;
    if (row.confidence === 'LOW') {
      assert(!(pctBuy && !zBuy && row.delta.direction === 'BUY_LOW'), `LOW confidence percentile-only BUY_LOW for ${row.playerId}`);
      assert(!(pctSell && !zSell && row.delta.direction === 'SELL_HIGH'), `LOW confidence percentile-only SELL_HIGH for ${row.playerId}`);
    }
  }

  for (let i = 1; i < rows.length; i += 1) {
    const prev = Math.abs(rows[i - 1].delta.rankZ);
    const cur = Math.abs(rows[i].delta.rankZ);
    assert(prev >= cur, 'rows not sorted by abs(rankZ) desc by default');
  }

  const playerId = rows[0].playerId;
  const weekFrom = Math.max(1, week - 5);
  const trend = await getJson(`/api/delta/eg/player-trend?season=${season}&playerId=${playerId}&weekFrom=${weekFrom}&weekTo=${week}`);
  const trendRows = (trend?.data || []) as any[];

  for (let i = 1; i < trendRows.length; i += 1) {
    assert(trendRows[i - 1].weekAnchor <= trendRows[i].weekAnchor, 'trend weeks not ordered');
  }
  for (const tr of trendRows) {
    assert(Number.isFinite(tr.forgePct), 'trend forgePct not finite');
    assert(Number.isFinite(tr.firePct), 'trend firePct not finite');
    assert(Number.isFinite(tr.rankZ), 'trend rankZ not finite');
    assert(Number.isFinite(tr.displayPct), 'trend displayPct not finite');
    assert(['HIGH', 'MED', 'LOW'].includes(tr.confidence), 'trend confidence invalid');
  }

  console.log('✅ Phase 3 smoke checks passed');
}

main().catch((err) => {
  console.error('❌ Phase 3 smoke checks failed:', err.message);
  process.exit(1);
});
