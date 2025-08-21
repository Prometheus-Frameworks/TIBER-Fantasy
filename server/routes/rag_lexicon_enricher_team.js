// rag_lexicon_enricher_team.js
// Enricher that combines: base lexicon + player synonyms + team-level synonyms.
// API matches rag_lexicon.js: loadLexicon/loadSynonyms/loadTeamSynonyms/enrichText.

import fs from 'fs';

let LEX = null;
let SYN = null;
let TEAM_SYN = null;

export function loadLexicon(path = process.env.FF_LEXICON_PATH || './fantasy_lexicon.v1.json') {
  try {
    LEX = JSON.parse(fs.readFileSync(path, 'utf-8'));
    console.log(`✅ Lexicon loaded: ${Object.keys(LEX).length} categories`);
    return true;
  } catch (e) {
    console.warn('❌ Lexicon load failed:', e.message);
    LEX = null;
    return false;
  }
}

export function loadSynonyms(path = process.env.FF_SYNONYMS_PATH || './fantasy_synonyms.v1.json') {
  try {
    SYN = JSON.parse(fs.readFileSync(path, 'utf-8'));
    console.log(`✅ Player synonyms loaded: ${Object.keys(SYN).length} mappings`);
    return true;
  } catch (e) {
    console.warn('❌ Player synonyms load failed:', e.message);
    SYN = null;
    return false;
  }
}

export function loadTeamSynonyms(path = process.env.FF_TEAM_SYNONYMS_PATH || './team_synonyms.v1.json') {
  try {
    TEAM_SYN = JSON.parse(fs.readFileSync(path, 'utf-8'));
    console.log(`✅ Team synonyms loaded: ${Object.keys(TEAM_SYN).length} mappings`);
    return true;
  } catch (e) {
    console.warn('❌ Team synonyms load failed:', e.message);
    TEAM_SYN = null;
    return false;
  }
}

const norm = (s='') => s.toLowerCase();

function expandByMap(text, mapping) {
  let t = norm(text);
  if (!mapping) return t;
  for (const [canon, alts] of Object.entries(mapping)) {
    for (const alt of alts) {
      const needle = norm(alt);
      if (needle && t.includes(needle)) {
        t += ' ' + canon; // append canonical token to trigger lexicon hit
      }
    }
  }
  return t;
}

function expandText(text) {
  let t = norm(text);
  t = expandByMap(t, SYN);
  t = expandByMap(t, TEAM_SYN);

  // lightweight numeric/regex detectors for beat-speak:
  // targets, routes, snaps, red zone
  const detectors = [
    {re:/\b(\d+)\s*targets?\b/, canon:'target share', gloss:'Volume spike via targets; PPR floor support.', weight:2},
    {re:/\bran\s+(\d+)\s*routes?\b|\broute (rate|participation)\b/, canon:'route participation', gloss:'High route rate implies steady opportunity.', weight:2},
    {re:/\b(\d{1,3})%\s*snaps?\b/, canon:'snap share', gloss:'Usage share suggests stable role.', weight:1},
    {re:/inside the\s*(5|five)|goal[- ]?line|green zone|red zone/, canon:'goal-line role', gloss:'Short-yardage/RZ usage boosts TD equity.', weight:3},
    {re:/hamstring|soft[- ]?tissue/, canon:'hamstring', gloss:'Soft-tissue risk; volatility on return.', weight:-3},
    {re:/high[- ]?ankle/, canon:'high-ankle', gloss:'Explosiveness lags post-return; downgrade.', weight:-3},
  ];

  for (const d of detectors) {
    if (d.re.test(t)) {
      t += ' ' + d.canon;
    }
  }
  return t;
}

function scan(text) {
  if (!LEX) return { bullets: [], score: 0 };
  const expanded = expandText(text);
  const hits = [];
  let score = 0;

  const pushHit = (entry) => {
    hits.push(`• ${entry.gloss} (${entry.phrase})`);
    score += (entry.weight || 0);
  };

  const visit = (arr) => {
    for (const e of arr) {
      if (!e?.phrase) continue;
      if (expanded.includes(norm(e.phrase))) pushHit(e);
    }
  };

  Object.values(LEX).forEach(visit);

  // dedupe while preserving order
  const seen = new Set();
  const bullets = hits.filter(b => (seen.has(b) ? false : (seen.add(b), true))).slice(0, 6);
  return { bullets, score };
}

export function enrichText(baseBody, articleBlob='') {
  const { bullets, score } = scan(articleBlob);
  console.log(`🔍 Enhanced team-aware lexicon scan: ${bullets.length} matches, score: ${score}`);
  if (!bullets.length) return { text: baseBody, delta: 0 };
  const add = ['— Fantasy framing —', ...bullets].join('\n');
  return { text: `${baseBody}\n${add}`, delta: score };
}