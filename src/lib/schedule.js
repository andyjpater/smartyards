import { DateTime } from 'luxon';

// Pure date helpers for the bot's schedules (kept separate so they're testable).

export function parseTime(hhmm) {
  const [hour, minute] = String(hhmm).split(':').map(Number);
  if (!(hour >= 0 && hour < 24 && minute >= 0 && minute < 60)) throw new Error(`Bad time "${hhmm}" (use HH:MM)`);
  return { hour, minute };
}

// The next `count` weekly occurrences of weekday (1=Mon..7=Sun) at hh:mm in `zone`, after `now`.
export function nextWeeklyOccurrences({ weekday, time, zone, count, now = DateTime.now() }) {
  const { hour, minute } = parseTime(time);
  const local = now.setZone(zone);
  let first = local.set({ hour, minute, second: 0, millisecond: 0 }).plus({ days: (weekday - local.weekday + 7) % 7 });
  if (first <= local) first = first.plus({ weeks: 1 });
  return Array.from({ length: count }, (_, i) => first.plus({ weeks: i }));
}

// Which reminder (if any) is due for an event. Reminders are "buckets": the
// smallest configured lead time that the event is already inside. Each bucket
// fires once, so an event created 3 hours out gets the 24h-bucket reminder
// immediately and the 1h one later, never a stale duplicate.
export function dueReminder({ start, now, hours, sent }) {
  const minutesUntil = (start - now) / 60000;
  if (minutesUntil <= 0) return null;
  const sorted = [...hours].sort((a, b) => a - b);
  const bucket = sorted.find((h) => minutesUntil <= h * 60);
  if (bucket === undefined || sent.includes(bucket)) return null;
  return bucket;
}

// True once per ISO week, at/after the configured weekday + time.
export function scoreboardDue({ weekday, time, zone, now = DateTime.now(), lastSentWeek }) {
  const { hour, minute } = parseTime(time);
  const local = now.setZone(zone);
  const weekKey = `${local.weekYear}-W${local.weekNumber}`;
  const due =
    local.weekday === weekday && (local.hour > hour || (local.hour === hour && local.minute >= minute));
  return due && lastSentWeek !== weekKey ? weekKey : null;
}
