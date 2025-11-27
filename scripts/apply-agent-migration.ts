import { getPostgresDatabase } from '../src/services/postgresDatabaseService';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../src/utils/logger';

async function main() {
  logger.info('🐘 Applying Agent Manager Migration...');

  try {
    const db = getPostgresDatabase();
    
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 1000));

    const migrationPath = path.join(process.cwd(), 'supabase/migrations/004_agent_manager_tables.sql');
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const sql = fs.readFileSync(migrationPath, 'utf-8');
    logger.info('📄 Read migration SQL file');

    // Execute migration
    await db.query(sql);
    logger.info('✅ Migration applied successfully!');

    await db.close();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Failed to apply migration:', error);
    process.exit(1);
  }
}

main();

