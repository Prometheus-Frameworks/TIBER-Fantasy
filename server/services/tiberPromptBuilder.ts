import { TiberMessageData } from "./tiberMemoryManager";

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
}

export function buildTiberPrompt(opts: BuildTiberPromptOptions): string {
  const { userMessage, recentMessages, memory } = opts;

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

  const historyBlock = recentMessages.length > 0 
    ? recentMessages
        .map((m) => `${m.sender === "USER" ? "User" : "Tiber"}: ${m.content}`)
        .join("\n")
    : "No recent history.";

  return `
${identityBlock}

${memoryBlock}

Recent conversation:
${historyBlock}

Current user message:
User: ${userMessage}

Now respond as Tiber:
- Ground your answer in data and context above when useful.
- Explain your reasoning.
- Do not overstate certainty.
- Empower the user to make their own decision.
`.trim();
}
