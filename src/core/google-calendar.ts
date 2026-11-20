import { uniqueDeviceEvents, type DeviceCalendar, type DeviceEvent } from './device-calendar';

type GoogleCalendarEntry = {
  id: string; summary?: string; summaryOverride?: string; backgroundColor?: string;
  primary?: boolean; selected?: boolean; hidden?: boolean;
};
type EventTime = { date?: string; dateTime?: string };
type GoogleEvent = { id: string; status?: string; summary?: string; start?: EventTime; end?: EventTime };
type Page<T> = { items?: T[]; nextPageToken?: string };
type AccessToken = (refresh?: boolean) => Promise<string>;

async function failure(response: Response): Promise<Error> {
  const body = await response.json().catch(() => null);
  const reason = body?.error?.errors?.[0]?.reason;
  if (response.status === 401) return new Error('Google sign-in has expired. Reconnect your account.');
  if (reason === 'accessNotConfigured' || body?.error?.details?.some((item: { reason?: string }) => item.reason === 'SERVICE_DISABLED')) {
    return new Error('The Google Calendar API must be enabled for this app.');
  }
  if (response.status === 429 || ['rateLimitExceeded', 'userRateLimitExceeded'].includes(reason)) {
    return new Error('Google Calendar is receiving too many requests. Try refreshing in a minute.');
  }
  if (response.status === 403) return new Error('Google denied calendar access. Reconnect and allow calendar reading.');
  if (response.status === 404) return new Error('A selected calendar is no longer available. Refresh your calendars.');
  return new Error('Google Calendar could not load. Check your connection and try again.');
}

async function listPages<T>(path: string, query: Record<string, string>, token: AccessToken, signal: AbortSignal) {
  const items: T[] = [];
  const pages = new Set<string>();
  const params = new URLSearchParams(query);
  do {
    const url = 'https://www.googleapis.com/calendar/v3/' + path + '?' + params.toString();
    const request = async (refresh = false) => {
      const bearer = await token(refresh);
      return fetch(url, { signal, headers: { Authorization: 'Bearer ' + bearer } });
    };
    let response = await request();
    if (response.status === 401 && !signal.aborted) response = await request(true);
    if (!response.ok) throw await failure(response);
    const page: Page<T> = await response.json();
    if (!page || !Array.isArray(page.items ?? [])) throw new Error('Google returned an unreadable calendar response.');
    if (page.items) items.push(...page.items);
    if (!page.nextPageToken) break;
    if (pages.has(page.nextPageToken)) throw new Error('Google returned an incomplete calendar list. Try refreshing.');
    pages.add(page.nextPageToken);
    params.set('pageToken', page.nextPageToken);
  } while (!signal.aborted);
  return items;
}

export async function listGoogleCalendars(token: AccessToken, signal: AbortSignal): Promise<DeviceCalendar[]> {
  const calendars = await listPages<GoogleCalendarEntry>('users/me/calendarList', {
    minAccessRole: 'reader', maxResults: '250', showHidden: 'true',
    fields: 'nextPageToken,items(id,summary,summaryOverride,backgroundColor,primary,selected,hidden)',
  }, token, signal);
  return calendars.map(calendar => ({
    id: calendar.id,
    title: calendar.summaryOverride || calendar.summary || 'Untitled calendar',
    color: calendar.backgroundColor,
    source: calendar.primary ? 'Primary calendar' : undefined,
    defaultSelected: !calendar.hidden && !!(calendar.primary || calendar.selected),
  }));
}

function eventTime(value: EventTime | undefined): number {
  if (value?.dateTime) return Date.parse(value.dateTime);
  // Google all-day dates are floating local dates, with an exclusive end.
  if (!value?.date || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) return NaN;
  const [year, month, day] = value.date.split('-').map(Number);
  return new Date(year, month - 1, day).getTime();
}

export async function listGoogleEvents(calendar: DeviceCalendar, year: number, token: AccessToken, signal: AbortSignal): Promise<DeviceEvent[]> {
  const items = await listPages<GoogleEvent>('calendars/' + encodeURIComponent(calendar.id) + '/events', {
    // The six-week month grid includes adjacent-year days.
    timeMin: new Date(year, 0, -13).toISOString(),
    timeMax: new Date(year + 1, 0, 15).toISOString(),
    timeZone: 'UTC', singleEvents: 'true', showDeleted: 'false', orderBy: 'startTime',
    maxResults: '2500', fields: 'nextPageToken,items(id,status,summary,start,end)',
  }, token, signal);
  const events: DeviceEvent[] = [];
  for (const item of items) {
    const start = eventTime(item.start);
    const end = eventTime(item.end);
    if (!item.id || item.status === 'cancelled' || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    events.push({
      id: item.id, calendarId: calendar.id, calendarName: calendar.title, color: calendar.color,
      title: item.summary || 'Busy', allDay: !!item.start?.date, start, end,
    });
  }
  return uniqueDeviceEvents(events);
}
