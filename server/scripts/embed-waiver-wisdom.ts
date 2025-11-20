/**
 * Waiver Wisdom VORP Context Embedding Script
 * 
 * Embeds the Waiver Wisdom teaching document into the RAG chunks table
 * with high priority metadata for waiver-related queries.
 * 
 * TIBER WAIVER VORP PATCH v1.0
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '../infra/db';
import { generateEmbedding } from '../services/geminiEmbeddings';
import { sql as sqlTag } from 'drizzle-orm';

const WAIVER_WISDOM_PATH = join(process.cwd(), 'knowledge', 'core', 'waiver-wisdom-vorp-context.md');

interface WaiverChunk {
  content: string;
  section: string;
  priority: number;
}

/**
 * Parse Waiver Wisdom document into logical chunks
 */
function parseWaiverWisdom(content: string): WaiverChunk[] {
  const chunks: WaiverChunk[] = [];
  
  // Split by section headers (## headings)
  const sections = content.split(/##\s+/);
  
  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed || trimmed.length < 50) continue;
    
    // First line is the section name
    const sectionName = trimmed.split('\n')[0].trim();
    
    // Determine priority based on section
    let priority = 3; // Default: medium priority
    
    if (sectionName.includes('Core Insight') || sectionName.includes('Key Distinction')) {
      priority = 5; // Highest priority - core concept
    } else if (sectionName.includes('Priority Stack') || sectionName.includes('When to Use VORP')) {
      priority = 4; // High priority - decision framework
    } else if (sectionName.includes('Example') || sectionName.includes('Teaching Point')) {
      priority = 3; // Medium priority - examples
    }
    
    chunks.push({
      content: trimmed,
      section: sectionName,
      priority,
    });
  }
  
  return chunks;
}

/**
 * Embed and store Waiver Wisdom chunks
 */
async function embedWaiverWisdom() {
  console.log('📖 [Waiver Wisdom] Reading Waiver Wisdom document...');
  const content = readFileSync(WAIVER_WISDOM_PATH, 'utf-8');
  
  console.log('📝 [Waiver Wisdom] Parsing into chunks...');
  const waiverChunks = parseWaiverWisdom(content);
  console.log(`✅ [Waiver Wisdom] Parsed ${waiverChunks.length} chunks`);
  
  // Delete existing Waiver Wisdom chunks
  console.log('🗑️  [Waiver Wisdom] Removing old Waiver Wisdom chunks...');
  await db.execute(
    sqlTag`DELETE FROM chunks WHERE metadata->>'doc_id' = 'waiver-wisdom-vorp-context'`
  );
  
  console.log('🔮 [Waiver Wisdom] Embedding chunks...');
  let embedded = 0;
  
  for (const chunk of waiverChunks) {
    try {
      const embedding = await generateEmbedding(chunk.content);
      const vectorString = `[${embedding.join(',')}]`;
      
      const metadata = {
        doc_id: 'waiver-wisdom-vorp-context',
        type: 'teaching',
        section: chunk.section,
        priority: chunk.priority,
        teaches: 'waiver_evaluation',
        confidence: 'high',
        epistemic_status: 'validated_pattern',
        source: 'waiver_wisdom_module',
        tags: ['waiver', 'vorp', 'interest_score', 'decision_making', 'market_lag'],
        note: 'Waiver Wisdom - Why VORP fails for waiver decisions (VORP PATCH v1.0)',
      };
      
      // Use raw SQL to handle vector type properly
      await db.execute(
        sqlTag`INSERT INTO chunks (content, embedding, metadata) 
               VALUES (${chunk.content}, ${vectorString}::vector, ${JSON.stringify(metadata)}::jsonb)`
      );
      
      embedded++;
      console.log(`  ✅ Embedded chunk ${embedded}/${waiverChunks.length}: ${chunk.section}`);
    } catch (error) {
      console.error(`  ❌ Failed to embed chunk: ${chunk.section}`, error);
    }
  }
  
  console.log(`\n✅ [Waiver Wisdom] Successfully embedded ${embedded}/${waiverChunks.length} chunks`);
  console.log('🎯 [Waiver Wisdom] VORP PATCH v1.0 teaching context is now active in RAG system');
}

// Run the embedding
embedWaiverWisdom()
  .then(() => {
    console.log('✅ Waiver Wisdom embedding complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Waiver Wisdom embedding failed:', error);
    process.exit(1);
  });
