import { queryPostgres } from '@/lib/db/postgres';

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS processing_queue (
  id SERIAL PRIMARY KEY,
  request_id UUID NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_queue_request_id ON processing_queue(request_id);
CREATE INDEX IF NOT EXISTS idx_queue_status ON processing_queue(status);
`;

async function setup() {
  console.log('Setting up database tables...');
  try {
    await queryPostgres(CREATE_TABLES_SQL);
    console.log('Tables created successfully.');
  } catch (error) {
    console.error('Error creating tables:', error);
  }
}

setup();
