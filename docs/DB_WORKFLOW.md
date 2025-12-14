# Database Workflow Guide

## Overview

This document outlines the safe database workflow for TIBER Fantasy. Following these guidelines ensures data integrity and prevents accidental data loss.

## Environment Recommendations

| Environment | Command | When to Use |
|-------------|---------|-------------|
| **Main DB (Production-like)** | `npm run db:migrate` | Always use migrations for safety |
| **Disposable Dev DB / Neon Branch** | `npm run db:push` | OK for rapid iteration |

## Commands

### Safe Migration Workflow (Recommended)

```bash
# 1. Generate migration files from schema changes
npx drizzle-kit generate

# 2. Review generated SQL in ./migrations folder
# 3. Apply migrations (non-destructive, applies only pending)
npx drizzle-kit migrate
```

### Direct Push (Dev Only)

```bash
# Only use on disposable databases!
npm run db:push
```

## Interactive Prompts

When running `drizzle-kit push` or `drizzle-kit generate`, you may see prompts like:

```
Is brand_signals table created or renamed from another table?
❯ + brand_signals                    create table
  ~ users › brand_signals            rename table
```

**Always select the `+` (create) option** unless you explicitly intend to rename.

## Handling Unique Constraint Failures

If migrations fail due to duplicate data violating new unique constraints:

1. **Identify the constraint** - Check the migration SQL file
2. **Find duplicates**:
   ```sql
   SELECT column1, column2, COUNT(*) 
   FROM table_name 
   GROUP BY column1, column2 
   HAVING COUNT(*) > 1;
   ```
3. **Dedupe safely** before retrying migration

## Important Rules

1. **Never change primary key ID types** - Changing between `serial` and `varchar` breaks migrations
2. **Never use `--force` on production** - It may cause data loss
3. **Review migration SQL** - Always check `./migrations` folder before applying
4. **Backup before major changes** - Use Replit checkpoints or database snapshots

## Configuration

The drizzle configuration is in `drizzle.config.ts`:

```typescript
export default defineConfig({
  out: "./migrations",           // Migration files output
  schema: "./shared/schema.ts",  // Schema definition
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
```

## Optional: Shadow Database

For safer development, consider using a separate dev database:

```typescript
// In drizzle.config.ts
const isDev = process.env.NODE_ENV === 'development';
const dbUrl = isDev 
  ? process.env.DATABASE_URL_DEV || process.env.DATABASE_URL
  : process.env.DATABASE_URL;
```

Then set `DATABASE_URL_DEV` to a disposable Neon branch or local PostgreSQL instance.
