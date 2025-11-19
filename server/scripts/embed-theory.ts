/**
 * TIBER Deep Theory Modules Embedding Script
 * 
 * Embeds the 5 Deep Theory modules into the RAG chunks table
 * with special metadata for retrieval priority.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { db } from '../infra/db';
import { chunks } from '@shared/schema';
import { generateEmbedding } from '../services/geminiEmbeddings';
import { sql as sqlTag } from 'drizzle-orm';

const THEORY_DIR = join(process.cwd(), 'knowledge', 'theory');

interface TheoryChunk {
  content: string;
  module: string;
  section: string;
  priority: number;
}

/**
 * Parse theory module into logical chunks
 */
function parseTheoryModule(content: string, moduleName: string): TheoryChunk[] {
  const chunks: TheoryChunk[] = [];
  
  // Split by major section headers (## or ###)
  const sections = content.split(/\n#{2,3} /);
  
  for (let i = 1; i < sections.length; i++) {
    const section = sections[i].trim();
    if (!section || section.length < 100) continue;
    
    // Get section name (first line)
    const lines = section.split('\n');
    const sectionName = lines[0].trim();
    const sectionContent = lines.slice(1).join('\n').trim();
    
    // Skip metadata sections
    if (sectionName.includes('Module Metadata') || 
        sectionName.includes('END OF MODULE')) {
      continue;
    }
    
    // Determine priority based on section type
    let priority = 3; // Default medium priority for theory
    
    // Core concept sections get higher priority
    if (sectionName.includes('Core Concept') || 
        sectionName.includes('Key Decision Rules') ||
        sectionName.includes('Decision Rules') ||
        sectionName.includes('Decision Framework')) {
      priority = 4;
    }
    
    // Examples and edge cases get slightly lower priority
    if (sectionName.includes('Example') || 
        sectionName.includes('Edge Case') ||
        sectionName.includes('Common Mistake')) {
      priority = 3;
    }
    
    // TIBER voice examples get lowest theory priority
    if (sectionName.includes('TIBER Voice')) {
      priority = 2;
    }
    
    // Add chunk
    chunks.push({
      content: `## ${section}`,
      module: moduleName,
      section: sectionName,
      priority,
    });
  }
  
  return chunks;
}

/**
 * Get module category based on filename
 */
function getModuleCategory(filename: string): string {
  const categories: Record<string, string> = {
    'pressure.md': 'breakout_detection',
    'signal.md': 'noise_filtration',
    'entropy.md': 'aging_trajectory',
    'psychology.md': 'market_behavior',
    'ecosystem.md': 'system_analysis',
  };
  return categories[filename] || 'theory';
}

/**
 * Embed all theory modules
 */
async function embedTheory() {
  console.log('📚 [Theory] Reading theory modules...');
  
  const theoryFiles = readdirSync(THEORY_DIR).filter(f => f.endsWith('.md'));
  console.log(`✅ [Theory] Found ${theoryFiles.length} theory modules:`, theoryFiles);
  
  let allChunks: TheoryChunk[] = [];
  
  for (const file of theoryFiles) {
    const filePath = join(THEORY_DIR, file);
    const content = readFileSync(filePath, 'utf-8');
    const moduleName = file.replace('.md', '');
    
    console.log(`\n📝 [Theory] Parsing ${file}...`);
    const moduleChunks = parseTheoryModule(content, moduleName);
    console.log(`  ✅ Parsed ${moduleChunks.length} chunks from ${moduleName}`);
    
    allChunks = allChunks.concat(moduleChunks);
  }
  
  console.log(`\n✅ [Theory] Total chunks across all modules: ${allChunks.length}`);
  
  // Delete existing theory chunks
  console.log('🗑️  [Theory] Removing old theory chunks...');
  await db.execute(
    sqlTag`DELETE FROM chunks WHERE metadata->>'type' = 'theory'`
  );
  
  console.log('🔮 [Theory] Embedding chunks...');
  let embedded = 0;
  
  for (const chunk of allChunks) {
    try {
      const embedding = await generateEmbedding(chunk.content);
      const vectorString = `[${embedding.join(',')}]`;
      
      const metadata = {
        type: 'theory',
        module: chunk.module,
        section: chunk.section,
        priority: chunk.priority,
        layer_hint: 'teaching',
        content_type: 'THEORY',
        format_hint: 'both',
        category: getModuleCategory(`${chunk.module}.md`),
        source: 'deep_theory_modules',
        tags: ['deep_theory', 'teaching', chunk.module],
        epistemic_status: 'validated_framework',
        note: `TIBER Deep Theory - ${chunk.module} module`,
      };
      
      // Use raw SQL to handle vector type properly
      await db.execute(
        sqlTag`INSERT INTO chunks (content, embedding, metadata) 
               VALUES (${chunk.content}, ${vectorString}::vector, ${JSON.stringify(metadata)}::jsonb)`
      );
      
      embedded++;
      if (embedded % 5 === 0 || embedded === allChunks.length) {
        console.log(`  ✅ Embedded ${embedded}/${allChunks.length} chunks...`);
      }
    } catch (error) {
      console.error(`  ❌ Failed to embed chunk: ${chunk.module}/${chunk.section}`, error);
    }
  }
  
  console.log(`\n🎉 [Theory] Successfully embedded ${embedded} chunks!`);
  console.log('\n📊 [Theory] Module distribution:');
  for (const file of theoryFiles) {
    const moduleName = file.replace('.md', '');
    const count = allChunks.filter(c => c.module === moduleName).length;
    console.log(`   - ${moduleName}: ${count} chunks`);
  }
  
  console.log('\n📊 [Theory] Priority distribution:');
  console.log(`   - Priority 4 (Core concepts/decisions): ${allChunks.filter(c => c.priority === 4).length}`);
  console.log(`   - Priority 3 (Examples/cases): ${allChunks.filter(c => c.priority === 3).length}`);
  console.log(`   - Priority 2 (Voice examples): ${allChunks.filter(c => c.priority === 2).length}`);
}

// Run the script
embedTheory()
  .then(() => {
    console.log('\n✅ Theory embedding complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Theory embedding failed:', error);
    process.exit(1);
  });
