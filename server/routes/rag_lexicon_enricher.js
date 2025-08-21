// rag_lexicon_enricher.js — v1.1
// Extends the simple lexicon enricher with:
//  - synonym cross-referencing (beat terms -> canonical fantasy phrases)
//  - numeric detectors (targets, red-zone, routes, snaps) via regex
// Usage:
//   import { loadLexicon, loadSynonyms, enrichText } from "./rag_lexicon_enricher.js";

import fs from "fs";

let LEX = null;
let SYN = null;

export function loadLexicon(path = process.env.FF_LEXICON_PATH || "./fantasy_lexicon.v1.json") {
  try {
    LEX = JSON.parse(fs.readFileSync(path, "utf-8"));
    console.log(`✅ Lexicon loaded: ${Object.keys(LEX).length} categories`);
    return true;
  } catch (e) {
    console.warn("❌ Lexicon load failed:", e.message);
    LEX = null;
    return false;
  }
}

export function loadSynonyms(path = process.env.FF_SYNONYMS_PATH || "./fantasy_synonyms.v1.json") {
  try {
    SYN = JSON.parse(fs.readFileSync(path, "utf-8"));
    console.log(`✅ Synonyms loaded: ${Object.keys(SYN).length} mappings`);
    return true;
  } catch (e) {
    console.warn("❌ Synonyms load failed:", e.message);
    SYN = null;
    return false;
  }
}

const norm = (s="") => s.toLowerCase();

// Regex detectors that imply fantasy concepts even when exact phrases are missing.
const detectors = [
  // targets
  { name: "target share", weight: 2, gloss: "Sustained target volume fuels weekly floor in PPR.", re: /\b(\d+)\s*targets?\b/ },
  // red zone / end zone
  { name: "red zone targets", weight: 3, gloss: "Red-zone looks translate to touchdown equity.", re: /\b(red[- ]?zone|inside the 20)\b/ },
  { name: "end-zone targets", weight: 3, gloss: "End-zone looks are the strongest TD signal.", re: /\bend[- ]?zone look|\bthrown to in the end zone\b/ },
  // routes & snaps
  { name: "route participation", weight: 2, gloss: "High route rate = strong passing-game role.", re: /\bran (\d+)\s*routes?|\broute rate\b|\broutes per dropback\b/ },
  { name: "snap share", weight: 2, gloss: "Heavy snaps imply bankable role/usage.", re: /\b(\d+)%\s*snaps?|\bsnap share\b/ },
  // goal line
  { name: "goal-line role", weight: 3, gloss: "Carries inside the five boost TD odds.", re: /\binside the (?:5|five)|\bgoal[- ]?line\b|\bgreen zone\b/ },
  // committee
  { name: "committee", weight: -2, gloss: "Timeshare caps ceiling unless efficiency spikes.", re: /\bcommittee|\btimeshare|\brotation\b/ },
  // injury shorthand
  { name: "hamstring", weight: -3, gloss: "Soft-tissue risk; volatility early on.", re: /\bhamstring|soft[- ]?tissue|hammy\b/ },
  { name: "high-ankle", weight: -3, gloss: "Explosiveness lags for weeks after return.", re: /\bhigh[- ]?ankle\b/ },
  { name: "concussion protocol", weight: -2, gloss: "Uncertain timeline even after clearance.", re: /\bconcussion protocol\b/ },
  { name: "limited participant", weight: -1, gloss: "Monitor Friday report for workload clarity.", re: /\blimited (?:participant|practice)|\bLP\b/ },
  { name: "full participant", weight: 1, gloss: "Workload likely normal barring setbacks.", re: /\bfull (?:participant|practice)|\bFP\b|removed from injury report/ },
  // depth chart "with the ones"
  { name: "depth chart clarity", weight: 2, gloss: "First-team reps = role security.", re: /\bwith the ones|\bfirst[- ]team reps|\brunning with starters\b/ },
  // designed runs
  { name: "designed runs", weight: 3, gloss: "QB rushing adds stable weekly floor.", re: /\bread[- ]?option|zone read|qb draw|designed qb runs\b/ },
];

function expandWithSynonyms(text) {
  if (!SYN) return text;
  let out = text;
  const t = norm(text);
  // For each canonical phrase, if any synonym appears, append the canonical phrase once to help matching
  for (const [canonical, alts] of Object.entries(SYN)) {
    for (const alt of alts) {
      const needle = norm(alt);
      if (needle && t.includes(needle)) {
        out += ` ${canonical}`; // inject canonical token for downstream simple match
        break;
      }
    }
  }
  return out;
}

function scan(text) {
  const t0 = norm(text || "");
  const t = expandWithSynonyms(t0);
  const hits = [];
  let score = 0;

  // 1) Exact lexicon phrases
  if (LEX) {
    const visit = (arr) => {
      for (const e of arr) {
        const phrase = norm(e?.phrase || "");
        if (phrase && t.includes(phrase)) {
          hits.push({ gloss: e.gloss, phrase: e.phrase, weight: e.weight || 0 });
          score += (e.weight || 0);
        }
      }
    };
    Object.values(LEX).forEach(visit);
  }

  // 2) Regex detectors
  for (const d of detectors) {
    if (d.re.test(t)) {
      hits.push({ gloss: d.gloss, phrase: d.name, weight: d.weight });
      score += d.weight;
    }
  }

  // Format bullets (dedupe)
  const seen = new Set();
  const bullets = [];
  for (const h of hits) {
    const line = `• ${h.gloss} (${h.phrase})`;
    if (!seen.has(line)) {
      bullets.push(line);
      seen.add(line);
    }
    if (bullets.length >= 6) break;
  }
  return { bullets, score };
}

export function enrichText(baseBody, articleBlob = "") {
  const { bullets, score } = scan(articleBlob);
  console.log(`🔍 Enhanced lexicon scan: ${bullets.length} matches, score: ${score}`);
  if (!bullets.length) return { text: baseBody, delta: 0 };
  const add = ["— Fantasy framing —", ...bullets].join("\n");
  return { text: `${baseBody}\n${add}`, delta: score };
}