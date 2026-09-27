import test from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { dueReminder, nextWeeklyOccurrences, scoreboardDue } from '../src/lib/schedule.js';

const zone = 'Australia/Sydney';

test('next clinic is the coming Tuesday at 12pm Sydney time', () => {
  const now = DateTime.fromISO('2026-09-27T10:00', { zone }); // Sunday
  const [a, b] = nextWeeklyOccurrences({ weekday: 2, time: '12:00', zone, count: 2, now });
  assert.equal(a.toISO(), '2026-09-29T12:00:00.000+10:00');
  assert.equal(b.toISO(), '2026-10-06T12:00:00.000+11:00'); // daylight saving starts 4 Oct
});

test('if the clinic time has passed today, schedule next week', () => {
  const now = DateTime.fromISO('2026-09-29T12:30', { zone }); // Tuesday after clinic
  const [a] = nextWeeklyOccurrences({ weekday: 2, time: '12:00', zone, count: 1, now });
  assert.equal(a.toISODate(), '2026-10-06');
});

test('reminder buckets fire once each', () => {
  const start = 1_000_000_000_000;
  const at = (mins) => start - mins * 60000;
  assert.equal(dueReminder({ start, now: at(25 * 60), hours: [24, 1], sent: [] }), null);
  assert.equal(dueReminder({ start, now: at(23 * 60), hours: [24, 1], sent: [] }), 24);
  assert.equal(dueReminder({ start, now: at(23 * 60), hours: [24, 1], sent: [24] }), null);
  assert.equal(dueReminder({ start, now: at(50), hours: [24, 1], sent: [24] }), 1);
  assert.equal(dueReminder({ start, now: at(50), hours: [24, 1], sent: [24, 1] }), null);
  assert.equal(dueReminder({ start, now: at(-5), hours: [24, 1], sent: [] }), null);
});

test('event created 30 minutes out gets only the 1h reminder', () => {
  const start = 1_000_000_000_000;
  assert.equal(dueReminder({ start, now: start - 30 * 60000, hours: [24, 1], sent: [] }), 1);
});

test('scoreboard reminder fires Friday 3pm, once per week', () => {
  const fri = DateTime.fromISO('2026-10-02T15:05', { zone });
  const week = scoreboardDue({ weekday: 5, time: '15:00', zone, now: fri });
  assert.equal(week, '2026-W40');
  assert.equal(scoreboardDue({ weekday: 5, time: '15:00', zone, now: fri, lastSentWeek: week }), null);
  assert.equal(scoreboardDue({ weekday: 5, time: '15:00', zone, now: fri.set({ hour: 14 }) }), null);
  assert.equal(scoreboardDue({ weekday: 5, time: '15:00', zone, now: fri.plus({ days: 1 }) }), null);
});
