import { afterEach, expect, test } from 'bun:test';
import { listGoogleCalendars, listGoogleEvents } from './google-calendar';
import { deviceEventsOnDay } from './device-calendar';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function replies(...responses: Response[]) {
  const calls: { url: URL; init?: RequestInit }[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: new URL(String(input)), init });
    if (!responses.length) throw new Error('Unexpected extra request');
    return responses.shift()!;
  }) as typeof fetch;
  return calls;
}

const token = async (refresh = false) => refresh ? 'refreshed' : 'initial';
const signal = new AbortController().signal;
const calendar = { id: 'work/a@example.test', title: 'Work', color: '#123456', defaultSelected: true };

test('calendars follow pagination, retry an expired token once, and keep hidden calendars available', async () => {
  const calls = replies(
    Response.json({}, { status: 401 }),
    Response.json({ nextPageToken: 'page/two', items: [{ id: 'one', primary: true, summary: 'Primary' }] }),
    Response.json({ items: [{ id: 'two', summaryOverride: 'Other', selected: true, hidden: true }] }),
  );
  const calendars = await listGoogleCalendars(token, signal);
  expect(calendars.map(item => [item.id, item.title, item.defaultSelected])).toEqual([['one', 'Primary', true], ['two', 'Other', false]]);
  expect(new Headers(calls[1].init?.headers).get('Authorization')).toBe('Bearer refreshed');
  expect(calls[2].url.searchParams.get('pageToken')).toBe('page/two');
  expect(calls[0].url.searchParams.get('minAccessRole')).toBe('reader');
  expect(calls.every(({ url }) => url.origin === 'https://www.googleapis.com' && !url.searchParams.has('access_token'))).toBe(true);
});

test('events expand Google recurrences, use local all-day dates, and deduplicate paginated occurrences', async () => {
  const timed = { id: 'instance-1', start: { dateTime: '2026-03-07T23:30:00-08:00' }, end: { dateTime: '2026-03-08T03:30:00-07:00' } };
  const allDay = { id: 'all-day', summary: 'Trip', start: { date: '2026-03-07' }, end: { date: '2026-03-09' } };
  const calls = replies(
    Response.json({ nextPageToken: 'more', items: [allDay, timed, { id: 'cancelled', status: 'cancelled' }] }),
    Response.json({ items: [timed, { ...timed, id: 'instance-2', start: { dateTime: '2026-03-14T23:30:00-07:00' }, end: { dateTime: '2026-03-15T03:30:00-07:00' } }] }),
  );
  const events = await listGoogleEvents(calendar, 2026, token, signal);
  expect(calls[0].url.pathname).toContain('/calendars/work%2Fa%40example.test/events');
  expect(calls[0].url.searchParams.get('singleEvents')).toBe('true');
  expect(calls[0].url.searchParams.get('timeZone')).toBe('UTC');
  expect(events.map(item => item.id)).toEqual(['all-day', 'instance-1', 'instance-2']);
  expect(events[0]).toMatchObject({ start: new Date(2026, 2, 7).getTime(), end: new Date(2026, 2, 9).getTime(), color: '#123456', calendarName: 'Work' });
  expect(deviceEventsOnDay([events[0]], new Date(2026, 2, 9))).toHaveLength(0);
  expect(events[1].end - events[1].start).toBe(3 * 3600_000);
});

test('an API-disabled project, denied access, and rate limiting have actionable errors', async () => {
  for (const [status, reason, expected] of [
    [403, 'accessNotConfigured', 'enabled'], [403, 'forbidden', 'denied'], [429, 'rateLimitExceeded', 'minute'],
  ] as const) {
    replies(Response.json({ error: { errors: [{ reason }] } }, { status }));
    await expect(listGoogleCalendars(token, signal)).rejects.toThrow(expected);
  }
});
