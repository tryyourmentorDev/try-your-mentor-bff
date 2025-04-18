// src/routes/mentors.js
import { Router } from 'express';
import { pool } from '../lib/db.js'; // your DB connection pool
// import { requireAdmin } from '../middlewares/auth.js'; // if you have admin-check middleware

const router = Router();


/**
 * POST /mentors/signup
 * Creates both a user and a mentor in one transaction.
 * Expects JSON body with any of:
 *  - first_name        (string, required)
 *  - last_name         (string, required)
 *  - email             (string, required)
 *  - job_role_id       (int, optional)
 *  - highest_qualification (int, optional)
 *  - experience_years  (int, optional)
 *  - bio               (string, optional)
 *  - mentor_type       (string, optional)
 *  - level_of_service  (string, optional)
 *  - charge            (numeric, optional)
 *  - rating            (numeric, optional)
 *  - status            (string, optional)
 */
router.post('/signup', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      first_name,
      last_name,
      email,
      job_role_id = null,
      highest_qualification = null,
      experience_years = null,
      bio = null,
      mentor_type = null,
      level_of_service = null,
      charge = null,
      rating = null,
      status = 'approval_pending'
    } = req.body;

    const dummyPassword = 'dummy';

    // 1) Create user
    const insertUser = `
      INSERT INTO users
        (email, password_hash, first_name, last_name, role, created_at)
      VALUES ($1, $2, $3, $4, 'mentor', NOW())
      RETURNING id
    `;
    const { rows: [u] } = await client.query(insertUser, [
      email,
      dummyPassword,
      first_name,
      last_name
    ]);
    const userId = u.id;

    // 2) Create mentor profile
    const insertMentor = `
      INSERT INTO mentors
        (
          user_id,
          bio,
          rating,
          status,
          mentor_type,
          level_of_service,
          charge,
          experience_years,
          job_role_id,
          highest_qualification,
          created_at
        )
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
      RETURNING user_id
    `;
    await client.query(insertMentor, [
      userId,
      bio,
      rating,
      status,
      mentor_type,
      level_of_service,
      charge,
      experience_years,
      job_role_id,
      highest_qualification
    ]);

    await client.query('COMMIT');
    return res.status(201).json({ mentorUserId: userId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in /mentors/signup:', err);
    return res.status(500).json({ error: 'Internal server error', err });
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
 * GET /mentors/all
 * Returns every mentor along with:
 *  - user info (first_name, last_name, email)
 *  - mentor profile (bio, rating, status, etc.)
 *  - aggregated qualifications & expertises
 *  - experience_years
 *  - job role (name)
 *  - highest qualification (name)
 */
router.get('/all', async (req, res) => {
  try {
    const query = `
      SELECT
        m.user_id,
        u.email,
        u.first_name,
        u.last_name,
        m.bio,
        m.rating,
        m.status,
        m.mentor_type,
        m.level_of_service,
        m.charge,
        m.experience_years,
        jr.id AS job_role_id,
        jr.name AS job_role,
        hq.id AS highest_qualification_id,
        hq.name AS highest_qualification,
        m.created_at
      FROM mentors m
      JOIN users u
        ON u.id = m.user_id
      LEFT JOIN job_roles jr
        ON jr.id = m.job_role_id
      LEFT JOIN qualifications hq
        ON hq.id = m.highest_qualification
      LEFT JOIN mentor_qualifications mq
        ON mq.mentor_id = m.user_id
      LEFT JOIN qualifications q
        ON q.id = mq.qualification_id
      LEFT JOIN mentor_expertises me
        ON me.mentor_id = m.user_id
      LEFT JOIN expertises e
        ON e.id = me.expertise_id
      GROUP BY
        m.user_id,
        u.email,
        u.first_name,
        u.last_name,
        m.bio,
        m.rating,
        m.status,
        m.mentor_type,
        m.level_of_service,
        m.charge,
        m.experience_years,
        jr.id,
        hq.id,
        jr.name,
        hq.name,
        m.created_at
      ORDER BY m.user_id;
    `;

    const { rows } = await pool.query(query);
    return res.json(rows);
  } catch (error) {
    console.error('Error fetching detailed mentor list:', error);
    return res.status(500).json({ error: 'Internal server error', error });
  }
});

/**
 * GET /mentors/:user_id
 * Retrieves a single mentor's full profile, including:
 *  - user email, first_name, last_name
 *  - mentor fields (bio, rating, status, etc.)
 *  - experience_years
 *  - job_role (name)
 *  - highest_qualification (name)
 *  - qualifications[] (array of names)
 *  - expertises[] (array of names)
 */
router.get('/:user_id', async (req, res) => {
  try {
    const userId = parseInt(req.params.user_id, 10);

    const query = `
      SELECT
        m.user_id,
        u.email,
        u.first_name,
        u.last_name,
        m.bio,
        m.rating,
        m.status,
        m.mentor_type,
        m.level_of_service,
        m.charge,
        m.experience_years,
        jr.id   AS job_role_id,
        jr.name   AS job_role,
        hq.id   AS highest_qualification_id,
        hq.name   AS highest_qualification,
        m.created_at
      FROM mentors m
      JOIN users u
        ON u.id = m.user_id
      LEFT JOIN job_roles jr
        ON jr.id = m.job_role_id
      LEFT JOIN qualifications hq
        ON hq.id = m.highest_qualification
      LEFT JOIN mentor_qualifications mq
        ON mq.mentor_id = m.user_id
      LEFT JOIN qualifications q
        ON q.id = mq.qualification_id
      LEFT JOIN mentor_expertises me
        ON me.mentor_id = m.user_id
      LEFT JOIN expertises e
        ON e.id = me.expertise_id
      WHERE m.user_id = $1
      GROUP BY
        m.user_id,
        u.email,
        u.first_name,
        u.last_name,
        m.bio,
        m.rating,
        m.status,
        m.mentor_type,
        m.level_of_service,
        m.charge,
        m.experience_years,
        jr.id,
        hq.id,
        jr.name,
        hq.name,
        m.created_at;
    `;

    const { rows } = await pool.query(query, [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Mentor not found' });
    }

    return res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching mentor:', error);
    return res.status(500).json({ error: 'Internal server error', error });
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
