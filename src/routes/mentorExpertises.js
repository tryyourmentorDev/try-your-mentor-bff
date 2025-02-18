// src/routes/mentorExpertises.js
import { Router } from 'express';
import { pool } from '../lib/db.js';

const router = Router();

/**
 * POST /mentors/:user_id/expertises
 * Assign one or more expertise IDs to a mentor (many-to-many).
 * Expect {expertises: [1,2,3]}
 */
router.post('/:user_id/expertises', async (req, res) => {
  try {
    const userId = parseInt(req.params.user_id, 10);
    const { expertises } = req.body; // e.g. [1,2,3]

    if (!Array.isArray(expertises) || expertises.length === 0) {
      return res.status(400).json({ error: 'No expertises provided' });
    }

    const insertValues = [];
    const placeholders = [];
    let index = 1;
    for (const expId of expertises) {
      placeholders.push(`($${index++}, $${index++})`);
      insertValues.push(userId, expId);
    }

    const insertQuery = `
      INSERT INTO mentor_expertises (mentor_id, expertise_id)
      VALUES ${placeholders.join(', ')}
      RETURNING mentor_id, expertise_id
    `;
    const result = await pool.query(insertQuery, insertValues);
    return res.status(201).json(result.rows);
  } catch (error) {
    console.error('Error assigning mentor expertises:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /mentors/:user_id/expertises
 * List all expertises assigned to a mentor
 */
router.get('/:user_id/expertises', async (req, res) => {
  try {
    const userId = parseInt(req.params.user_id, 10);
    const selectQuery = `
      SELECT me.expertise_id, e.name, e.description
      FROM mentor_expertises me
      JOIN expertises e ON e.id = me.expertise_id
      WHERE me.mentor_id = $1
      ORDER BY me.expertise_id
    `;
    const result = await pool.query(selectQuery, [userId]);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching mentor expertises:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /mentors/:user_id/expertises/:exp_id
 * Remove a specific expertise from a mentor
 */
router.delete('/:user_id/expertises/:exp_id', async (req, res) => {
  try {
    const userId = parseInt(req.params.user_id, 10);
    const expId = parseInt(req.params.exp_id, 10);

    const deleteQuery = `
      DELETE FROM mentor_expertises
      WHERE mentor_id = $1 AND expertise_id = $2
      RETURNING mentor_id, expertise_id
    `;
    const result = await pool.query(deleteQuery, [userId, expId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mentor expertise not found' });
    }
    return res.json({ success: true, removed: result.rows[0] });
  } catch (error) {
    console.error('Error deleting mentor expertise:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
