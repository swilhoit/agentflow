import { Pool } from 'pg';

// Hetzner PostgreSQL connection pool
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.AGENTFLOW_DB_HOST || '178.156.198.233',
      port: parseInt(process.env.AGENTFLOW_DB_PORT || '5432'),
      user: process.env.AGENTFLOW_DB_USER || 'agentflow',
      password: process.env.AGENTFLOW_DB_PASSWORD || 'agentflow_secure_2024',
      database: process.env.AGENTFLOW_DB_NAME || 'agentflow',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected PostgreSQL pool error:', err);
    });
  }
  return pool;
}

export async function query(sql: string, params?: any[]): Promise<any> {
  const pool = getPool();
  const result = await pool.query(sql, params);
  return result;
}
