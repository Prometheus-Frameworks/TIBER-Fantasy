/**
 * TIBER BRAIN OS v1 Embedding Script
 * 
 * Embeds the Brain OS philosophy document into the RAG chunks table
 * with special priority metadata for retrieval.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '../infra/db';
import { chunks } from '@shared/schema';
import { generateEmbedding } from '../services/geminiEmbeddings';
import { sql as sqlTag } from 'drizzle-orm';

const BRAIN_OS_PATH = join(process.cwd(), 'knowledge', 'core', 'tiber-brain-os-v1.md');

interface BrainOSChunk {
  content: string;
  section: string;
  priority: number;
}

/**
 * Parse Brain OS document into logical chunks
 */
function parseBrainOS(content: string): BrainOSChunk[] {
  const chunks: BrainOSChunk[] = [];
  
  // Split by section headers
  const sections = content.split(/={3,}/);
  
  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed || trimmed.length < 50) continue;
    
    // Detect section type
    const sectionName = trimmed.split('\n')[0].trim();
    
    // Determine priority based on section
    let priority = 1;
    if (sectionName.includes('10 COMMANDMENTS')) {
      priority = 5; // Highest priority - core rules
    } else if (sectionName.includes('THREE VOICES')) {
      priority = 4; // Voice guidance
    } else if (sectionName.includes('METRICS PHILOSOPHY')) {
      priority = 3; // Metrics translation
    } else if (sectionName.includes('INTERNAL DEFINITIONS')) {
      priority = 2; // Definitions
    }
    
    // For 10 Commandments, also create individual chunks per rule
    if (sectionName.includes('10 COMMANDMENTS')) {
      const rules = trimmed.split(/\n\d+\)/).filter(r => r.trim().length > 20);
      rules.forEach((rule, idx) => {
        if (idx === 0) return; // Skip header
        chunks.push({
          content: rule.trim(),
          section: `Commandment ${idx}`,
          priority: 5,
        });
      });
    }
    
    // Add full section as chunk
    chunks.push({
      content: trimmed,
      section: sectionName,
      priority,
    });
  }
  
  return chunks;
}

/**
 * Embed and store Brain OS chunks
 */
async function embedBrainOS() {
  console.log('📖 [Brain OS] Reading Brain OS document...');
  const content = readFileSync(BRAIN_OS_PATH, 'utf-8');
  
  console.log('📝 [Brain OS] Parsing into chunks...');
  const brainOSChunks = parseBrainOS(content);
  console.log(`✅ [Brain OS] Parsed ${brainOSChunks.length} chunks`);
  
  // Delete existing Brain OS chunks
  console.log('🗑️  [Brain OS] Removing old Brain OS chunks...');
  await db.execute(
    sqlTag`DELETE FROM chunks WHERE metadata->>'doc_id' = 'tiber-brain-os-v1'`
  );
  
  console.log('🔮 [Brain OS] Embedding chunks...');
  let embedded = 0;
  
  for (const chunk of brainOSChunks) {
    try {
      const embedding = await generateEmbedding(chunk.content);
      const vectorString = `[${embedding.join(',')}]`;
      
      const metadata = {
        doc_id: 'tiber-brain-os-v1',
        type: 'philosophy',
        section: chunk.section,
        priority: chunk.priority,
        teaches: 'core_os_rules',
        confidence: 'high',
        epistemic_status: 'validated_pattern',
        source: 'tiber_core_philosophy',
        tags: ['philosophy', 'brain_os', 'strategy', 'decision_making'],
        note: 'TIBER BRAIN OS v1 - Universal fantasy philosophy (redraft + dynasty)',
      };
      
      // Use raw SQL to handle vector type properly
      await db.execute(
        sqlTag`INSERT INTO chunks (content, embedding, metadata) 
               VALUES (${chunk.content}, ${vectorString}::vector, ${JSON.stringify(metadata)}::jsonb)`
      );
      
      embedded++;
      console.log(`  ✅ Embedded chunk ${embedded}/${brainOSChunks.length}: ${chunk.section}`);
    } catch (error) {
      console.error(`  ❌ Failed to embed chunk: ${chunk.section}`, error);
    }
  }
  
  console.log(`\n🎉 [Brain OS] Successfully embedded ${embedded} chunks!`);
  console.log('📊 [Brain OS] Priority distribution:');
  console.log(`   - Priority 5 (Commandments): ${brainOSChunks.filter(c => c.priority === 5).length}`);
  console.log(`   - Priority 4 (Voices): ${brainOSChunks.filter(c => c.priority === 4).length}`);
  console.log(`   - Priority 3 (Metrics): ${brainOSChunks.filter(c => c.priority === 3).length}`);
  console.log(`   - Priority 2 (Definitions): ${brainOSChunks.filter(c => c.priority === 2).length}`);
  console.log(`   - Priority 1 (Other): ${brainOSChunks.filter(c => c.priority === 1).length}`);
}

// Run the script
embedBrainOS()
  .then(() => {
    console.log('\n✅ Brain OS embedding complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Brain OS embedding failed:', error);
    process.exit(1);
  });
