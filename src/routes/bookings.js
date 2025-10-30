import { Router } from 'express';
import { DateTime } from 'luxon';
import { put } from '@vercel/blob';
import { pool } from '../lib/db.js';

const router = Router();

const normalizeTime = (date, time, timezone) => {
  return DateTime.fromISO(`${date}T${time}`, { zone: timezone }).toUTC();
};

const toLocalSlot = (startDateTime, durationMinutes, timezone) => {
  const startLocal = startDateTime.setZone(timezone ?? 'UTC');
  const endLocal = startLocal.plus({ minutes: durationMinutes });

  return {
    date: startLocal.toISODate(),
    start: startLocal.toFormat('HH:mm'),
    end: endLocal.toFormat('HH:mm'),
  };
};

const extractBase64Payload = (base64String) => {
  if (!base64String) return null;
  const commaIndex = base64String.indexOf(',');
  return commaIndex !== -1 ? base64String.slice(commaIndex + 1) : base64String;
};

const uploadResume = async (mentorId, userId, cvPayload) => {
  if (!cvPayload?.base64) {
    return null;
  }

  if (!process.env.VERCEL_BLOB_RW_TOKEN) {
    throw new Error('Resume upload unavailable. Please try again later.');
  }

  const base64Data = extractBase64Payload(cvPayload.base64);
  const buffer = Buffer.from(base64Data, 'base64');

  const sanitizedFileName = cvPayload.fileName
    ? cvPayload.fileName.replace(/\s+/g, '-')
    : `resume-${userId}.pdf`;

  const key = `resumes/${mentorId}/${Date.now()}-${sanitizedFileName}`;

  const blob = await put(key, buffer, {
    access: 'public',
    contentType: cvPayload.mimeType ?? 'application/octet-stream',
    token: process.env.VERCEL_BLOB_RW_TOKEN,
  });

  return blob.url;
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

    let resumeUrl = null;
    if (booking.cv) {
      resumeUrl = await uploadResume(mentorIdParam, userId, booking.cv);
      if (resumeUrl) {
        await client.query(
          `
            INSERT INTO resumes (user_id, file_url, file_name)
            VALUES ($1, $2, $3);
          `,
          [userId, resumeUrl, booking.cv.fileName ?? null]
        );
      }
    }

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
          AND status IN ('reserved', 'completed')
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

    const { date: bookingDate, start: bookingStart, end: bookingEnd } = toLocalSlot(
      startDateTime,
      60,
      booking.timezone ?? 'UTC'
    );

    await client.query(
      `
        INSERT INTO mentor_time_exceptions (
          mentor_id,
          exception_type,
          exception_date,
          start_time,
          end_time,
          note
        )
        VALUES ($1, 'unavailable', $2, $3::time, $4::time, $5)
      `,
      [
        mentorIdParam,
        bookingDate,
        bookingStart,
        bookingEnd,
        `Booking ID ${bookingResult.rows[0].mentor_booking_id}`,
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
    if (error.code === '23P01' || error.code === '23505') {
      return res.status(409).json({
        message: 'This time slot is no longer available. Please choose another time.',
      });
    }
    return res.status(500).json({
      message: error.message ?? 'Failed to create booking. Please try again.',
    });
  } finally {
    client.release();
  }
});

export default router;
