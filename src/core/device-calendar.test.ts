import { expect, test } from 'bun:test';
import { androidAllDayLocalTime, deviceEventsOnDay, parseCalendarSelection, uniqueDeviceEvents } from './device-calendar';

test('device events include overlaps and exclude events ending at midnight', () => {
  const day = new Date(2026, 10, 18, 12);
  const midnight = new Date(2026, 10, 18).getTime();
  const base = { calendarId: 'calendar', title: 'Event', allDay: false };
  const events = [
    { ...base, id: 'ended', start: midnight - 3600000, end: midnight },
    { ...base, id: 'overlap', start: midnight - 3600000, end: midnight + 3600000 },
    { ...base, id: 'later', start: midnight + 7200000, end: midnight + 10800000 },
  ];
  expect(deviceEventsOnDay(events, day).map(event => event.id)).toEqual(['overlap', 'later']);
});

test('calendar selections preserve explicit empty and deduplicate valid IDs', () => {
  expect(parseCalendarSelection(null)).toBeNull();
  expect(parseCalendarSelection('[]')).toEqual([]);
  expect(parseCalendarSelection('["a","a","b"]')).toEqual(['a', 'b']);
  expect(parseCalendarSelection('{invalid')).toBeNull();
});

test('recurring instances stay distinct while repeated fetch results are deduplicated', () => {
  const e = { id: 'event', calendarId: 'c', title: 'Meeting', start: 1, end: 2, allDay: false };
  expect(uniqueDeviceEvents([e, e, { ...e, start: 3, end: 4 }])).toHaveLength(2);
});

test('Android all-day UTC date converts to local midnight', () => {
  const result = new Date(androidAllDayLocalTime(Date.UTC(2026, 10, 18)));
  expect([result.getFullYear(), result.getMonth(), result.getDate(), result.getHours()]).toEqual([2026, 10, 18, 0]);
});
