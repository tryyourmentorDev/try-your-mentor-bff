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
 * GET /mentees/all
 * Returns all mentees with user info, qualification & job role IDs and names.
 */
router.get('/all', async (req, res) => {
  try {
    const query = `
      SELECT
        m.user_id,
        u.email,
        u.first_name,
        u.last_name,
        m.education_qualification_id,
        eq.name   AS education_qualification,
        m.current_job_role_id,
        cjr.name  AS current_job_role,
        m.expected_job_role_id,
        ejr.name  AS expected_job_role,
        m.experience_years,
        m.created_at
      FROM mentees m
      JOIN users u
        ON u.id = m.user_id
      LEFT JOIN qualifications eq
        ON eq.id = m.education_qualification_id
      LEFT JOIN job_roles cjr
        ON cjr.id = m.current_job_role_id
      LEFT JOIN job_roles ejr
        ON ejr.id = m.expected_job_role_id
      ORDER BY m.user_id;
    `;
    const { rows } = await pool.query(query);
    return res.json(rows);
  } catch (error) {
    console.error('Error fetching mentees list:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /mentees/:user_id
 * Returns one mentee with full details including qualification & job role IDs.
 */
router.get('/:user_id(\\d+)', async (req, res) => {
  try {
    const userId = parseInt(req.params.user_id, 10);

    const query = `
      SELECT
        m.user_id,
        u.email,
        u.first_name,
        u.last_name,
        m.education_qualification_id,
        eq.name   AS education_qualification,
        m.current_job_role_id,
        cjr.name  AS current_job_role,
        m.expected_job_role_id,
        ejr.name  AS expected_job_role,
        m.experience_years,
        m.created_at
      FROM mentees m
      JOIN users u
        ON u.id = m.user_id
      LEFT JOIN qualifications eq
        ON eq.id = m.education_qualification_id
      LEFT JOIN job_roles cjr
        ON cjr.id = m.current_job_role_id
      LEFT JOIN job_roles ejr
        ON ejr.id = m.expected_job_role_id
      WHERE m.user_id = $1;
    `;
    const { rows } = await pool.query(query, [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Mentee not found' });
    }
    return res.json(rows[0]);
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

/**
 * POST /mentees/signup
 * Creates both a user and a mentee in one transaction.
 * Expects JSON body with:
 *  - first_name                (string, required)
 *  - last_name                 (string, required)
 *  - email                     (string, required)
 *  - education_qualification_id (int, optional)
 *  - current_job_role_id       (int, optional)
 *  - expected_job_role_id      (int, optional)
 *  - experience_years          (int, optional)
 */
router.post('/signup', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      first_name,
      last_name,
      email,
      education_qualification_id = null,
      current_job_role_id       = null,
      expected_job_role_id      = null,
      experience_years          = null
    } = req.body;

    const dummyPassword = 'dummy';

    // 1) Insert into users table
    const insertUser = `
      INSERT INTO users
        (email, password_hash, first_name, last_name, role, created_at)
      VALUES
        ($1, $2, $3, $4, 'mentee', NOW())
      RETURNING id
    `;
    const { rows: [u] } = await client.query(insertUser, [
      email,
      dummyPassword,
      first_name,
      last_name
    ]);
    const userId = u.id;

    // 2) Insert into mentees table
    const insertMentee = `
      INSERT INTO mentees
        (
          user_id,
          education_qualification_id,
          current_job_role_id,
          expected_job_role_id,
          experience_years,
          created_at
        )
      VALUES
        ($1,$2,$3,$4,$5,NOW())
      RETURNING user_id
    `;
    await client.query(insertMentee, [
      userId,
      education_qualification_id,
      current_job_role_id,
      expected_job_role_id,
      experience_years
    ]);

    await client.query('COMMIT');
    return res.status(201).json({ menteeUserId: userId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in /mentees/signup:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});


export default router;
