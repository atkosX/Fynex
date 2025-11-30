import { Pool } from 'pg';

const connectionString = process.env.PSQL_CONNECTION_URL;

if (!connectionString) {
  console.warn('PSQL_CONNECTION_URL is not defined');
}

export const pgPool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // Neondb usually requires SSL
  },
});

export async function queryPostgres(text: string, params?: any[]) {
  const client = await pgPool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}
