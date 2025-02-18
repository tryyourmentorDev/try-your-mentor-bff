// src/routes/sessions.js
import { Router } from 'express';
import { pool } from '../lib/db.js';

const router = Router();

/**
 * POST /sessions
 * Create a session: mentee_id, scheduled_at, etc.
 */
router.post('/', async (req, res) => {
  try {
    const { mentee_id, scheduled_at, session_type, status, meeting_link } = req.body;

    const insertQuery = `
      INSERT INTO sessions (
        mentee_id,
        scheduled_at,
        session_type,
        status,
        meeting_link,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id
    `;
    const values = [mentee_id, scheduled_at, session_type, status, meeting_link];
    const result = await pool.query(insertQuery, values);

    return res.status(201).json({ sessionId: result.rows[0].id });
  } catch (error) {
    console.error('Error creating session:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /sessions
 * List or search sessions – maybe filter by mentee_id, status, etc.
 */
router.get('/', async (req, res) => {
  try {
    const { mentee_id, status } = req.query;
    const conditions = [];
    const values = [];
    let index = 1;

    if (mentee_id) {
      conditions.push(`mentee_id = $${index++}`);
      values.push(mentee_id);
    }
    if (status) {
      conditions.push(`status = $${index++}`);
      values.push(status);
    }

    let selectQuery = `
      SELECT id, mentee_id, scheduled_at, session_type, status, meeting_link, created_at
      FROM sessions
    `;
    if (conditions.length > 0) {
      selectQuery += ' WHERE ' + conditions.join(' AND ');
    }
    selectQuery += ' ORDER BY id';

    const result = await pool.query(selectQuery, values);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error listing sessions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /sessions/:id
 * View session details, possibly including mentors assigned in session_mentors
 */
router.get('/:id', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id, 10);

    const selectQuery = `
      SELECT id, mentee_id, scheduled_at, session_type, status, meeting_link, created_at
      FROM sessions
      WHERE id = $1
    `;
    const result = await pool.query(selectQuery, [sessionId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Optionally, fetch mentors from `session_mentors` table
    // Or do a join if you want them in one response

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching session:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /sessions/:id
 * Update session details (e.g., status: "booked", "completed", etc.)
 */
router.put('/:id', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id, 10);
    const { scheduled_at, session_type, status, meeting_link } = req.body;

    const updateQuery = `
      UPDATE sessions
      SET
        scheduled_at = $1,
        session_type = $2,
        status = $3,
        meeting_link = $4
      WHERE id = $5
      RETURNING id, mentee_id, scheduled_at, session_type, status, meeting_link
    `;
    const values = [scheduled_at, session_type, status, meeting_link, sessionId];

    const result = await pool.query(updateQuery, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating session:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /sessions/:id
 * Remove session (if cancellations allowed or admin-only).
 */
router.delete('/:id', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id, 10);

    const deleteQuery = `
      DELETE FROM sessions
      WHERE id = $1
      RETURNING id
    `;
    const result = await pool.query(deleteQuery, [sessionId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    return res.json({ success: true, deletedSessionId: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting session:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
