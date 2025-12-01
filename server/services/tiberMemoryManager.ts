import { db } from "../infra/db";
import { tiberConversations, tiberMessages, tiberMemorySnapshots } from "@shared/schema";
import { eq, and, desc, or, isNull } from "drizzle-orm";

export type Sender = "USER" | "TIBER";
export type ConversationMode = "FANTASY" | "GENERAL";

export interface TiberMessageData {
  sender: Sender;
  content: string;
  createdAt: Date;
}

export interface TiberContext {
  conversationId: string;
  recentMessages: TiberMessageData[];
  memorySummaries: {
    global?: string;
    league?: string;
    session?: string;
    facts?: Record<string, any>;
    mode?: ConversationMode;
  };
}

export const TiberMemoryManager = {
  async getOrCreateConversation(
    userId: string, 
    leagueId?: string | null, 
    mode: ConversationMode = "GENERAL"
  ): Promise<string> {
    const [conversation] = await db
      .insert(tiberConversations)
      .values({
        userId,
        leagueId: leagueId || null,
        title: mode === "FANTASY" ? "Fantasy Analysis" : "New Conversation",
        mode,
      })
      .returning({ id: tiberConversations.id });

    return conversation.id;
  },

  async getConversationById(conversationId: string) {
    const [conversation] = await db
      .select()
      .from(tiberConversations)
      .where(eq(tiberConversations.id, conversationId))
      .limit(1);

    return conversation || null;
  },

  async appendMessage(conversationId: string, sender: Sender, content: string): Promise<void> {
    await db.insert(tiberMessages).values({
      conversationId,
      sender,
      content,
    });
  },

  async getRecentMessages(conversationId: string, limit = 10): Promise<TiberMessageData[]> {
    const rows = await db
      .select()
      .from(tiberMessages)
      .where(eq(tiberMessages.conversationId, conversationId))
      .orderBy(desc(tiberMessages.createdAt))
      .limit(limit);

    return rows.reverse().map((r) => ({
      sender: r.sender as Sender,
      content: r.content,
      createdAt: r.createdAt,
    }));
  },

  async getMemorySnapshots(userId: string, leagueId?: string) {
    const rows = await db
      .select()
      .from(tiberMemorySnapshots)
      .where(
        and(
          eq(tiberMemorySnapshots.userId, userId),
          or(
            eq(tiberMemorySnapshots.leagueId, leagueId ?? ""), 
            isNull(tiberMemorySnapshots.leagueId)
          )
        )
      )
      .orderBy(desc(tiberMemorySnapshots.createdAt))
      .limit(10);

    const result: TiberContext["memorySummaries"] = {};

    for (const r of rows) {
      if (r.scope === "GLOBAL" && !result.global) result.global = r.summary ?? undefined;
      if (r.scope === "LEAGUE" && !result.league) result.league = r.summary ?? undefined;
      if (r.scope === "SESSION" && !result.session) result.session = r.summary ?? undefined;
      
      if (r.factsJson && !result.facts) {
        result.facts = r.factsJson as Record<string, any>;
      }
    }

    return result;
  },

  async buildContext(
    userId: string, 
    conversationId: string, 
    leagueId?: string | null,
    mode?: ConversationMode
  ): Promise<TiberContext> {
    const [recentMessages, memorySummaries] = await Promise.all([
      this.getRecentMessages(conversationId),
      this.getMemorySnapshots(userId, leagueId ?? undefined),
    ]);

    return {
      conversationId,
      recentMessages,
      memorySummaries: {
        ...memorySummaries,
        mode: mode || "GENERAL",
      },
    };
  },

  async saveMemorySnapshot(
    userId: string, 
    scope: 'GLOBAL' | 'LEAGUE' | 'SESSION',
    summary: string,
    facts?: Record<string, any>,
    leagueId?: string
  ): Promise<void> {
    await db.insert(tiberMemorySnapshots).values({
      userId,
      leagueId: leagueId || null,
      scope,
      summary,
      factsJson: facts || null,
    });
  },
};
