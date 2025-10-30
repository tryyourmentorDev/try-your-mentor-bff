CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Prevent overlapping reserved bookings for the same mentor
ALTER TABLE mentor_bookings
  ADD CONSTRAINT mentor_bookings_no_overlap
  EXCLUDE USING gist (
    mentor_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (status = 'reserved');
