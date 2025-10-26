import { Router } from 'express';
import { pool } from '../lib/db.js';

const router = Router();

const formatRelativeTime = (date) => {
  if (!date) return null;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 0) {
    return 'Just now';
  }

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'Just now';

  const intervals = [
    { label: 'year', seconds: 60 * 60 * 24 * 365 },
    { label: 'month', seconds: 60 * 60 * 24 * 30 },
    { label: 'week', seconds: 60 * 60 * 24 * 7 },
    { label: 'day', seconds: 60 * 60 * 24 },
    { label: 'hour', seconds: 60 * 60 },
    { label: 'minute', seconds: 60 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) {
      return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
    }
  }

  return 'Just now';
};

/**
 * GET /mentor-reviews/:mentorId
 * Returns reviews for a given mentor along with total count.
 */
router.get('/:mentorId', async (req, res) => {
  const mentorId = Number.parseInt(req.params.mentorId, 10);
  if (Number.isNaN(mentorId)) {
    return res.status(400).json({ error: 'Invalid mentor id' });
  }

  try {
    const { rows } = await pool.query(
      `
        SELECT
          mr.id,
          mr.rating,
          mr.review,
          mr.created_at,
          COALESCE(mr.mentee_name, CONCAT_WS(' ', u.first_name, u.last_name)) AS mentee_name
        FROM mentor_reviews mr
        LEFT JOIN users u ON u.id = mr.mentee_id
        WHERE mr.mentor_id = $1
        ORDER BY mr.created_at DESC;
      `,
      [mentorId]
    );

    const reviews = rows.map((row) => {
      const createdAt = row.created_at ? new Date(row.created_at) : null;
      return {
        id: row.id,
        name: row.mentee_name?.trim() || 'Anonymous mentee',
        rating: Number(row.rating) || 0,
        comment: row.review ?? '',
        date: createdAt ? formatRelativeTime(createdAt) : null,
        createdAt: createdAt ? createdAt.toISOString() : null,
      };
    });

    return res.json({
      reviews,
      total: reviews.length,
    });
  } catch (error) {
    console.error('Failed to fetch mentor reviews:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
