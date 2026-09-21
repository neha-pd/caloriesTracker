import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

async function run() {
  try {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;`;
    await sql`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;`;
    console.log('Migration successful.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit(0);
  }
}

run();
