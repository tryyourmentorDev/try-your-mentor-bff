import express from 'express';
import pkg from 'pg';
import dotenv from 'dotenv';
import usersRouter from './routes/users.js';

dotenv.config();

const { Pool } = pkg;  // destructure named exports from the default import

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ssl: { rejectUnauthorized: false }, // if needed for production
});

const app = express();
app.use(express.json());

app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ time: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/', (req, res) => {
  res.send('Hello from Express server');
});

app.use('/users', usersRouter);


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
