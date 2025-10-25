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
  experience_years INT,
  charge NUMERIC,
  level_of_service VARCHAR,
  qualification_id INT,
  qualification_name VARCHAR,
  mentor_qual_rank INT,
  job_role_id INT,
  job_role_name VARCHAR,
  mentor_job_rank INT,
  match_score NUMERIC
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
      jri.industry_id AS job_industry
    FROM mentors mt
    JOIN users u ON u.id = mt.user_id
    LEFT JOIN qualifications q ON q.id = mt.highest_qualification_id
    LEFT JOIN qualification_industries qi ON qi.qualification_id = q.id
    LEFT JOIN job_roles jr ON jr.id = mt.job_role_id
    LEFT JOIN jobrole_industries jri ON jri.jobrole_id = jr.id
  )
  SELECT
    m.mentor_id,
    m.first_name,
    m.last_name,
    m.experience_years,
    m.charge,
    m.level_of_service,
    m.qualification_id,
    m.qualification_name,
    m.mentor_qual_rank,
    m.job_role_id,
    m.job_role_name,
    m.mentor_job_rank,
    (
      (m.experience_years - md.experience_years) * 1.0 +
      (m.mentor_qual_rank - md.mentee_qual_rank) * 1.5 +
      (m.mentor_job_rank - md.mentee_job_rank) * 1.2
    )::numeric AS match_score
  FROM mentor_matches m
  JOIN mentee_data md ON TRUE
  WHERE
    md.experience_years IS NOT NULL
    AND m.experience_years >= md.experience_years + 2
    AND m.mentor_qual_rank > md.mentee_qual_rank
    AND m.mentor_job_rank > md.mentee_job_rank
    AND m.qual_industry = md.mentee_industry_id
    AND m.job_industry = md.mentee_industry_id
  ORDER BY match_score DESC;
END;
$$ LANGUAGE plpgsql;
