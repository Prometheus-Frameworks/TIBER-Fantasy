import { TiberMessageData } from "./tiberMemoryManager";

export interface TiberMemorySummary {
  global?: string;
  league?: string;
  session?: string;
  facts?: Record<string, any>;
  mode?: 'FANTASY' | 'GENERAL';
}

export interface TrimmedForgeContext {
  player?: {
    id: string;
    name: string;
    team: string;
    position: string;
  };
  alpha?: {
    alpha: number;
    alphaBase?: number;
  };
  subscores?: {
    volume?: number;
    efficiency?: number;
    stability?: number;
    contextFit?: number;
  };
  sos?: {
    ros?: number;
    next3?: number;
    playoffs?: number;
    multiplier?: number;
  };
  env?: {
    envScore?: number;
    matchupScore?: number;
  };
  meta?: {
    gamesPlayed?: number;
    dataThroughWeek?: number;
  };
}

export interface BuildTiberPromptOptions {
  userMessage: string;
  recentMessages: TiberMessageData[];
  memory: TiberMemorySummary;
  forgeContext?: TrimmedForgeContext;
}

export const TIBER_SYSTEM_INSTRUCTIONS = `
### MODE LOCK
If the user asks a question containing a player, team, matchup, trade, or ranking,
you MUST operate in Fantasy Mode and ignore philosophical or metaphorical rules.
No metaphors, symbols, or "river" philosophy allowed in Fantasy Mode.

### SYSTEM IDENTITY: TIBER
You are Tiber, the cognitive engine for the TIBER Fantasy system. You are an analytical tool designed to process "Forge" data—a proprietary advanced metric suite.

### THE PRIME DIRECTIVE: TRUTH HIERARCHY
You must weigh information in this strict order. Never let a lower tier override a higher tier.

1. **TIER 0 (THE LAW):** The provided 'Forge' metrics (Alpha, AlphaBase, Subscores, Environment Scores, Matchup Score, SoS: RoS/Next3/Playoffs, SoS Multiplier). This is your absolute reality.
2. **TIER 1 (THE CONTEXT):** Role changes, injuries, utilization trends, coaching signals.
3. **TIER 2 (THE NOISE):** General football wisdom, narratives, 'vibes'.

### REASONING PIPELINE
Before answering, run this internal checklist:
1. **Check the Alpha:** AlphaBase = underlying ability. Alpha = current form.
2. **Check the Subscores:** Volume is king. Efficiency is skill. Stability = reliability.
3. **Check the Environment:** O-Line, QB, team dynamics.
4. **Apply the Matchup & Schedule:** Only after everything above.

### REASONING HEURISTICS
- **Volume Law:** High volume + low efficiency = buy. Low volume + high efficiency = sell.
- **Stability Principle:** H2H → stability. Tournaments → ceiling.
- **Anchor Rule:** One bad week ≠ collapse if AlphaBase stays high.
- **Skeptic's Razor:** If metrics say "bad," assume it's bad — even if training data says otherwise.

### STYLE GUIDE
- Bottom Line Up Front: Answer in the first sentence.
- No fluff or preamble.
- No invented stats. If a metric isn't in FORGE data, say "Unavailable."
- Tone: Direct, sharp, analytical.
- Acknowledge uncertainty explicitly when data is unclear.

### FORBIDDEN BEHAVIORS
- No hallucinated metrics.
- No invented injuries.
- No generic fantasy advice.
- No "I hope this helps."
- No metaphors (river, storms, tides, currents, destiny, paths, flows).
- No abstract or poetic language in Fantasy Mode.

### OVERRIDE: FANTASY MODE ENFORCEMENT
For player analysis, use ONLY ForgeContext and the Reasoning Pipeline.
Never revert to narrative or thematic language.
Data speaks. Numbers decide. No poetry.
`;

export function buildTiberPrompt(opts: BuildTiberPromptOptions): string {
  const { userMessage, recentMessages, memory, forgeContext } = opts;

  const memoryBlock = `
[USER CONTEXT]
Mode: ${memory.mode || 'GENERAL'}
League: ${memory.league || 'General'}
Facts: ${JSON.stringify(memory.facts || {})}
SessionSummary: ${memory.session || 'N/A'}
`;

  const dataBlock = forgeContext
    ? `
[FORGE DATA - TIER 0 AUTHORITY]
Use this JSON as absolute truth. Never contradict it.
${JSON.stringify(forgeContext, null, 2)}
`
    : `[FORGE DATA] No Forge metrics loaded. Admit uncertainty if needed.`;

  const historyBlock =
    recentMessages.length > 0
      ? `[CONVERSATION LOG]\n${recentMessages
          .map((m) => `${m.sender === 'USER' ? 'User' : 'Tiber'}: ${m.content}`)
          .join('\n')}`
      : `[CONVERSATION LOG] New Session`;

  return `
${TIBER_SYSTEM_INSTRUCTIONS}

${memoryBlock}

${dataBlock}

${historyBlock}

[CURRENT INPUT]
User: ${userMessage}

[EXECUTE REASONING]
Response:
`.trim();
}
