import express from 'express';
import cors from 'cors';
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
import mentorReviewsRouter from './routes/mentorReviews.js';
import mentorAvailabilityRouter from './routes/mentorAvailability.js';
import bookingsRouter from './routes/bookings.js';

dotenv.config();

const { Pool } = pkg;
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : [];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`CORS blocked for origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
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
app.use('/mentor-reviews', mentorReviewsRouter);
app.use('/mentors', mentorAvailabilityRouter);
app.use('/mentors', bookingsRouter);

export default app;
