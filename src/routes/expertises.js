// src/routes/expertises.js
import { Router } from 'express';
import { pool } from '../lib/db.js';

const router = Router();

/**
 * POST /expertises
 * Create a new expertise (admin-only, if desired)
 */
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    const insertQuery = `
      INSERT INTO expertises (name, description)
      VALUES ($1, $2)
      RETURNING id, name, description
    `;
    const result = await pool.query(insertQuery, [name, description]);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating expertise:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /expertises
 * List all expertises
 */
router.get('/', async (req, res) => {
  try {
    const selectQuery = `
      SELECT id, name, description
      FROM expertises
      ORDER BY id
    `;
    const result = await pool.query(selectQuery);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error listing expertises:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /expertises/:id
 * Update an expertise
 */
router.put('/:id', async (req, res) => {
  try {
    const expertiseId = parseInt(req.params.id, 10);
    const { name, description } = req.body;

    const updateQuery = `
      UPDATE expertises
      SET name = $1, description = $2
      WHERE id = $3
      RETURNING id, name, description
    `;
    const result = await pool.query(updateQuery, [name, description, expertiseId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expertise not found' });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating expertise:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /expertises/:id
 * Remove an expertise (admin-only, if needed)
 */
router.delete('/:id', async (req, res) => {
  try {
    const expertiseId = parseInt(req.params.id, 10);
    const deleteQuery = `
      DELETE FROM expertises
      WHERE id = $1
      RETURNING id
    `;
    const result = await pool.query(deleteQuery, [expertiseId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expertise not found' });
    }
    return res.json({ success: true, deletedId: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting expertise:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
