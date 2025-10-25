import { Router } from 'express';
import { pool } from '../lib/db.js';

const router = Router();

const experienceLevelMapping = [
  { label: 'student/entry level', years: 0 },
  { label: 'junior', years: 1 },
  { label: 'mid-level', years: 3 },
  { label: 'senior', years: 6 },
  { label: 'mid senior', years: 8 },
  { label: 'executive', years: 11 },
];

const mapExperienceLevelToYears = (experienceLevel) => {
  if (!experienceLevel) return 0;
  const normalized = experienceLevel.toLowerCase();

  for (const { label, years } of experienceLevelMapping) {
    if (normalized.includes(label)) {
      return years;
    }
  }

  const numeric = Number.parseInt(normalized, 10);
  return Number.isNaN(numeric) ? 0 : numeric;
};

const toFrontendMentor = (record) => {
  const fullName = [record.first_name, record.last_name].filter(Boolean).join(' ').trim();
  const experienceLabel =
    record.level_of_service ??
    (record.experience_years != null ? `${record.experience_years} years` : '');

  return {
    id: String(record.mentor_id),
    name: fullName || 'Mentor',
    title: record.job_role_name ?? '',
    company: record.company ?? '',
    expertise: Array.isArray(record.expertise) ? record.expertise : [],
    experience: experienceLabel,
    rating: record.rating != null ? Number(record.rating) : 0,
    reviewCount: record.review_count != null ? Number(record.review_count) : 0,
    availability: record.availability ?? '',
    location: record.location ?? '',
    languages: Array.isArray(record.languages) ? record.languages : [],
    bio: record.bio ?? '',
    achievements: Array.isArray(record.achievements) ? record.achievements : [],
    image: record.image ?? '',
    industry: record.industry ?? '',
    unavailableDateTime:
      typeof record.unavailable_date_time === 'object' && record.unavailable_date_time !== null
        ? record.unavailable_date_time
        : {},
    workingHours: record.working_hours ?? null,
    workingDays: Array.isArray(record.working_days) ? record.working_days : [],
  };
};

/**
 * POST /matching
 * Accepts a mentee profile payload and optional filters to fetch matching mentors
 */
router.post('/', async (req, res) => {
  console.log('POST /matching payload:', JSON.stringify(req.body));

  const { mentee } = req.body ?? {};

  if (!mentee) {
    return res.status(400).json({ error: 'Mentee payload is required' });
  }

  const { industryId, jobRoleId, educationLevelId, experienceLevel } = mentee;

  if (
    industryId === undefined ||
    jobRoleId === undefined ||
    educationLevelId === undefined
  ) {
    return res.status(400).json({
      error: 'industryId, jobRoleId, and educationLevelId are required for matching',
    });
  }

  const experienceYears = mapExperienceLevelToYears(experienceLevel);

  try {
    console.log('Calling match_mentors_for_mentee with params:', {
      educationLevelId,
      jobRoleId,
      industryId,
      experienceYears,
    });

    const { rows } = await pool.query(
      'SELECT * FROM match_mentors_for_mentee($1, $2, $3, $4)',
      [educationLevelId, jobRoleId, industryId, experienceYears]
    );

    const mentors = rows.map(toFrontendMentor);

    return res.json({
      mentors,
      total: mentors.length,
    });
  } catch (error) {
    console.error('Matching query failed:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /matching/:mentee_id
 * Returns a sorted list of matching mentors for a given mentee
 */
router.get('/:mentee_id', async (req, res) => {
  const menteeId = parseInt(req.params.mentee_id, 10);
  if (isNaN(menteeId)) return res.status(400).json({ error: 'Invalid mentee ID' });

  try {
    console.log('GET /matching/:mentee_id params:', menteeId);

    const { rows: menteeRows } = await pool.query(
      `
        SELECT
          m.education_qualification_id AS qualification_id,
          m.current_job_role_id AS job_role_id,
          COALESCE(qi.industry_id, jri.industry_id) AS industry_id,
          m.experience_years
        FROM mentees m
        LEFT JOIN qualification_industries qi ON qi.qualification_id = m.education_qualification_id
        LEFT JOIN jobrole_industries jri ON jri.jobrole_id = m.current_job_role_id
        WHERE m.user_id = $1
        LIMIT 1;
      `,
      [menteeId]
    );

    if (menteeRows.length === 0) {
      return res.status(404).json({ error: 'Mentee not found' });
    }

    const menteeRecord = menteeRows[0];

    if (
      menteeRecord.qualification_id == null ||
      menteeRecord.job_role_id == null ||
      menteeRecord.industry_id == null
    ) {
      return res.status(400).json({
        error: 'Mentee record is missing qualification, job role, or industry information',
      });
    }

    const experienceYears =
      typeof menteeRecord.experience_years === 'number'
        ? menteeRecord.experience_years
        : mapExperienceLevelToYears(menteeRecord.experience_years);

    console.log('Calling match_mentors_for_mentee with params:', {
      educationLevelId: menteeRecord.qualification_id,
      jobRoleId: menteeRecord.job_role_id,
      industryId: menteeRecord.industry_id,
      experienceYears,
    });

    const { rows } = await pool.query(
      'SELECT * FROM match_mentors_for_mentee($1, $2, $3, $4)',
      [
        menteeRecord.qualification_id,
        menteeRecord.job_role_id,
        menteeRecord.industry_id,
        experienceYears ?? 0,
      ]
    );

    const mentors = rows.map(toFrontendMentor);
    return res.json({
      mentors,
      total: mentors.length,
    });
  } catch (error) {
    console.error('Matching query failed:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
