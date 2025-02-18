import { Router } from 'express';
import { pool } from '../lib/db.js'; // your Postgres connection

const router = Router();

/**
 * POST /sessions/:session_id/mentors
 * Add a mentor to the session
 * Expect body: { mentor_id: 123 }
 */
router.post('/:session_id/mentors', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.session_id, 10);
    const { mentor_id } = req.body;

    const insertQuery = `
      INSERT INTO session_mentors (session_id, mentor_id)
      VALUES ($1, $2)
      RETURNING session_id, mentor_id
    `;
    const result = await pool.query(insertQuery, [sessionId, mentor_id]);

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding mentor to session:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /sessions/:session_id/mentors/:mentor_id
 * Remove a mentor from the session
 */
router.delete('/:session_id/mentors/:mentor_id', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.session_id, 10);
    const mentorId = parseInt(req.params.mentor_id, 10);

    const deleteQuery = `
      DELETE FROM session_mentors
      WHERE session_id = $1 AND mentor_id = $2
      RETURNING session_id, mentor_id
    `;
    const result = await pool.query(deleteQuery, [sessionId, mentorId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mentor not found in session' });
    }

    return res.json({ success: true, removed: result.rows[0] });
  } catch (error) {
    console.error('Error removing mentor from session:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
