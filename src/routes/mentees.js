import { Router } from 'express';
import { pool } from '../lib/db.js';  // your DB connection

const router = Router();

/**
 * POST /mentees
 * Create a new mentee record for an existing user (or at signup).
 */
router.post('/', async (req, res) => {
  try {
    const {
      user_id,
      education_qualification_id,
      current_job_role_id,
      expected_job_role_id,
      experience_years
    } = req.body;

    const insertQuery = `
      INSERT INTO mentees (
        user_id,
        education_qualification_id,
        current_job_role_id,
        expected_job_role_id,
        experience_years,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING user_id
    `;
    const values = [
      user_id,
      education_qualification_id,
      current_job_role_id,
      expected_job_role_id,
      experience_years
    ];

    const result = await pool.query(insertQuery, values);

    return res.status(201).json({ menteeUserId: result.rows[0].user_id });
  } catch (error) {
    console.error('Error creating mentee:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /mentees/:user_id
 * View mentee details – education, job role, etc.
 */
router.get('/:user_id', async (req, res) => {
  try {
    const userId = parseInt(req.params.user_id, 10);

    const selectQuery = `
      SELECT
        user_id,
        education_qualification_id,
        current_job_role_id,
        expected_job_role_id,
        experience_years,
        created_at
      FROM mentees
      WHERE user_id = $1
    `;
    const result = await pool.query(selectQuery, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mentee not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching mentee:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /mentees/:user_id
 * Edit mentee info fully (you could do PATCH for partial updates).
 */
router.put('/:user_id', async (req, res) => {
  try {
    const userId = parseInt(req.params.user_id, 10);
    const {
      education_qualification_id,
      current_job_role_id,
      expected_job_role_id,
      experience_years
    } = req.body;

    const updateQuery = `
      UPDATE mentees
      SET
        education_qualification_id = $1,
        current_job_role_id = $2,
        expected_job_role_id = $3,
        experience_years = $4
      WHERE user_id = $5
      RETURNING user_id, education_qualification_id, current_job_role_id, expected_job_role_id, experience_years
    `;
    const values = [
      education_qualification_id,
      current_job_role_id,
      expected_job_role_id,
      experience_years,
      userId
    ];

    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mentee not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating mentee:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
