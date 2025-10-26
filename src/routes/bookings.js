import { Router } from 'express';
import { DateTime } from 'luxon';
import { pool } from '../lib/db.js';

const router = Router();

const normalizeTime = (date, time, timezone) => {
  return DateTime.fromISO(`${date}T${time}`, { zone: timezone }).toUTC();
};

const createMenteeProfile = async (client, userId, menteePayload) => {
  const {
    educationQualificationId,
    currentJobRoleId,
    expectedJobRoleId,
    experienceYears,
  } = menteePayload;

  await client.query(
    `
      INSERT INTO mentees (
        user_id,
        education_qualification_id,
        current_job_role_id,
        expected_job_role_id,
        experience_years
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id) DO UPDATE
      SET
        education_qualification_id = EXCLUDED.education_qualification_id,
        current_job_role_id = EXCLUDED.current_job_role_id,
        expected_job_role_id = EXCLUDED.expected_job_role_id,
        experience_years = EXCLUDED.experience_years;
    `,
    [
      userId,
      educationQualificationId ?? null,
      currentJobRoleId ?? null,
      expectedJobRoleId ?? null,
      experienceYears ?? null,
    ]
  );
};

router.post('/:mentorId/bookings', async (req, res) => {
  const mentorIdParam = Number.parseInt(req.params.mentorId, 10);
  if (Number.isNaN(mentorIdParam)) {
    return res.status(400).json({ message: 'Invalid mentor id' });
  }

  const { user, mentee, booking } = req.body ?? {};

  if (!user || !mentee || !booking) {
    return res.status(400).json({ message: 'Invalid payload' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `
        INSERT INTO users (email, first_name, last_name, role)
        VALUES ($1, $2, $3, 'mentee')
        ON CONFLICT (email) DO UPDATE
        SET first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name
        RETURNING id;
      `,
      [user.email, user.firstName ?? null, user.lastName ?? null]
    );

    const userId = userResult.rows[0].id;

    await createMenteeProfile(client, userId, mentee);

    const startDateTime = normalizeTime(
      booking.date,
      booking.time,
      booking.timezone ?? 'UTC'
    );
    if (!startDateTime.isValid) {
      throw new Error('Invalid date/time provided');
    }

    const endDateTime = startDateTime.plus({ hours: 1 });

    const existingBookings = await client.query(
      `
        SELECT mentor_booking_id
        FROM mentor_bookings
        WHERE mentor_id = $1
          AND status = 'reserved'
          AND tstzrange(start_time, end_time, '[)') && tstzrange($2, $3, '[)');
      `,
      [mentorIdParam, startDateTime.toSQL(), endDateTime.toSQL()]
    );

    if (existingBookings.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        message: 'This time slot has just been booked. Please choose another time.',
      });
    }

    const bookingResult = await client.query(
      `
        INSERT INTO mentor_bookings (
          mentor_id,
          mentee_id,
          start_time,
          end_time,
          status,
          title,
          notes
        )
        VALUES ($1, $2, $3, $4, 'reserved', $5, $6)
        RETURNING mentor_booking_id, mentor_id, start_time, end_time, status;
      `,
      [
        mentorIdParam,
        userId,
        startDateTime.toSQL(),
        endDateTime.toSQL(),
        'Mentorship session',
        booking.sessionExpectations ?? null,
      ]
    );

    await client.query('COMMIT');

    const savedBooking = bookingResult.rows[0];

    return res.status(201).json({
      bookingId: savedBooking.mentor_booking_id.toString(),
      mentorId: savedBooking.mentor_id.toString(),
      startTime: savedBooking.start_time,
      endTime: savedBooking.end_time,
      status: savedBooking.status,
      message: 'Booking confirmed – check your email for next steps.',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to create booking:', error);
    return res.status(500).json({
      message: error.message ?? 'Failed to create booking. Please try again.',
    });
  } finally {
    client.release();
  }
});

export default router;
