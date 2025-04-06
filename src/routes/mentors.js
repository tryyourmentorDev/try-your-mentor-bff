// src/routes/mentors.js
import { Router } from 'express';
import { pool } from '../lib/db.js'; // your DB connection pool
// import { requireAdmin } from '../middlewares/auth.js'; // if you have admin-check middleware

const router = Router();


/**
 * POST /mentors/signup
 * Creates a new mentor profile by inserting a record in the users table
 * and then inserting a corresponding record in the mentors table.
 * Expects JSON body with:
 *   email, full_name, bio, rating, status, mentor_type, level_of_service, charge
 * Note: password_hash is not provided from the client. We store a dummy value.
 */
router.post('/signup', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {
      email,
      full_name,
      bio,
      rating,
      status,
      mentor_type,
      level_of_service,
      charge,
    } = req.body;

    // Use a dummy password hash since it's not provided
    const dummyPassword = 'dummy';

    // Insert into the users table with role 'mentor'
    const insertUserQuery = `
      INSERT INTO users (email, password_hash, full_name, role, created_at)
      VALUES ($1, $2, $3, 'mentor', NOW())
      RETURNING id
    `;
    const userResult = await client.query(insertUserQuery, [
      email,
      dummyPassword,
      full_name,
    ]);
    const userId = userResult.rows[0].id;

    // Insert into the mentors table using the new user's id
    const insertMentorQuery = `
      INSERT INTO mentors (user_id, bio, rating, status, mentor_type, level_of_service, charge, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING user_id
    `;
    await client.query(insertMentorQuery, [
      userId,
      bio,
      rating,
      status,
      mentor_type,
      level_of_service,
      charge,
    ]);

    await client.query('COMMIT');
    return res.status(201).json({ mentorUserId: userId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating mentor:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * POST /mentors
 * Creates a new mentor profile or "elevates" an existing user to a mentor.
 * You must ensure the user is in the 'users' table first.
 */
router.post('/', async (req, res) => {
  try {
    const {
      user_id,        // an existing user ID
      bio,
      rating,
      status,
      mentor_type,
      level_of_service,
      charge
    } = req.body;

    // Insert into 'mentors' table
    const query = `
      INSERT INTO mentors (
        user_id,
        bio,
        rating,
        status,
        mentor_type,
        level_of_service,
        charge,
        created_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, NOW()
      )
      RETURNING user_id
    `;
    const values = [
      user_id, bio, rating, status, mentor_type, level_of_service, charge
    ];

    const result = await pool.query(query, values);

    return res.status(201).json({ mentorUserId: result.rows[0].user_id });
  } catch (error) {
    console.error('Error creating mentor:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /mentors
 * Lists mentors. We can handle optional query params for filtering:
 * e.g. ?status=active&mentor_type=career_guidance
 */
router.get('/', async (req, res) => {
  try {
    const { status, mentor_type } = req.query;

    // Build a WHERE clause dynamically
    const conditions = [];
    const values = [];
    let index = 1;

    if (status) {
      conditions.push(`status = $${index++}`);
      values.push(status);
    }
    if (mentor_type) {
      conditions.push(`mentor_type = $${index++}`);
      values.push(mentor_type);
    }

    let selectQuery = `
      SELECT user_id, bio, rating, status, mentor_type, level_of_service, charge, created_at
      FROM mentors
    `;
    if (conditions.length > 0) {
      selectQuery += ' WHERE ' + conditions.join(' AND ');
    }
    selectQuery += ' ORDER BY user_id';

    const result = await pool.query(selectQuery, values);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error listing mentors:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /mentors/:user_id
 * Retrieves a single mentor's record, possibly includes joined data (like qualifications).
 */
router.get('/:user_id', async (req, res) => {
  try {
    const userId = parseInt(req.params.user_id, 10);

    const query = `
      SELECT user_id, bio, rating, status, mentor_type, level_of_service, charge, created_at
      FROM mentors
      WHERE user_id = $1
    `;
    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mentor not found' });
    }

    // If you also want to fetch qualifications or expertises, you can do additional queries or a join.

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching mentor:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /mentors/:user_id
 * Updates an existing mentor's details fully (or use PATCH for partial).
 */
router.put('/:user_id', async (req, res) => {
  try {
    const userId = parseInt(req.params.user_id, 10);
    const {
      bio,
      rating,
      status,
      mentor_type,
      level_of_service,
      charge
    } = req.body;

    // Overwrite all fields
    const updateQuery = `
      UPDATE mentors
      SET
        bio = $1,
        rating = $2,
        status = $3,
        mentor_type = $4,
        level_of_service = $5,
        charge = $6
      WHERE user_id = $7
      RETURNING user_id, bio, rating, status, mentor_type, level_of_service, charge
    `;
    const values = [bio, rating, status, mentor_type, level_of_service, charge, userId];

    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mentor not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating mentor:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /mentors/:user_id
 * Removes a mentor record. Usually admin-only.
 */
// router.delete('/:user_id', requireAdmin, async (req, res) => {
router.delete('/:user_id', async (req, res) => {
  try {
    const userId = parseInt(req.params.user_id, 10);

    const deleteQuery = `
      DELETE FROM mentors
      WHERE user_id = $1
      RETURNING user_id
    `;
    const result = await pool.query(deleteQuery, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mentor not found' });
    }

    return res.json({ success: true, deletedUserId: result.rows[0].user_id });
  } catch (error) {
    console.error('Error deleting mentor:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /mentors/:user_id/approve
 * Approves a mentor (set status = 'active')
 */
router.patch('/:user_id/approve', async (req, res) => {
  try {
    const userId = parseInt(req.params.user_id, 10);

    const updateQuery = `
      UPDATE mentors
      SET status = 'active'
      WHERE user_id = $1
      RETURNING user_id, status
    `;
    const result = await pool.query(updateQuery, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mentor not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error approving mentor:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
