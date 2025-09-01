#!/usr/bin/env node
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function buildAndDeploy() {
  try {
    console.log('🚀 Starting build and deploy process...\n');

    // Step 1: Run the normal build process
    console.log('📦 Running build process...');
    const { stdout: buildStdout, stderr: buildStderr } = await execAsync('npm run build');
    if (buildStderr && !buildStderr.includes('browsers data')) {
      console.warn('⚠ Build warnings:', buildStderr);
    }
    console.log('✅ Build completed successfully\n');

    // Step 2: Copy JSON data files
    console.log('📋 Copying JSON data files to dist directory...');
    
    // Ensure dist directory exists
    if (!fs.existsSync('dist')) {
      fs.mkdirSync('dist', { recursive: true });
    }

    // Copy specific JSON files that are imported/required by the server code
    const filesToCopy = [
      // Injury profiles - critical for deployment
      { src: 'server/consensus/injuryProfiles.v2.json', dest: 'dist/injuryProfiles.v2.json' },
      { src: 'server/consensus/injuryProfiles.v2.json', dest: 'dist/consensus/injuryProfiles.v2.json' },
      
      // Other critical JSON files that might be imported
      { src: 'server/data/player_ratings_v1.json', dest: 'dist/data/player_ratings_v1.json' },
      { src: 'server/data/rookies.json', dest: 'dist/data/rookies.json' },
      { src: 'server/data/ratings_engine_config.json', dest: 'dist/data/ratings_engine_config.json' },
      { src: 'server/config/deepseek.v3.weights.json', dest: 'dist/config/deepseek.v3.weights.json' },
      { src: 'server/modules/sos/sos.seed.json', dest: 'dist/modules/sos/sos.seed.json' },
      { src: 'server/player_mappings.json', dest: 'dist/player_mappings.json' },
      { src: 'server/nfl_data_2024.json', dest: 'dist/nfl_data_2024.json' },
    ];

    let copiedCount = 0;
    for (const file of filesToCopy) {
      try {
        // Ensure destination directory exists
        const destDir = path.dirname(file.dest);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        
        // Copy file if source exists
        if (fs.existsSync(file.src)) {
          fs.copyFileSync(file.src, file.dest);
          console.log(`  ✓ Copied ${file.src} -> ${file.dest}`);
          copiedCount++;
        } else {
          console.warn(`  ⚠ Source file not found: ${file.src}`);
        }
      } catch (error) {
        console.error(`  ✗ Failed to copy ${file.src}:`, error.message);
      }
    }

    console.log(`✅ Copied ${copiedCount} JSON data files\n`);

    // Step 3: Test that critical files exist
    console.log('🔍 Verifying critical files...');
    const criticalFiles = [
      'dist/index.js',
      'dist/injuryProfiles.v2.json',
      'dist/consensus/injuryProfiles.v2.json'
    ];

    let allFilesExist = true;
    for (const file of criticalFiles) {
      if (fs.existsSync(file)) {
        const stats = fs.statSync(file);
        console.log(`  ✓ ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
      } else {
        console.error(`  ✗ Missing critical file: ${file}`);
        allFilesExist = false;
      }
    }

    if (allFilesExist) {
      console.log('\n🎉 Build and deploy process completed successfully!');
      console.log('\nTo start the production server, run:');
      console.log('  NODE_ENV=production node dist/index.js');
    } else {
      console.error('\n❌ Build process completed but some critical files are missing');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Build and deploy failed:', error.message);
    process.exit(1);
  }
}

// Run the build and deploy process
buildAndDeploy();