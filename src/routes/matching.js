import { Router } from 'express';
import { pool } from '../lib/db.js';

const router = Router();

/**
 * GET /matching/:mentee_id
 * Returns a sorted list of matching mentors for a given mentee
 */
router.get('/:mentee_id', async (req, res) => {
  const menteeId = parseInt(req.params.mentee_id, 10);
  if (isNaN(menteeId)) return res.status(400).json({ error: 'Invalid mentee ID' });

  try {
    const { rows } = await pool.query('SELECT * FROM match_mentors_for_mentee($1)', [menteeId]);
    return res.json(rows);
  } catch (error) {
    console.error('Matching query failed:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
