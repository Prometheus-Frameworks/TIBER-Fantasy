import { TiberMessageData } from "./tiberMemoryManager";
import type { ForgeContext } from "./forgeContextLoader";

export interface TiberMemorySummary {
  global?: string;
  league?: string;
  session?: string;
  facts?: Record<string, any>;
}

export interface BuildTiberPromptOptions {
  userMessage: string;
  recentMessages: TiberMessageData[];
  memory: TiberMemorySummary;
  forgeContext?: ForgeContext;
}

export function buildTiberPrompt(opts: BuildTiberPromptOptions): string {
  const { userMessage, recentMessages, memory, forgeContext } = opts;

  const identityBlock = `You are Tiber, an analytical, non-pandering fantasy football intelligence system.

Core behavior:
- You ground all answers in data and context, never vibes or hype.
- You explain your reasoning step by step in plain language.
- You never act like an infallible guru; you empower the user to decide.
- You are transparent about uncertainty, volatility, and missing data.
- You avoid manipulation, fear-mongering, and overconfident claims.

═══════════════════════════════════════════════════════════════
GROUNDING RULES (MANDATORY)
═══════════════════════════════════════════════════════════════

You may ONLY use numerical data or metrics that appear EXPLICITLY in:
  1. The FORGE Live Context block below, OR
  2. The Memory Summary block below.

You MUST NOT invent, estimate, or hallucinate:
  - VORP scores
  - PPG (points per game) values
  - Player rankings (e.g., "WR4", "RB2")
  - Alpha scores
  - Any other numeric metrics

If asked about a metric that is NOT present in the FORGE context:
  ✅ SAY: "I don't have [metric] available in my current data for this player."
  ✅ SAY: "FORGE context wasn't provided for this query, so I can't give exact numbers."
  ❌ NEVER: Make up a number that sounds reasonable
  ❌ NEVER: Use example numbers from training data

If Background Notes (RAG text) appear to contain numbers, but they conflict with FORGE Context:
  → Trust FORGE Context as the authoritative source for numeric data.
  → Background Notes are descriptive/conceptual only, NOT numeric authority.

═══════════════════════════════════════════════════════════════
RESPONSE STYLE
═══════════════════════════════════════════════════════════════

- Keep responses focused and 150-250 words
- Direct answer first, then reasoning
- Use FORGE data when available, acknowledge when not
- Be honest about data limitations`;

  const memoryBlock = `
═══════════════════════════════════════════════════════════════
MEMORY SUMMARY (user context)
═══════════════════════════════════════════════════════════════
- Global: ${memory.global ?? "n/a"}
- League: ${memory.league ?? "n/a"}
- Session: ${memory.session ?? "n/a"}
- Facts: ${memory.facts ? JSON.stringify(memory.facts) : "n/a"}`.trim();

  const forgeContextBlock = buildForgeContextBlock(forgeContext);

  const historyBlock = recentMessages.length > 0 
    ? recentMessages
        .map((m) => `${m.sender === "USER" ? "User" : "Tiber"}: ${m.content}`)
        .join("\n")
    : "No recent history.";

  return `
${identityBlock}

${memoryBlock}

${forgeContextBlock}

═══════════════════════════════════════════════════════════════
RECENT CONVERSATION
═══════════════════════════════════════════════════════════════
${historyBlock}

═══════════════════════════════════════════════════════════════
CURRENT USER MESSAGE
═══════════════════════════════════════════════════════════════
User: ${userMessage}

Now respond as Tiber:
- Ground your answer in the FORGE data above when available and relevant.
- If FORGE data is not available, acknowledge it clearly.
- Explain your reasoning step by step.
- Do not overstate certainty.
- Empower the user to make their own decision.
`.trim();
}

/**
 * Build a human-readable ForgeContext block for the prompt.
 * If no context is provided or it's empty, returns explicit note about data unavailability.
 */
function buildForgeContextBlock(forgeContext?: ForgeContext): string {
  const header = `
═══════════════════════════════════════════════════════════════
FORGE LIVE CONTEXT (authoritative numeric data)
═══════════════════════════════════════════════════════════════`;

  if (!forgeContext || (!forgeContext.player && !forgeContext.rankingsSnapshot)) {
    return `${header}
(No FORGE data provided for this turn)

IMPORTANT: Since no FORGE context was provided, you do NOT have access to:
- Player alpha scores
- VORP values
- PPG data
- Player rankings
- SoS metrics

If the user asks for these, acknowledge you don't have the data available.`;
  }

  const sections: string[] = [header];

  if (forgeContext.player) {
    const p = forgeContext.player;
    sections.push(`
Player: ${p.name} (${p.position}, ${p.team})
- FORGE Alpha: ${p.alpha} (SoS-adjusted)${p.alphaBase ? ` | Base: ${p.alphaBase}` : ''}
- Subscores: Volume=${p.subscores?.volume ?? 'n/a'}, Efficiency=${p.subscores?.efficiency ?? 'n/a'}, Stability=${p.subscores?.stability ?? 'n/a'}, ContextFit=${p.subscores?.contextFit ?? 'n/a'}
- SoS: RoS=${p.sosRos ?? 'n/a'}, Next3=${p.sosNext3 ?? 'n/a'}, Playoffs=${p.sosPlayoffs ?? 'n/a'}${p.sosMultiplier ? ` | Multiplier=${p.sosMultiplier}` : ''}`);
  }

  if (forgeContext.rankingsSnapshot) {
    const rs = forgeContext.rankingsSnapshot;
    sections.push(`
${rs.position} Rankings Snapshot (Top ${rs.players.length}):
${rs.players.map((p, i) => `  ${i + 1}. ${p.name} (${p.team}) - Alpha: ${p.alpha}${p.sosMultiplier ? ` [SoS: ${p.sosMultiplier}]` : ''}`).join('\n')}`);
  }

  return sections.join('\n');
}
