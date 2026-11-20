import { expect, test } from 'bun:test';
import { movePeriod, weekDates, monthDates, monthGridDates, scheduledOnDay, slotsForRange } from './calendar';
import { localDateKey } from './model';

test('month navigation clamps dates rather than skipping a month', () => {
  expect(localDateKey(movePeriod(new Date(2026, 0, 31, 12), 'month', 1))).toBe('2026-02-28');
  expect(localDateKey(movePeriod(new Date(2024, 1, 29, 12), 'year', 1))).toBe('2025-02-28');
});

test('calendar month grid retains six complete weeks across short and long months', () => {
  const february = monthGridDates(new Date(2026, 1, 12, 12));
  const august = monthGridDates(new Date(2026, 7, 12, 12));
  expect(february).toHaveLength(42);
  expect(august).toHaveLength(42);
  expect(localDateKey(february[0])).toBe('2026-02-01');
  expect(localDateKey(february[41])).toBe('2026-03-14');
  expect(localDateKey(august[0])).toBe('2026-07-26');
});

test('week entries follow their scheduled time, not the source note order', () => {
  const base = { noteDate: '2026-11-18', text: '', kind: 'text' as const, completed: false, position: 0, end: '2026-11-18T14:00:00.000Z', timezone: 'UTC' };
  const late = { ...base, id: 'late', start: '2026-11-18T13:00:00.000Z' };
  const early = { ...base, id: 'early', start: '2026-11-18T08:00:00.000Z' };
  expect(scheduledOnDay([late, early], new Date(early.start)).map(item => item.id)).toEqual(['early', 'late']);
});

test('week and month calendars span full local weeks', () => {
  expect(weekDates(new Date(2026, 10, 18, 12)).map(localDateKey)).toEqual(['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21']);
  const dates = monthDates(new Date(2026, 1, 12, 12));
  expect(dates.length % 7).toBe(0);
  expect(localDateKey(dates[0])).toBe('2026-02-01');
  expect(localDateKey(dates[dates.length - 1])).toBe('2026-02-28');
});

test('overnight tasks cover both days and exclude the ending midnight', () => {
  const task = { id: 'night', noteDate: '2026-11-18', text: 'Night', kind: 'task' as const, completed: false, position: 0, timezone: 'UTC', start: new Date(2026, 10, 18, 23, 30).toISOString(), end: new Date(2026, 10, 19, 0, 30).toISOString() };
  expect(scheduledOnDay([task], new Date(2026, 10, 18))).toHaveLength(1);
  expect(scheduledOnDay([task], new Date(2026, 10, 19))).toHaveLength(1);
  expect(slotsForRange(Date.parse(task.start), Date.parse(task.end), new Date(2026, 10, 19))).toEqual([0, 1]);
  expect(slotsForRange(new Date(2026, 10, 19, 9).getTime(), new Date(2026, 10, 19, 11).getTime(), new Date(2026, 10, 19))).toEqual([36, 37, 38, 39, 40, 41, 42, 43]);
  expect(scheduledOnDay([{ ...task, end: new Date(2026, 10, 19).toISOString() }], new Date(2026, 10, 19))).toHaveLength(0);
});
