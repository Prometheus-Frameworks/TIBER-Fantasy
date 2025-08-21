// rag_lexicon.js — enrich takes with fantasy vocabulary
// Usage in rag.router.js: import { loadLexicon, enrichText } from './rag_lexicon.js';

import fs from 'fs';

console.log('📚 Lexicon module loaded');

let LEX = null;
export function loadLexicon(path = process.env.FF_LEXICON_PATH || './fantasy_lexicon.v1.json') {
  try {
    const raw = fs.readFileSync(path, 'utf-8');
    LEX = JSON.parse(raw);
    console.log(`✅ Lexicon loaded: ${Object.keys(LEX).length} categories`);
    return true;
  } catch (e) {
    console.warn('❌ Lexicon load failed:', e.message);
    LEX = null;
    return false;
  }
}

const normalize = (s='') => s.toLowerCase();

function scan(text) {
  if (!LEX) return { bullets: [], score: 0 };
  const t = normalize(text);
  const hits = [];
  let score = 0;

  const pushHit = (entry) => {
    hits.push(`• ${entry.gloss} (${entry.phrase})`);
    score += (entry.weight || 0);
  };

  const visit = (arr) => {
    for (const e of arr) {
      if (!e?.phrase) continue;
      const needle = normalize(e.phrase);
      if (needle && t.includes(needle)) pushHit(e);
    }
  };

  Object.values(LEX).forEach(visit);
  // dedupe bullets while preserving order
  const seen = new Set();
  const bullets = hits.filter(b => (seen.has(b) ? false : (seen.add(b), true))).slice(0, 6);

  return { bullets, score };
}

export function enrichText(baseBody, articleBlob='') {
  const { bullets, score } = scan(articleBlob);
  console.log(`🔍 Lexicon scan: ${bullets.length} matches, score: ${score}`);
  if (!bullets.length) return { text: baseBody, delta: 0 };
  const add = ['— Fantasy framing —', ...bullets].join('\n');
  return { text: `${baseBody}\n${add}`, delta: score };
}