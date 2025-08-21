# Team Context Lexicon Cross‑Ref

## Files
- team_synonyms.v1.json — beat phrases → canonical fantasy concepts (neutral pass rate, pace, OL quality, DST pressure, defense strength, special teams)
- rag_lexicon_enricher_team.js — enricher that merges base lexicon + player synonyms + team synonyms and regex detectors.

## Wire‑in (Node inline RAG)
```js
import { loadLexicon, loadSynonyms, loadTeamSynonyms, enrichText } from "./rag_lexicon_enricher_team.js";

// Boot
loadLexicon(process.env.FF_LEXICON_PATH || "./fantasy_lexicon.v1.json");
loadSynonyms(process.env.FF_SYNONYMS_PATH || "./fantasy_synonyms.v1.json");
loadTeamSynonyms(process.env.FF_TEAM_SYNONYMS_PATH || "./team_synonyms.v1.json");
```

`synthTake()` stays the same: call `enrichText(baseBody, blob)` and clamp confidence delta ±5.
