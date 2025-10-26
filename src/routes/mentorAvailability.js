import { Router } from 'express';
import { pool } from '../lib/db.js';

const router = Router();

const formatTime = (time) => {
  if (!time) return null;

  if (time instanceof Date) {
    return time.toISOString().split('T')[1].slice(0, 5);
  }

  if (typeof time === 'string') {
    return time.slice(0, 5);
  }

  return null;
};

router.get('/:mentorId/availability', async (req, res) => {
  const mentorId = Number.parseInt(req.params.mentorId, 10);
  if (Number.isNaN(mentorId)) {
    return res.status(400).json({ error: 'Invalid mentor id' });
  }

  try {
    const { rows: scheduleRows } = await pool.query(
      `
        SELECT weekday, start_time, end_time, timezone
        FROM mentor_weekly_schedule
        WHERE mentor_id = $1
        ORDER BY weekday;
      `,
      [mentorId]
    );

    if (scheduleRows.length === 0) {
      return res.json({
        workingHours: null,
        workingDays: [],
        unavailableDateTime: {},
      });
    }

    const workingDays = scheduleRows.map((row) => row.weekday);
    const startTimes = scheduleRows.map((row) => formatTime(row.start_time)).filter(Boolean);
    const endTimes = scheduleRows.map((row) => formatTime(row.end_time)).filter(Boolean);
    const timezones = scheduleRows.map((row) => row.timezone);

    const workingHours = {
      start: startTimes.length > 0 ? startTimes[0] : null,
      end: endTimes.length > 0 ? endTimes[0] : null,
      timezone: timezones.length > 0 ? timezones[0] : 'UTC',
    };

    const { rows: exceptionRows } = await pool.query(
      `
        SELECT
          exception_date,
          exception_type,
          start_time,
          end_time
        FROM mentor_time_exceptions
        WHERE mentor_id = $1
        ORDER BY exception_date, start_time;
      `,
      [mentorId]
    );

    const unavailableDateTime = {};

    const addTimeSlot = (dateKey, slot) => {
      if (!slot) return;
      if (unavailableDateTime[dateKey] === 'full-day') return;
      if (!Array.isArray(unavailableDateTime[dateKey])) {
        unavailableDateTime[dateKey] = [];
      }
      if (!unavailableDateTime[dateKey].includes(slot)) {
        unavailableDateTime[dateKey].push(slot);
      }
    };

    for (const exception of exceptionRows) {
      const dateKey = exception.exception_date.toISOString().split('T')[0];
      const { exception_type: type, start_time: startTime, end_time: endTime } = exception;

      if (type === 'unavailable' && !startTime && !endTime) {
        unavailableDateTime[dateKey] = 'full-day';
        continue;
      }

      const timeSlots =
        Array.isArray(unavailableDateTime[dateKey]) && unavailableDateTime[dateKey] !== 'full-day'
          ? unavailableDateTime[dateKey]
          : [];

      if (startTime) {
        addTimeSlot(dateKey, formatTime(startTime));
      }
      if (endTime) {
        addTimeSlot(dateKey, formatTime(endTime));
      }

      if (Array.isArray(unavailableDateTime[dateKey])) {
        unavailableDateTime[dateKey].sort();
      }
    }

    const { rows: bookingRows } = await pool.query(
      `
        SELECT start_time, end_time
        FROM mentor_bookings
        WHERE mentor_id = $1
          AND status IN ('reserved', 'completed')
          AND start_time >= NOW()
        ORDER BY start_time;
      `,
      [mentorId]
    );

    for (const booking of bookingRows) {
      const dateKey = booking.start_time.toISOString().split('T')[0];
      addTimeSlot(dateKey, formatTime(booking.start_time));
      addTimeSlot(dateKey, formatTime(booking.end_time));

      if (Array.isArray(unavailableDateTime[dateKey])) {
        unavailableDateTime[dateKey].sort();
      }
    }

    return res.json({
      workingHours,
      workingDays,
      unavailableDateTime,
    });
  } catch (error) {
    console.error('Failed to fetch mentor availability:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
