import express from 'express';
import pkg from 'pg';
import dotenv from 'dotenv';
import usersRouter from './routes/users.js';
import mentorsRouter from './routes/mentors.js';
import menteesRouter from './routes/mentees.js';
import qualificationsRouter from './routes/qualifications.js';
import mentorQualificationsRouter from './routes/mentorQualifications.js';
import expertisesRouter from './routes/expertises.js';
import mentorExpertisesRouter from './routes/mentorExpertises.js';
import jobRolesRouter from './routes/jobRoles.js';
import sessionsRouter from './routes/sessions.js';
import sessionMentorsRouter from './routes/sessionMentors.js';
import paymentsRouter from './routes/payments.js';
import resumesRouter from './routes/resumes.js';
import industriesRouter from './routes/industries.js';
import matchingRouter from './routes/matching.js';

dotenv.config();

const { Pool } = pkg;
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
app.use('/mentors', mentorsRouter);
app.use('/mentees', menteesRouter);
app.use('/qualifications', qualificationsRouter);
app.use('/mentors', mentorQualificationsRouter);
app.use('/expertises', expertisesRouter);
app.use('/mentors', mentorExpertisesRouter);
app.use('/job-roles', jobRolesRouter);
app.use('/sessions', sessionsRouter);
app.use('/sessions', sessionMentorsRouter);
app.use('/payments', paymentsRouter);
app.use('/resumes', resumesRouter);
app.use('/industries', industriesRouter);
app.use('/matching', matchingRouter);

export default app;
