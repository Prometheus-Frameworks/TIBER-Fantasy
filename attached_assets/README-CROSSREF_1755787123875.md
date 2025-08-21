# Cross-Reference Terminology Pack
Files:
- fantasy_synonyms.v1.json — maps beat reporter phrases -> canonical fantasy terms
- rag_lexicon_enricher.js — drop-in replacement for rag_lexicon.js with synonym & regex detection

Wire-in:
1) Replace: `import { loadLexicon, enrichText } from "./rag_lexicon.js";`
   With:     `import { loadLexicon, loadSynonyms, enrichText } from "./rag_lexicon_enricher.js";`

2) On boot:
   `loadLexicon(process.env.FF_LEXICON_PATH || "./fantasy_lexicon.v1.json");`
   `loadSynonyms(process.env.FF_SYNONYMS_PATH || "./fantasy_synonyms.v1.json");`

3) Keep your synthTake patch the same; enrichText signature unchanged.
