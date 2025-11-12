import { db } from '../infra/db';
import { chunks } from '../../shared/schema';
import { generateEmbedding } from '../services/geminiEmbeddings';
import { sql as sqlTag } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PatternChunk {
  content: string;
  metadata: any;
}

async function seedPatternChunks() {
  console.log('📚 Starting pattern chunks seeding process...\n');

  const patternChunksPath = path.join(__dirname, '../data/pattern_chunks.json');
  const patternChunksData: PatternChunk[] = JSON.parse(
    fs.readFileSync(patternChunksPath, 'utf-8')
  );

  console.log(`✅ Loaded ${patternChunksData.length} pattern chunks from file\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < patternChunksData.length; i++) {
    const chunk = patternChunksData[i];
    const chunkNumber = i + 1;

    try {
      console.log(`[${chunkNumber}/${patternChunksData.length}] Processing: ${chunk.metadata.pattern_type}`);
      console.log(`  Type: ${chunk.metadata.type}`);
      console.log(`  Teaches: ${chunk.metadata.teaches}`);
      console.log(`  Epistemic status: ${chunk.metadata.epistemic_status}`);
      console.log(`  Confidence: ${chunk.metadata.confidence}`);

      console.log('  🧠 Generating Gemini embedding...');
      const embedding = await generateEmbedding(chunk.content);

      if (!embedding || embedding.length !== 768) {
        throw new Error(`Invalid embedding generated: ${embedding?.length} dimensions`);
      }

      console.log('  ✅ Embedding generated (768 dimensions)');

      console.log('  💾 Inserting into database...');
      
      const vectorString = `[${embedding.join(',')}]`;
      await db.execute(
        sqlTag`INSERT INTO chunks (content, embedding, metadata) 
               VALUES (${chunk.content}, ${vectorString}::vector, ${JSON.stringify(chunk.metadata)}::jsonb)
               RETURNING id`
      );

      console.log(`  ✅ Successfully seeded chunk ${chunkNumber}\n`);
      successCount++;

    } catch (error) {
      console.error(`  ❌ Error seeding chunk ${chunkNumber}:`, error);
      errorCount++;
    }
  }

  console.log('\n========================================');
  console.log('📊 Seeding Summary:');
  console.log(`  ✅ Successful: ${successCount}`);
  console.log(`  ❌ Failed: ${errorCount}`);
  console.log(`  📚 Total: ${patternChunksData.length}`);
  console.log('========================================\n');

  if (successCount > 0) {
    console.log('🎉 Pattern observation system ready!');
    console.log('TIBER can now teach evaluation frameworks using:');
    console.log('  - Epistemic framing (working assumptions)');
    console.log('  - Live data validation (when metrics queryable)');
    console.log('  - Pattern recognition over static facts\n');
  }

  process.exit(errorCount > 0 ? 1 : 0);
}

seedPatternChunks().catch((error) => {
  console.error('💥 Fatal error during seeding:', error);
  process.exit(1);
});
