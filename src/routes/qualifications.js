import { Router } from 'express';
import { pool } from '../lib/db.js';
// import { requireAdmin } from '../middlewares/auth.js'; // if admin check

const router = Router();

/**
 * POST /qualifications
 * Admin can add new qualifications
 */
router.post('/', /* requireAdmin, */ async (req, res) => {
  try {
    const { name } = req.body;

    const insertQuery = `
      INSERT INTO qualifications (name)
      VALUES ($1)
      RETURNING id, name
    `;
    const result = await pool.query(insertQuery, [name]);

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating qualification:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /qualifications
 * List all qualifications
 */
router.get('/', async (req, res) => {
  try {
    const selectQuery = `
      SELECT id, name
      FROM qualifications
      ORDER BY id
    `;
    const result = await pool.query(selectQuery);

    return res.json(result.rows);
  } catch (error) {
    console.error('Error listing qualifications:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /qualifications/:id
 * Update a qualification
 */
router.put('/:id', /* requireAdmin, */ async (req, res) => {
  try {
    const qualId = parseInt(req.params.id, 10);
    const { name } = req.body;

    const updateQuery = `
      UPDATE qualifications
      SET name = $1
      WHERE id = $2
      RETURNING id, name
    `;
    const result = await pool.query(updateQuery, [name, qualId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Qualification not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating qualification:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /qualifications/:id
 * Remove a qualification (admin only).
 */
router.delete('/:id', /* requireAdmin, */ async (req, res) => {
  try {
    const qualId = parseInt(req.params.id, 10);

    const deleteQuery = `
      DELETE FROM qualifications
      WHERE id = $1
      RETURNING id
    `;
    const result = await pool.query(deleteQuery, [qualId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Qualification not found' });
    }

    return res.json({ success: true, deletedQualificationId: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting qualification:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
