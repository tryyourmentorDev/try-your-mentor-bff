// src/routes/jobRoles.js
import { Router } from 'express';
import { pool } from '../lib/db.js';

const router = Router();

/**
 * POST /job-roles
 * Create a job role
 */
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    const insertQuery = `
      INSERT INTO job_roles (name)
      VALUES ($1)
      RETURNING id, name
    `;
    const result = await pool.query(insertQuery, [name]);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating job role:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /job-roles
 * List job roles
 */
router.get('/', async (req, res) => {
  try {
    const selectQuery = `
      SELECT id, name
      FROM job_roles
      ORDER BY id
    `;
    const result = await pool.query(selectQuery);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error listing job roles:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /job-roles/:id
 * Update a job role
 */
router.put('/:id', async (req, res) => {
  try {
    const jobId = parseInt(req.params.id, 10);
    const { name } = req.body;

    const updateQuery = `
      UPDATE job_roles
      SET name = $1
      WHERE id = $2
      RETURNING id, name
    `;
    const result = await pool.query(updateQuery, [name, jobId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job role not found' });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating job role:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /job-roles/:id
 * Remove a job role
 */
router.delete('/:id', async (req, res) => {
  try {
    const jobId = parseInt(req.params.id, 10);

    const deleteQuery = `
      DELETE FROM job_roles
      WHERE id = $1
      RETURNING id
    `;
    const result = await pool.query(deleteQuery, [jobId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job role not found' });
    }
    return res.json({ success: true, deletedId: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting job role:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
