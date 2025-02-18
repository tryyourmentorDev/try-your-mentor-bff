import { Router } from 'express';
import { pool } from '../lib/db.js';

const router = Router();

/**
 * POST /payments
 * Record a payment for a session
 * Expect: { session_id, amount, status }
 */
router.post('/', async (req, res) => {
  try {
    const { session_id, amount, status } = req.body;

    const insertQuery = `
      INSERT INTO payments (session_id, amount, status, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING id, session_id, amount, status, created_at
    `;
    const result = await pool.query(insertQuery, [session_id, amount, status]);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating payment:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /payments
 * List payments (optionally filter by session_id or status if needed)
 */
router.get('/', async (req, res) => {
  try {
    // e.g. /payments?session_id=10&status=paid
    const { session_id, status } = req.query;
    const conditions = [];
    const values = [];
    let index = 1;

    if (session_id) {
      conditions.push(`session_id = $${index++}`);
      values.push(session_id);
    }
    if (status) {
      conditions.push(`status = $${index++}`);
      values.push(status);
    }

    let selectQuery = `
      SELECT id, session_id, amount, status, created_at
      FROM payments
    `;
    if (conditions.length > 0) {
      selectQuery += ' WHERE ' + conditions.join(' AND ');
    }
    selectQuery += ' ORDER BY id';

    const result = await pool.query(selectQuery, values);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error listing payments:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /payments/:id
 * View single payment
 */
router.get('/:id', async (req, res) => {
  try {
    const paymentId = parseInt(req.params.id, 10);

    const selectQuery = `
      SELECT id, session_id, amount, status, created_at
      FROM payments
      WHERE id = $1
    `;
    const result = await pool.query(selectQuery, [paymentId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching payment:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /payments/:id
 * Update payment status, e.g. "paid", "refunded"
 */
router.put('/:id', async (req, res) => {
  try {
    const paymentId = parseInt(req.params.id, 10);
    const { amount, status } = req.body;

    const updateQuery = `
      UPDATE payments
      SET amount = COALESCE($1, amount),
          status = COALESCE($2, status)
      WHERE id = $3
      RETURNING id, session_id, amount, status, created_at
    `;
    const result = await pool.query(updateQuery, [amount, status, paymentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating payment:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
