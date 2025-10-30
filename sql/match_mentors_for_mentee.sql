CREATE OR REPLACE FUNCTION match_mentors_for_mentee(
  p_qualification_id INT,
  p_job_role_id INT,
  p_industry_id INT,
  p_experience_years INT
)
RETURNS TABLE (
  mentor_id INT,
  first_name VARCHAR,
  last_name VARCHAR,
  bio TEXT,
  image VARCHAR,
  company VARCHAR,
  expertise VARCHAR[],
  experience_years INT,
  charge NUMERIC,
  level_of_service VARCHAR,
  qualification_id INT,
  qualification_name VARCHAR,
  mentor_qual_rank INT,
  job_role_id INT,
  job_role_name VARCHAR,
  mentor_job_rank INT,
  rating NUMERIC,
  review_count BIGINT,
  match_score numeric,
  location VARCHAR,
  languages VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  WITH mentee_data AS (
    SELECT
      p_experience_years AS experience_years,
      q.rank AS mentee_qual_rank,
      jr.rank AS mentee_job_rank,
      p_industry_id AS mentee_industry_id
    FROM qualifications q
    JOIN qualification_industries qi ON qi.qualification_id = q.id
    JOIN job_roles jr ON jr.id = p_job_role_id
    JOIN jobrole_industries jri ON jri.jobrole_id = jr.id
    WHERE
      q.id = p_qualification_id
      AND qi.industry_id = p_industry_id
      AND jri.industry_id = p_industry_id
    LIMIT 1
  ),
  mentor_matches AS (
    SELECT
      mt.user_id AS mentor_id,
      u.first_name,
      u.last_name,
      mt.bio,
      mt.profile_image_url AS image,
      mt.company,
      COALESCE(me_data.expertise, ARRAY[]::text[]) AS expertise,
      mt.experience_years,
      mt.charge,
      mt.level_of_service,
      q.id AS qualification_id,
      q.name AS qualification_name,
      q.rank AS mentor_qual_rank,
      jr.id AS job_role_id,
      jr.name AS job_role_name,
      jr.rank AS mentor_job_rank,
      qi.industry_id AS qual_industry,
      jri.industry_id AS job_industry,
      COALESCE(mra.rating, 0)::numeric(3,2) AS rating,
      COALESCE(mra.review_count, 0) AS review_count,
      mt.location,
      mt.languages
    FROM mentors mt
    JOIN users u ON u.id = mt.user_id
    LEFT JOIN qualifications q ON q.id = mt.highest_qualification
    LEFT JOIN qualification_industries qi ON qi.qualification_id = q.id
    LEFT JOIN job_roles jr ON jr.id = mt.job_role_id
    LEFT JOIN jobrole_industries jri ON jri.jobrole_id = jr.id
	LEFT JOIN LATERAL (
	      SELECT ARRAY_AGG(e.name ORDER BY e.name) AS expertise
	      FROM mentor_expertises me
	      JOIN expertises e ON e.id = me.expertise_id
	      WHERE me.mentor_id = mt.user_id
	    ) me_data ON TRUE
    LEFT JOIN (
      SELECT
        mentor_reviews.mentor_id,
        AVG(mentor_reviews.rating)::numeric(3,2) AS rating,
        COUNT(*) AS review_count
      FROM mentor_reviews
      GROUP BY mentor_reviews.mentor_id
    ) mra ON mra.mentor_id = mt.user_id
  )
  SELECT
    m.mentor_id,
    m.first_name,
    m.last_name,
    m.bio,
    m.image,
    m.company,
    m.expertise,
    m.experience_years,
    m.charge,
    m.level_of_service,
    m.qualification_id,
    m.qualification_name,
    m.mentor_qual_rank,
    m.job_role_id,
    m.job_role_name,
    m.mentor_job_rank,
    m.rating,
    m.review_count,
    
    (
      (m.experience_years - md.experience_years) * 1.0 +
      (m.mentor_qual_rank - md.mentee_qual_rank) * 1.5 +
      (m.mentor_job_rank - md.mentee_job_rank) * 1.2
    )::numeric AS match_score,
    m.location,
    m.languages
  FROM mentor_matches m
  JOIN mentee_data md ON TRUE
  WHERE
--    md.experience_years IS NOT NULL
--    AND m.experience_years >= md.experience_years + 2
--    AND m.mentor_qual_rank > md.mentee_qual_rank
--    AND m.mentor_job_rank > md.mentee_job_rank
--    AND m.qual_industry = md.mentee_industry_id
     m.job_industry = md.mentee_industry_id
  ORDER BY match_score DESC;
END;
$$ LANGUAGE plpgsql;