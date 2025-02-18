import { Router } from 'express';
import { pool } from '../lib/db.js';

const router = Router();

/**
 * POST /industries
 * Create a new industry
 */
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    const insertQuery = `
      INSERT INTO industries (name)
      VALUES ($1)
      RETURNING id, name
    `;
    const result = await pool.query(insertQuery, [name]);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating industry:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /industries
 * List all industries
 */
router.get('/', async (req, res) => {
  try {
    const selectQuery = `
      SELECT id, name
      FROM industries
      ORDER BY id
    `;
    const result = await pool.query(selectQuery);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error listing industries:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /industries/:id
 * Update an industry
 */
router.put('/:id', async (req, res) => {
  try {
    const industryId = parseInt(req.params.id, 10);
    const { name } = req.body;

    const updateQuery = `
      UPDATE industries
      SET name = $1
      WHERE id = $2
      RETURNING id, name
    `;
    const result = await pool.query(updateQuery, [name, industryId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Industry not found' });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating industry:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /industries/:id
 * Remove an industry
 */
router.delete('/:id', async (req, res) => {
  try {
    const industryId = parseInt(req.params.id, 10);

    const deleteQuery = `
      DELETE FROM industries
      WHERE id = $1
      RETURNING id
    `;
    const result = await pool.query(deleteQuery, [industryId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Industry not found' });
    }
    return res.json({ success: true, deletedId: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting industry:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * For bridging: qualification_industries, jobrole_industries
 * e.g. POST /industries/:id/qualifications => add link
 *      DELETE /industries/:id/qualifications/:qual_id => remove link
 */

// POST /industries/:id/qualifications
router.post('/:id/qualifications', async (req, res) => {
  try {
    const industryId = parseInt(req.params.id, 10);
    const { qualification_id } = req.body;

    const insertQuery = `
      INSERT INTO qualification_industries (industry_id, qualification_id)
      VALUES ($1, $2)
      RETURNING industry_id, qualification_id
    `;
    const result = await pool.query(insertQuery, [industryId, qualification_id]);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error linking qualification to industry:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /industries/:id/qualifications/:qual_id
router.delete('/:id/qualifications/:qual_id', async (req, res) => {
  try {
    const industryId = parseInt(req.params.id, 10);
    const qualId = parseInt(req.params.qual_id, 10);

    const deleteQuery = `
      DELETE FROM qualification_industries
      WHERE industry_id = $1 AND qualification_id = $2
      RETURNING industry_id, qualification_id
    `;
    const result = await pool.query(deleteQuery, [industryId, qualId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }
    return res.json({ success: true, removed: result.rows[0] });
  } catch (error) {
    console.error('Error removing link:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Similarly, you can do for jobrole_industries:
 * POST /industries/:id/job-roles
 * DELETE /industries/:id/job-roles/:role_id
 */

// POST /industries/:id/job-roles
router.post('/:id/job-roles', async (req, res) => {
  try {
    const industryId = parseInt(req.params.id, 10);
    const { jobrole_id } = req.body;

    const insertQuery = `
      INSERT INTO jobrole_industries (industry_id, jobrole_id)
      VALUES ($1, $2)
      RETURNING industry_id, jobrole_id
    `;
    const result = await pool.query(insertQuery, [industryId, jobrole_id]);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error linking job role to industry:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /industries/:id/job-roles/:role_id
router.delete('/:id/job-roles/:role_id', async (req, res) => {
  try {
    const industryId = parseInt(req.params.id, 10);
    const roleId = parseInt(req.params.role_id, 10);

    const deleteQuery = `
      DELETE FROM jobrole_industries
      WHERE industry_id = $1 AND jobrole_id = $2
      RETURNING industry_id, jobrole_id
    `;
    const result = await pool.query(deleteQuery, [industryId, roleId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }
    return res.json({ success: true, removed: result.rows[0] });
  } catch (error) {
    console.error('Error removing link:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
