#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

console.log('Copying JSON data files to dist directory...');

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
      console.log(`✓ Copied ${file.src} -> ${file.dest}`);
    } else {
      console.warn(`⚠ Source file not found: ${file.src}`);
    }
  } catch (error) {
    console.error(`✗ Failed to copy ${file.src}:`, error.message);
  }
}

console.log('JSON data files copy completed.');