import { Router } from 'express';
import { pool } from '../lib/db.js';

const router = Router();

/**
 * POST /resumes
 * Upload new resume, link to user_id
 * e.g. { user_id: 42, file_url: "...", file_name: "resume.pdf" }
 */
router.post('/', async (req, res) => {
  try {
    const { user_id, file_url, file_name } = req.body;
    const insertQuery = `
      INSERT INTO resumes (user_id, file_url, file_name, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING id, user_id, file_url, file_name, created_at
    `;
    const result = await pool.query(insertQuery, [user_id, file_url, file_name]);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating resume:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /resumes
 * If admin => list all, else filter by user
 * or do a query param ?user_id=42
 */
router.get('/', async (req, res) => {
  try {
    const { user_id } = req.query;
    const conditions = [];
    const values = [];
    let index = 1;

    if (user_id) {
      conditions.push(`user_id = $${index++}`);
      values.push(user_id);
    }

    let selectQuery = `
      SELECT id, user_id, file_url, file_name, created_at
      FROM resumes
    `;
    if (conditions.length > 0) {
      selectQuery += ' WHERE ' + conditions.join(' AND ');
    }
    selectQuery += ' ORDER BY id';

    const result = await pool.query(selectQuery, values);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error listing resumes:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /resumes/:id
 * Retrieve a single resume by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const resumeId = parseInt(req.params.id, 10);

    const selectQuery = `
      SELECT id, user_id, file_url, file_name, created_at
      FROM resumes
      WHERE id = $1
    `;
    const result = await pool.query(selectQuery, [resumeId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching resume:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /resumes/:id
 * Remove a resume (owner or admin).
 */
router.delete('/:id', async (req, res) => {
  try {
    const resumeId = parseInt(req.params.id, 10);

    const deleteQuery = `
      DELETE FROM resumes
      WHERE id = $1
      RETURNING id
    `;
    const result = await pool.query(deleteQuery, [resumeId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Resume not found' });
    }
    return res.json({ success: true, deletedResumeId: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting resume:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * For reviews:
 * POST /resumes/:id/reviews
 * GET /resumes/:id/reviews
 * PUT /resumes/:id/reviews/:review_id
 * DELETE /resumes/:id/reviews/:review_id
 */

// 1) POST a review
router.post('/:id/reviews', async (req, res) => {
  try {
    const resumeId = parseInt(req.params.id, 10);
    const { mentor_id, feedback, rating } = req.body;

    const insertQuery = `
      INSERT INTO resume_reviews (resume_id, mentor_id, feedback, rating, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, resume_id, mentor_id, feedback, rating, created_at
    `;
    const result = await pool.query(insertQuery, [resumeId, mentor_id, feedback, rating]);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating review:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 2) GET all reviews for a resume
router.get('/:id/reviews', async (req, res) => {
  try {
    const resumeId = parseInt(req.params.id, 10);
    const selectQuery = `
      SELECT rr.id, rr.resume_id, rr.mentor_id, rr.feedback, rr.rating, rr.created_at
      FROM resume_reviews rr
      WHERE rr.resume_id = $1
      ORDER BY rr.id
    `;
    const result = await pool.query(selectQuery, [resumeId]);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching resume reviews:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 3) PUT /resumes/:id/reviews/:review_id
router.put('/:id/reviews/:review_id', async (req, res) => {
  try {
    const resumeId = parseInt(req.params.id, 10);
    const reviewId = parseInt(req.params.review_id, 10);
    const { feedback, rating } = req.body;

    const updateQuery = `
      UPDATE resume_reviews
      SET feedback = COALESCE($1, feedback),
          rating = COALESCE($2, rating)
      WHERE id = $3 AND resume_id = $4
      RETURNING id, resume_id, mentor_id, feedback, rating, created_at
    `;
    const result = await pool.query(updateQuery, [feedback, rating, reviewId, resumeId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found for that resume' });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating review:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 4) DELETE /resumes/:id/reviews/:review_id
router.delete('/:id/reviews/:review_id', async (req, res) => {
  try {
    const resumeId = parseInt(req.params.id, 10);
    const reviewId = parseInt(req.params.review_id, 10);

    const deleteQuery = `
      DELETE FROM resume_reviews
      WHERE id = $1 AND resume_id = $2
      RETURNING id
    `;
    const result = await pool.query(deleteQuery, [reviewId, resumeId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found for that resume' });
    }
    return res.json({ success: true, deletedReviewId: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting review:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
