import { callLLM } from "../llm/index";
import fs from "fs";
import path from "path";

export type IntelSignal = "strong" | "moderate" | "speculative";
export type IntelCategory = "injury" | "trend" | "breakout" | "consensus" | "usage" | "trade" | "depth_chart";

export interface XIntelEntry {
  id: string;
  player: string;
  position: string;
  team: string;
  category: IntelCategory;
  signal: IntelSignal;
  headline: string;
  detail: string;
  source_context: string;
  fantasy_impact: string;
  dynasty_relevance: string;
  timestamp: string;
  scanned_by: string;
}

export interface ScanResult {
  success: boolean;
  entries: XIntelEntry[];
  model: string;
  provider: string;
  latencyMs: number;
  scanType: string;
  error?: string;
}

const INTEL_FILE = path.join(process.cwd(), "data", "current_intel.json");

function ensureDataDir(): void {
  const dir = path.dirname(INTEL_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function buildScanPrompt(scanType: string, focusPlayers?: string[], positions?: string[]): string {
  const positionFilter = positions?.length
    ? `Focus specifically on these positions: ${positions.join(", ")}.`
    : "Cover all skill positions: QB, RB, WR, TE.";

  const playerFilter = focusPlayers?.length
    ? `Pay special attention to these players: ${focusPlayers.join(", ")}.`
    : "";

  const scanInstructions: Record<string, string> = {
    trending: `Identify the most discussed NFL fantasy football players and narratives trending on X/Twitter right now. Look for volume spikes in mentions, beat reporter consensus shifts, and emerging storylines.`,
    injuries: `Scan X/Twitter for the latest NFL injury updates, practice participation reports, and return-to-play timelines. Focus on information from beat reporters, team insiders, and official team accounts.`,
    breakouts: `Identify potential breakout candidates being discussed on X/Twitter — players whose usage, target share, snap counts, or opportunity is shifting upward. Look for beat reporter observations from practice, depth chart changes, and emerging role changes.`,
    consensus: `Analyze the fantasy football community consensus on X/Twitter. Identify which players are being universally recommended as starts/sits, which names keep appearing in waiver discussions, and where expert opinions are converging or diverging.`,
    full: `Perform a comprehensive scan of NFL fantasy football discussion on X/Twitter. Cover all of the following:
1. Trending players and narratives
2. Injury updates and practice reports
3. Breakout candidates and role changes
4. Community consensus on starts, sits, and waiver targets
5. Trade rumors or depth chart shifts impacting fantasy value`,
  };

  const instruction = scanInstructions[scanType] || scanInstructions.full;

  return `You are TIBER's X Intelligence Scanner — an expert NFL fantasy football analyst monitoring X/Twitter for actionable intelligence.

${instruction}

${positionFilter}
${playerFilter}

CRITICAL RULES:
- Only report intel that would plausibly be discussed on X/Twitter by NFL beat reporters, fantasy analysts, and insiders
- Distinguish between confirmed reports (strong signal) and speculation (speculative signal)
- Every entry must have clear fantasy football relevance
- Include dynasty-specific relevance where applicable
- Be specific about player names, teams, and positions
- Do NOT fabricate specific tweets or attribute quotes to specific accounts

Respond ONLY with a valid JSON array of objects. Each object must have exactly these fields:
{
  "player": "Full Player Name",
  "position": "QB|RB|WR|TE",
  "team": "Team abbreviation (e.g., KC, BUF)",
  "category": "injury|trend|breakout|consensus|usage|trade|depth_chart",
  "signal": "strong|moderate|speculative",
  "headline": "One-line summary (max 15 words)",
  "detail": "2-3 sentence explanation of what's being discussed",
  "source_context": "Type of sources (e.g., 'Beat reporters', 'Fantasy analysts', 'Team insiders')",
  "fantasy_impact": "Specific actionable fantasy takeaway",
  "dynasty_relevance": "Dynasty-specific angle or 'N/A' if redraft-only"
}

Return 8-12 intel entries covering a mix of categories. Respond with ONLY the JSON array, no other text.`;
}

function parseGrokResponse(content: string): XIntelEntry[] {
  let cleaned = content.trim();
  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("No JSON array found in response");
  }
  cleaned = jsonMatch[0];

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) {
    throw new Error("Response is not an array");
  }

  const validCategories: IntelCategory[] = ["injury", "trend", "breakout", "consensus", "usage", "trade", "depth_chart"];
  const validSignals: IntelSignal[] = ["strong", "moderate", "speculative"];

  return parsed
    .filter((item: any) => item.player && item.position && item.headline)
    .map((item: any, idx: number) => ({
      id: `xscan_${Date.now()}_${idx}`,
      player: String(item.player),
      position: String(item.position).toUpperCase(),
      team: String(item.team || "UNK").toUpperCase(),
      category: validCategories.includes(item.category) ? item.category : "trend",
      signal: validSignals.includes(item.signal) ? item.signal : "moderate",
      headline: String(item.headline),
      detail: String(item.detail || ""),
      source_context: String(item.source_context || "X/Twitter"),
      fantasy_impact: String(item.fantasy_impact || ""),
      dynasty_relevance: String(item.dynasty_relevance || "N/A"),
      timestamp: new Date().toISOString(),
      scanned_by: "grok-x-scanner",
    }));
}

