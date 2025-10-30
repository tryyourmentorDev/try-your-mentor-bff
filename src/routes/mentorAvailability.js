import { Router } from 'express';
import { DateTime } from 'luxon';
import { pool } from '../lib/db.js';

const router = Router();
const SLOT_MINUTES = 60;

const formatTime = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return value.toISOString().split('T')[1].slice(0, 5);
  }

  if (typeof value === 'string') {
    return value.slice(0, 5);
  }

  return null;
};

const addTimeSlot = (map, dateKey, slot) => {
  if (!slot) return;
  if (map[dateKey] === 'full-day') return;
  if (!Array.isArray(map[dateKey])) {
    map[dateKey] = [];
  }
  if (!map[dateKey].includes(slot)) {
    map[dateKey].push(slot);
    map[dateKey].sort();
  }
};

const addRangeSlots = (map, dateKey, start, end, incrementMinutes = SLOT_MINUTES) => {
  if (!start) return;

  const startDt = DateTime.fromISO(`${dateKey}T${start}`);
  let endDt = end ? DateTime.fromISO(`${dateKey}T${end}`) : startDt.plus({ minutes: incrementMinutes });

  if (!startDt.isValid) return;
  if (!endDt.isValid) {
    endDt = startDt.plus({ minutes: incrementMinutes });
  }

  for (let cursor = startDt; cursor < endDt; cursor = cursor.plus({ minutes: incrementMinutes })) {
    addTimeSlot(map, dateKey, cursor.toFormat('HH:mm'));
  }
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

    const scheduleTimezone = workingHours.timezone ?? 'UTC';
    const unavailableDateTime = {};

    for (const exception of exceptionRows) {
      const dateKey = exception.exception_date.toISOString().split('T')[0];
      const { exception_type: type, start_time: startTime, end_time: endTime } = exception;

      if (type === 'unavailable' && !startTime && !endTime) {
        unavailableDateTime[dateKey] = 'full-day';
        continue;
      }

      addRangeSlots(
        unavailableDateTime,
        dateKey,
        formatTime(startTime),
        formatTime(endTime)
      );
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
      const startLocal = DateTime.fromJSDate(booking.start_time).setZone(scheduleTimezone);
      const endLocal = DateTime.fromJSDate(booking.end_time).setZone(scheduleTimezone);
      const dateKey = startLocal.toISODate();

      addRangeSlots(
        unavailableDateTime,
        dateKey,
        startLocal.toFormat('HH:mm'),
        endLocal.toFormat('HH:mm')
      );
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
