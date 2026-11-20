export type DeviceEvent = { id: string; calendarId: string; title: string; start: number; end: number; allDay: boolean; calendarName?: string; color?: string };

export type DeviceCalendar = { id: string; title: string; color?: string; source?: string; defaultSelected: boolean };

export function parseCalendarSelection(raw: string | null): string[] | null {
  if (raw === null) return null;
  try { const ids: unknown = JSON.parse(raw); return Array.isArray(ids) && ids.every(id => typeof id === 'string') ? [...new Set(ids)] : null; } catch { return null; }
}

export function uniqueDeviceEvents(events: DeviceEvent[]): DeviceEvent[] {
  const unique = new Map<string, DeviceEvent>();
  for (const event of events) unique.set(JSON.stringify([event.calendarId, event.id, event.start]), event);
  return [...unique.values()];
}

// Android stores all-day date boundaries as UTC midnight, independent of device timezone.
export function androidAllDayLocalTime(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()).getTime();
}

// End times are exclusive; a midnight ending must not appear on the next day.
export function deviceEventsOnDay(events: DeviceEvent[], date: Date): DeviceEvent[] {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
  return events.filter(event => event.start < end && event.end > start)
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start - b.start);
}