export async function scanXIntelligence(options: {
  scanType?: string;
  focusPlayers?: string[];
  positions?: string[];
  priority?: "speed" | "balanced" | "accuracy";
}): Promise<ScanResult> {
  const {
    scanType = "full",
    focusPlayers,
    positions,
    priority = "balanced",
  } = options;

  const prompt = buildScanPrompt(scanType, focusPlayers, positions);

  try {
    const response = await callLLM({
      taskType: "x_intelligence",
      priority,
      purpose: `x_scan_${scanType}`,
      messages: [
        {
          role: "system",
          content: "You are a structured data extraction system. You must respond with ONLY valid JSON. No markdown, no commentary, no code blocks.",
        },
        { role: "user", content: prompt },
      ],
      maxTokens: 4000,
      temperature: 0.4,
      timeoutMs: 60000,
    });

    const entries = parseGrokResponse(response.content);

    return {
      success: true,
      entries,
      model: response.model,
      provider: response.provider,
      latencyMs: response.latencyMs,
      scanType,
    };
  } catch (error: any) {
    return {
      success: false,
      entries: [],
      model: "unknown",
      provider: "unknown",
      latencyMs: 0,
      scanType,
      error: error.message || "Unknown error during X scan",
    };
  }
}

export function saveIntelEntries(entries: XIntelEntry[]): { saved: number; total: number } {
  ensureDataDir();

  let existing: any[] = [];
  if (fs.existsSync(INTEL_FILE)) {
    try {
      existing = JSON.parse(fs.readFileSync(INTEL_FILE, "utf-8"));
    } catch {
      existing = [];
    }
  }

  const merged = [...existing, ...entries];
  fs.writeFileSync(INTEL_FILE, JSON.stringify(merged, null, 2));

  return { saved: entries.length, total: merged.length };
}

export function getIntelEntries(filters?: {
  player?: string;
  position?: string;
  category?: string;
  signal?: string;
  source?: string;
  limit?: number;
}): XIntelEntry[] {
  if (!fs.existsSync(INTEL_FILE)) return [];

  let entries: XIntelEntry[];
  try {
    entries = JSON.parse(fs.readFileSync(INTEL_FILE, "utf-8"));
  } catch {
    return [];
  }

  const grokEntries = entries.filter((e: any) => e.scanned_by === "grok-x-scanner");

  let results = grokEntries;

  if (filters?.player) {
    const q = filters.player.toLowerCase();
    results = results.filter((e) => e.player.toLowerCase().includes(q));
  }
  if (filters?.position) {
    results = results.filter((e) => e.position.toUpperCase() === filters.position!.toUpperCase());
  }
  if (filters?.category) {
    results = results.filter((e) => e.category === filters.category);
  }
  if (filters?.signal) {
    results = results.filter((e) => e.signal === filters.signal);
  }
  if (filters?.limit) {
    results = results.slice(-filters.limit);
  }

  return results;
}

export function clearGrokIntel(): { cleared: number } {
  if (!fs.existsSync(INTEL_FILE)) return { cleared: 0 };

  let entries: any[];
  try {
    entries = JSON.parse(fs.readFileSync(INTEL_FILE, "utf-8"));
  } catch {
    return { cleared: 0 };
  }

  const nonGrok = entries.filter((e: any) => e.scanned_by !== "grok-x-scanner");
  const cleared = entries.length - nonGrok.length;
  fs.writeFileSync(INTEL_FILE, JSON.stringify(nonGrok, null, 2));
  return { cleared };
}
