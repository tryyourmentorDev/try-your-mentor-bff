// src/routes/users.js
import { Router } from 'express';
import { pool } from '../lib/db.js';  // your DB connection
// import { requireAdmin } from '../middlewares/auth.js';  // if you have an admin check

const router = Router();

/**
 * POST /users
 * Create a new user (or in some apps, you'd do this in auth/signup).
 */
router.post('/', async (req, res) => {
  try {
    const { email, password_hash, full_name, role } = req.body;

    // Example insert
    const insertQuery = `
      INSERT INTO users (email, password_hash, full_name, role, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id
    `;
    const values = [email, password_hash, full_name, role];
    const result = await pool.query(insertQuery, values);

    const newUserId = result.rows[0].id;
    return res.status(201).json({ userId: newUserId });
  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// List all users
router.get('/', async (req, res) => {
  try {
    const selectQuery = `
      SELECT id, email, full_name, role, created_at
      FROM users
      ORDER BY id
    `;
    const result = await pool.query(selectQuery);

    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /users/:id
 * View user details by ID.
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);

    const selectQuery = `
      SELECT id, email, full_name, role, created_at
      FROM users
      WHERE id = $1
    `;
    const result = await pool.query(selectQuery, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /users/:id  (or PUT /users/:id)
 * Edit user details.
 * For a partial update, we typically use PATCH.
 */
router.patch('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);

    // Only update fields that are provided in req.body
    const { email, password_hash, full_name, role } = req.body;

    // Build a dynamic update query
    const fields = [];
    const values = [];
    let index = 1;

    if (email !== undefined) {
      fields.push(`email = $${index++}`);
      values.push(email);
    }
    if (password_hash !== undefined) {
      fields.push(`password_hash = $${index++}`);
      values.push(password_hash);
    }
    if (full_name !== undefined) {
      fields.push(`full_name = $${index++}`);
      values.push(full_name);
    }
    if (role !== undefined) {
      fields.push(`role = $${index++}`);
      values.push(role);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const updateQuery = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${index}
      RETURNING id, email, full_name, role
    `;
    values.push(userId); // for the WHERE clause

    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /users/:id
 * Admin-only user deletion, if your app needs it.
 */
// router.delete('/:id', requireAdmin, async (req, res) => {
router.delete('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);

    const deleteQuery = `
      DELETE FROM users
      WHERE id = $1
      RETURNING id
    `;
    const result = await pool.query(deleteQuery, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ success: true, deletedUserId: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
