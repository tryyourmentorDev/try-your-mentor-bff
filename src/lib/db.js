import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();  // load .env variables

const { Pool } = pkg;  // destructure from the default import

// Create a connection pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ssl: { rejectUnauthorized: false } // uncomment if needed for production (e.g., Heroku, Railway)
});
