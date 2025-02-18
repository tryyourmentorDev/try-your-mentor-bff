import { Router } from 'express';
import { pool } from '../lib/db.js';

const router = Router();

/**
 * POST /mentors/:user_id/qualifications
 * Assign one or more qualification IDs to a mentor.
 * You might pass an array: { qualifications: [1,2,3] }
 */
router.post('/:user_id/qualifications', async (req, res) => {
  try {
    const userId = parseInt(req.params.user_id, 10);
    const { qualifications } = req.body;  // e.g. [1,2,3]

    if (!Array.isArray(qualifications) || qualifications.length === 0) {
      return res.status(400).json({ error: 'No qualifications provided' });
    }

    const insertValues = [];
    const placeholders = [];

    let index = 1;
    for (const qualId of qualifications) {
      placeholders.push(`($${index++}, $${index++})`);
      insertValues.push(userId, qualId);
    }

    const insertQuery = `
      INSERT INTO mentor_qualifications (mentor_id, qualification_id)
      VALUES ${placeholders.join(', ')}
      RETURNING id, mentor_id, qualification_id
    `;

    const result = await pool.query(insertQuery, insertValues);

    return res.status(201).json(result.rows);
  } catch (error) {
    console.error('Error assigning mentor qualifications:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /mentors/:user_id/qualifications
 * List mentor’s qualifications
 */
router.get('/:user_id/qualifications', async (req, res) => {
  try {
    const userId = parseInt(req.params.user_id, 10);

    // Join with qualifications table if you want qualification names, etc.
    const selectQuery = `
      SELECT mq.id, mq.qualification_id, q.name AS qualification_name
      FROM mentor_qualifications mq
      JOIN qualifications q ON q.id = mq.qualification_id
      WHERE mq.mentor_id = $1
      ORDER BY mq.id
    `;
    const result = await pool.query(selectQuery, [userId]);

    return res.json(result.rows);
  } catch (error) {
    console.error('Error listing mentor qualifications:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /mentors/:user_id/qualifications/:qual_id
 * Remove a specific qualification from a mentor
 */
router.delete('/:user_id/qualifications/:qual_id', async (req, res) => {
  try {
    const userId = parseInt(req.params.user_id, 10);
    const qualId = parseInt(req.params.qual_id, 10);

    const deleteQuery = `
      DELETE FROM mentor_qualifications
      WHERE mentor_id = $1 AND qualification_id = $2
      RETURNING id
    `;
    const result = await pool.query(deleteQuery, [userId, qualId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mentor qualification not found' });
    }

    return res.json({ success: true, deletedRecordId: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting mentor qualification:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
