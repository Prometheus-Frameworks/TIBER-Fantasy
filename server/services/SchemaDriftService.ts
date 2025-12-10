import { db } from "../infra/db";
import { schemaRegistry } from "../../shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { createHash } from "crypto";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

export interface DriftCheckResult {
  hasDrift: boolean;
  localHash: string;
  liveHash?: string;
  localVersion?: string;
  liveVersion?: string;
}

export interface MigrationRecord {
  appVersion: string;
  gitCommit: string;
  drizzleTag: string;
  checksumSql: string;
  migrationSource: string;
  environment?: string;
  notes?: string;
}

/**
 * Schema Drift Detection and Auto-Migration Service
 * 
 * Provides deployment safety by detecting schema changes and optionally
 * applying migrations automatically based on environment configuration.
 */
export class SchemaDriftService {
  private readonly AUTO_MIGRATE_ENV = 'TIBER_AUTO_MIGRATE';
  private readonly ENVIRONMENT = process.env.NODE_ENV || 'development';
  
  /**
   * Check for schema drift between local schema (from code) and live database schema (actual DB structure)
   * CORRECTED: Now compares local vs live DB, not local vs registry history
   */
  async checkDrift(): Promise<DriftCheckResult> {
    try {
      console.log('🔍 Checking for schema drift (local code vs live database)...');
      
      // Generate hash from local schema definition (code)
      const localHash = await this.generateLocalSchemaHash();
      
      // Generate hash from actual live database structure
      const liveHash = await this.generateLiveDbSchemaHash();
      
      // TRUE drift detection: compare local code vs actual database
      const hasDrift = localHash !== liveHash;
      
      // Get registry info for version tracking (audit only, not drift comparison)
      const latestRegistry = await this.getLatestSchemaRegistry();
      
      const result: DriftCheckResult = {
        hasDrift,
        localHash,
        liveHash,
        localVersion: await this.getAppVersion(),
        liveVersion: latestRegistry?.appVersion
      };
      
      if (hasDrift) {
        console.log(`⚠️ Schema drift detected (LOCAL vs LIVE DATABASE):
        Local Hash (from code):    ${localHash}
        Live Hash (from database): ${liveHash}
        Local Version: ${result.localVersion}
        Registry Version: ${result.liveVersion || 'none'}`);
      } else {
        console.log('✅ No schema drift detected - local code matches live database');
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error checking schema drift:', error);
      throw new Error(`Schema drift check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate hash of local schema definition (from code/shared/schema.ts)
   */
  async generateLocalSchemaHash(): Promise<string> {
    try {
      console.log('📊 Generating local schema hash from code...');
      
      // Method 1: Try to generate SQL from current schema definition
      try {
        const schemaSQL = await this.generateSchemaFromCode();
        const normalizedSchema = this.normalizeSQL(schemaSQL);
        const hash = createHash('sha256').update(normalizedSchema).digest('hex');
        console.log(`✅ Local schema hash (from generated SQL): ${hash.substring(0, 16)}...`);
        return hash;
      } catch (sqlError) {
        console.warn('⚠️ Could not generate SQL from schema, using schema.ts file as fallback');
        
        // Method 2: Fallback to hashing schema.ts file directly
        const schemaPath = path.join(process.cwd(), 'shared', 'schema.ts');
        const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
        const normalizedContent = this.normalizeSchemaFile(schemaContent);
        const hash = createHash('sha256').update(normalizedContent).digest('hex');
        console.log(`✅ Local schema hash (from schema.ts): ${hash.substring(0, 16)}...`);
        return hash;
      }
    } catch (error) {
      console.error('❌ Error generating local schema hash:', error);
      throw new Error(`Local schema hash generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate hash of live database schema (actual deployed database structure)
   */
  async generateLiveDbSchemaHash(): Promise<string> {
    try {
      console.log('🔍 Generating live database schema hash...');
      
      // Use drizzle-kit introspect to get actual database structure
      const liveSchemaSQL = await this.introspectLiveDatabase();
      const normalizedSchema = this.normalizeSQL(liveSchemaSQL);
      const hash = createHash('sha256').update(normalizedSchema).digest('hex');
      
      console.log(`✅ Live database schema hash: ${hash.substring(0, 16)}...`);
      return hash;
    } catch (error) {
      console.error('❌ Error generating live database schema hash:', error);
      throw new Error(`Live database schema hash generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Record successful migration in schema registry
   */
  async recordAppliedMigration(migrationData: Partial<MigrationRecord> = {}): Promise<void> {
    try {
      const gitCommit = await this.getGitCommit();
      const appVersion = await this.getAppVersion();
      const checksumSql = await this.generateLocalSchemaHash();
      const drizzleTag = await this.getDrizzleVersion();
      
      const record: MigrationRecord = {
        appVersion,
        gitCommit,
        drizzleTag,
        checksumSql,
        migrationSource: migrationData.migrationSource || 'auto',
        environment: migrationData.environment || this.ENVIRONMENT,
        notes: migrationData.notes,
        ...migrationData
      };

      await db.insert(schemaRegistry).values(record);
      
      console.log(`✅ Recorded migration in schema registry:
        Version: ${record.appVersion}
        Commit: ${record.gitCommit.substring(0, 8)}
        Hash: ${record.checksumSql.substring(0, 16)}...
        Source: ${record.migrationSource}`);
    } catch (error) {
      console.error('❌ Error recording migration:', error);
      throw new Error(`Failed to record migration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Run auto-migration if enabled via environment variable
   */
  async runAutoMigration(): Promise<void> {
    const autoMigrateEnabled = process.env[this.AUTO_MIGRATE_ENV] === 'true';
    
    if (!autoMigrateEnabled) {
      throw new Error(`Schema drift detected but auto-migration disabled. Enable with ${this.AUTO_MIGRATE_ENV}=true or apply migrations manually.`);
    }

    try {
      console.log('🔄 Running auto-migration...');
      
      // Run drizzle-kit push to apply schema changes
      const migrationResult = await this.executeDrizzlePush();
      
      // Record the successful migration
      await this.recordAppliedMigration({
        migrationSource: 'auto',
        notes: `Auto-migration executed successfully: ${migrationResult}`
      });
      
      console.log('✅ Auto-migration completed successfully');
    } catch (error) {
      console.error('❌ Auto-migration failed:', error);
      
      // DO NOT record failed migration in schema_registry to prevent audit poisoning
      console.log('⚠️ Migration failed - NOT recording in schema_registry to prevent audit poisoning');
      
      throw new Error(`Auto-migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Boot-time drift check and auto-migration orchestration
   */
  async checkAndMigrateOnBoot(): Promise<DriftCheckResult> {
    try {
      console.log('🚀 Starting boot-time schema drift check...');
      
      const driftResult = await this.checkDrift();
      
      if (driftResult.hasDrift) {
        console.log('⚠️ Schema drift detected during boot sequence');
        
        const autoMigrateEnabled = process.env[this.AUTO_MIGRATE_ENV] === 'true';
        
        if (autoMigrateEnabled) {
          console.log('🔄 Auto-migration enabled, attempting migration...');
          await this.runAutoMigration();
          
          // Re-check drift after migration
          const postMigrationDrift = await this.checkDrift();
          if (postMigrationDrift.hasDrift) {
            throw new Error('Schema drift still detected after auto-migration - manual intervention required');
          }
          
          console.log('✅ Boot-time auto-migration completed successfully');
          return postMigrationDrift;
        } else {
          throw new Error(`🚨 DEPLOYMENT BLOCKED: Schema drift detected but auto-migration disabled.
          
          Current situation:
          - Local schema hash (from code): ${driftResult.localHash}
          - Live database hash (actual DB): ${driftResult.liveHash || 'none'}
          - Local version: ${driftResult.localVersion}
          - Registry version: ${driftResult.liveVersion || 'none'}
          
          DRIFT DETECTED: Your code schema differs from the live database.
          
          Solutions:
          1. Enable auto-migration: Set ${this.AUTO_MIGRATE_ENV}=true
          2. Apply migrations manually: npm run db:push
          3. Review schema changes and ensure they are safe
          
          This safety check prevents deploying with incompatible schemas.`);
        }
      }
      
      console.log('✅ Boot-time schema check passed - no drift detected');
      return driftResult;
    } catch (error) {
      console.error('💥 Boot-time schema check failed:', error);
      throw error;
    }
  }

  /**
   * Get the latest SUCCESSFUL schema registry entry (audit trail only)
   * NOTE: This is used only for version tracking, NOT for drift comparison
   */
  private async getLatestSchemaRegistry() {
    try {
      const latestEntries = await db
        .select()
        .from(schemaRegistry)
        .where(sql`${schemaRegistry.migrationSource} != 'auto_failed'`) // Exclude failed attempts
        .orderBy(desc(schemaRegistry.appliedAt))
        .limit(1);
      
      return latestEntries[0] || null;
    } catch (error) {
      // If the schema_registry table doesn't exist yet, return null
      if (error instanceof Error && error.message.includes('relation "schema_registry" does not exist')) {
        console.log('📝 Schema registry table not found - this may be the first run');
        return null;
      }
      throw error;
    }
  }

  /**
   * Generate SQL schema from current code definition using drizzle-kit
   */
  private async generateSchemaFromCode(): Promise<string> {
    try {
      console.log('🔨 Generating SQL from schema definition...');
      
      // Use drizzle-kit generate to create SQL from current schema
      const { stdout } = await execAsync('npx drizzle-kit generate --config=drizzle.config.ts', {
        cwd: process.cwd(),
        timeout: 30000,
        env: { ...process.env, DRIZZLE_KIT_NO_INTERACTION: 'true' }
      });
      
      // Read the latest migration file or schema output
      const migrationsPath = path.join(process.cwd(), 'drizzle');
      
      if (fs.existsSync(migrationsPath)) {
        // Read the most recent migration file
        const migrationFiles = fs.readdirSync(migrationsPath)
          .filter(f => f.endsWith('.sql'))
          .sort((a, b) => b.localeCompare(a)); // Latest first
        
        if (migrationFiles.length > 0) {
          const latestMigration = path.join(migrationsPath, migrationFiles[0]);
          const migrationContent = fs.readFileSync(latestMigration, 'utf-8');
          return migrationContent;
        }
      }
      
      throw new Error('No migration files found after generate');
    } catch (error) {
      console.warn('⚠️ drizzle-kit generate failed, using schema.ts as fallback:', error);
      throw error; // Let caller handle fallback
    }
  }

  /**
   * Introspect live database to get actual deployed schema structure
   */
  private async introspectLiveDatabase(): Promise<string> {
    try {
      console.log('🔍 Introspecting live database structure...');
      
      // Use drizzle-kit introspect to read actual database
      const tempDir = `temp-introspect-${Date.now()}`;
      
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        throw new Error('DATABASE_URL not found in environment');
      }
      
      const { stdout } = await execAsync(`npx drizzle-kit introspect --dialect=postgresql --url="${dbUrl}" --out=./${tempDir}`, {
        cwd: process.cwd(),
        timeout: 30000
      });
      
      // Read introspected schema files (TypeScript files from drizzle-kit introspect)
      const tempSchemaPath = path.join(process.cwd(), tempDir);
      
      if (!fs.existsSync(tempSchemaPath)) {
        throw new Error(`Introspection output directory not found: ${tempSchemaPath}`);
      }
      
      const schemaFiles = fs.readdirSync(tempSchemaPath).filter(f => f.endsWith('.ts') || f.endsWith('.sql'));
      
      let combinedSchema = '';
      for (const file of schemaFiles) {
        const filePath = path.join(tempSchemaPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        combinedSchema += content + '\n';
      }
      
      // Clean up temp files
      fs.rmSync(tempSchemaPath, { recursive: true, force: true });
      
      if (!combinedSchema.trim()) {
        throw new Error('No schema content returned from database introspection');
      }
      
      return combinedSchema;
    } catch (error) {
      console.error('❌ Database introspection failed:', error);
      throw new Error(`Failed to introspect live database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Normalize schema.ts file content for consistent hashing
   */
  private normalizeSchemaFile(content: string): string {
    return content
      .replace(/\/\/.*$/gm, '')          // Remove line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\s+/g, ' ')            // Normalize whitespace
      .replace(/;\s*}/g, '}')          // Normalize semicolons before braces
      .replace(/,\s*}/g, '}')          // Normalize trailing commas
      .trim()
      .toLowerCase();
  }

  /**
   * Execute drizzle push command
   */
  private async executeDrizzlePush(): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync('npm run db:push', {
        cwd: process.cwd(),
        timeout: 60000
      });
      
      return stdout + (stderr || '');
    } catch (error) {
      console.error('❌ Drizzle push failed:', error);
      throw error;
    }
  }

  /**
   * Normalize SQL for consistent hashing
   */
  private normalizeSQL(sql: string): string {
    return sql
      .replace(/\s+/g, ' ')           // Normalize whitespace
      .replace(/--.*$/gm, '')        // Remove comments
      .replace(/\/\*[\s\S]*?\*\//g, '')  // Remove block comments
      .trim()
      .toLowerCase();
  }

  /**
   * Get current git commit hash
   */
  private async getGitCommit(): Promise<string> {
    try {
      const { stdout } = await execAsync('git rev-parse HEAD', { timeout: 5000 });
      return stdout.trim();
    } catch (error) {
      console.warn('⚠️ Could not get git commit, using timestamp fallback');
      return `no-git-${Date.now()}`;
    }
  }

  /**
   * Get app version from package.json
   */
  private async getAppVersion(): Promise<string> {
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      return packageJson.version || '0.0.0';
    } catch (error) {
      console.warn('⚠️ Could not read app version, using default');
      return '0.0.0';
    }
  }

  /**
   * Get Drizzle version
   */
  private async getDrizzleVersion(): Promise<string> {
    try {
      const { stdout } = await execAsync('npx drizzle-kit --version', { timeout: 5000 });
      return stdout.trim();
    } catch (error) {
      console.warn('⚠️ Could not get drizzle version');
      return 'unknown';
    }
  }

  /**
   * Get schema registry history for audit purposes
   */
  async getSchemaHistory(limit: number = 10) {
    return db
      .select()
      .from(schemaRegistry)
      .orderBy(desc(schemaRegistry.appliedAt))
      .limit(limit);
  }

  /**
   * Validate environment configuration and drift detection logic
   */
  validateConfig(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    if (!process.env.DATABASE_URL) {
      issues.push('DATABASE_URL environment variable is required');
    }
    
    if (this.ENVIRONMENT === 'production' && process.env[this.AUTO_MIGRATE_ENV] === 'true') {
      issues.push(`Warning: Auto-migration is enabled in production (${this.AUTO_MIGRATE_ENV}=true)`);
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Test the corrected drift detection logic with validation
   */
  async validateDriftDetection(): Promise<{ success: boolean; details: string[] }> {
    const details: string[] = [];
    let success = true;

    try {
      details.push('🧪 Testing corrected drift detection logic...');
      
      // Test 1: Verify we can generate local schema hash
      try {
        const localHash = await this.generateLocalSchemaHash();
        details.push(`✅ Local schema hash generation: ${localHash.substring(0, 16)}...`);
      } catch (error) {
        details.push(`❌ Local schema hash generation failed: ${error}`);
        success = false;
      }

      // Test 2: Verify we can introspect live database
      try {
        const liveHash = await this.generateLiveDbSchemaHash();
        details.push(`✅ Live database schema hash generation: ${liveHash.substring(0, 16)}...`);
      } catch (error) {
        details.push(`❌ Live database introspection failed: ${error}`);
        success = false;
      }

      // Test 3: Full drift check
      try {
        const driftResult = await this.checkDrift();
        details.push(`✅ Drift check completed: ${driftResult.hasDrift ? 'DRIFT DETECTED' : 'NO DRIFT'}`);
        details.push(`   Local hash: ${driftResult.localHash.substring(0, 16)}...`);
        details.push(`   Live hash:  ${driftResult.liveHash?.substring(0, 16)}...`);
      } catch (error) {
        details.push(`❌ Full drift check failed: ${error}`);
        success = false;
      }

      // Test 4: Registry access (audit trail)
      try {
        const latestRegistry = await this.getLatestSchemaRegistry();
        details.push(`✅ Schema registry access: ${latestRegistry ? 'Found entries' : 'Empty (first run)'}`);
      } catch (error) {
        details.push(`❌ Schema registry access failed: ${error}`);
        success = false;
      }

      details.push(success ? '🎉 All drift detection validation tests passed!' : '⚠️ Some validation tests failed');
      
    } catch (error) {
      details.push(`💥 Validation test suite failed: ${error}`);
      success = false;
    }

    return { success, details };
  }

  /**
   * Quick smoke test for production readiness
   */
  async smokeDriftTest(): Promise<boolean> {
    try {
      console.log('🔍 Running drift detection smoke test...');
      
      const driftResult = await this.checkDrift();
      
      console.log(`🎯 Smoke test result: ${driftResult.hasDrift ? 'DRIFT DETECTED' : 'NO DRIFT'}`);
      console.log(`   Local: ${driftResult.localHash.substring(0, 8)}...`);
      console.log(`   Live:  ${driftResult.liveHash?.substring(0, 8)}...`);
      
      return true; // Test completed successfully
    } catch (error) {
      console.error(`💥 Smoke test failed: ${error}`);
      return false;
    }
  }
}

// Export singleton instance
export const schemaDriftService = new SchemaDriftService();