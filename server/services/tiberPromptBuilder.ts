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
- You avoid manipulation, fear-mongering, and overconfident claims.`;

  const memoryBlock = `
Known user context:
- Global: ${memory.global ?? "n/a"}
- League: ${memory.league ?? "n/a"}
- Session: ${memory.session ?? "n/a"}
- Facts: ${memory.facts ? JSON.stringify(memory.facts) : "n/a"}
`.trim();

  // Build ForgeContext block if provided and non-empty
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

Recent conversation:
${historyBlock}

Current user message:
User: ${userMessage}

Now respond as Tiber:
- Ground your answer in the FORGE data above when available and relevant.
- Explain your reasoning step by step.
- Do not overstate certainty.
- Empower the user to make their own decision.
`.trim();
}

/**
 * Build a human-readable ForgeContext block for the prompt.
 * If no context is provided or it's empty, returns a simple note.
 */
function buildForgeContextBlock(forgeContext?: ForgeContext): string {
  if (!forgeContext || (!forgeContext.player && !forgeContext.rankingsSnapshot)) {
    return 'FORGE live context: (none provided for this turn)';
  }

  const sections: string[] = ['FORGE live context (from backend APIs):'];

  // Add player context if present
  if (forgeContext.player) {
    const p = forgeContext.player;
    sections.push(`
Player: ${p.name} (${p.position}, ${p.team})
- FORGE Alpha: ${p.alpha} (SoS-adjusted)${p.alphaBase ? ` | Base: ${p.alphaBase}` : ''}
- Subscores: Volume=${p.subscores?.volume ?? 'n/a'}, Efficiency=${p.subscores?.efficiency ?? 'n/a'}, Stability=${p.subscores?.stability ?? 'n/a'}, ContextFit=${p.subscores?.contextFit ?? 'n/a'}
- SoS: RoS=${p.sosRos ?? 'n/a'}, Next3=${p.sosNext3 ?? 'n/a'}, Playoffs=${p.sosPlayoffs ?? 'n/a'}${p.sosMultiplier ? ` | Multiplier=${p.sosMultiplier}` : ''}`);
  }

  // Add rankings snapshot if present
  if (forgeContext.rankingsSnapshot) {
    const rs = forgeContext.rankingsSnapshot;
    sections.push(`
${rs.position} Rankings Snapshot (Top ${rs.players.length}):
${rs.players.map((p, i) => `  ${i + 1}. ${p.name} (${p.team}) - Alpha: ${p.alpha}${p.sosMultiplier ? ` [SoS: ${p.sosMultiplier}]` : ''}`).join('\n')}`);
  }

  return sections.join('\n');
}
