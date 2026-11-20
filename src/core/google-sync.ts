import type { Block } from './model';

export type SyncRecord = { blockId: string; eventId: string; fingerprint?: string };
type GetToken = (refresh?: boolean) => Promise<string>;
type RemoteEvent = { status?: string; extendedProperties?: { private?: { timefoldBlockId?: string } } };

// The first ID is deterministic so restoring a backup does not create a duplicate.
export function googleEventId(blockId: string): string {
  const id = 'df' + Array.from({ length: blockId.length }, (_, i) => blockId.charCodeAt(i).toString(16).padStart(4, '0')).join('');
  if (id.length < 5 || id.length > 1024) throw new Error('A task ID cannot be synced.');
  return id;
}

function replacementEventId(): string {
  return 'df' + Date.now().toString(16) + Array.from({ length: 4 }, () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0')).join('');
}

export async function syncGoogleTasks(
  blocks: Block[], records: SyncRecord[], token: GetToken,
  save: (records: SyncRecord[]) => void, current: (id: string) => Block | null,
  signal: AbortSignal,
): Promise<SyncRecord[]> {
  let state = records.map(record => ({ ...record }));
  const scheduled = blocks.filter(block => block.start && block.end && block.text.trim());
  const base = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
  const request = async (url: string, init: RequestInit = {}) => {
    const send = async (refresh: boolean) => fetch(url, { ...init, signal, headers: { Authorization: 'Bearer ' + await token(refresh), 'Content-Type': 'application/json' } });
    let response = await send(false);
    if (response.status === 401 && !signal.aborted) response = await send(true);
    return response;
  };
  const check = async (record: SyncRecord): Promise<RemoteEvent | null> => {
    const response = await request(`${base}/${record.eventId}`);
    if (response.status === 404) return null;
    if (response.status === 410) return { status: 'cancelled' };
    if (!response.ok) throw new Error('Could not check the matching Google event. Try again.');
    const event = await response.json() as RemoteEvent;
    if (event.extendedProperties?.private?.timefoldBlockId !== record.blockId) throw new Error('A Google event ID is already in use. No event was changed.');
    return event;
  };
  for (const block of scheduled) {
    if (signal.aborted) throw new Error('Sync stopped.');
    let record = state.find(item => item.blockId === block.id);
    if (!record) {
      record = { blockId: block.id, eventId: googleEventId(block.id) };
      state.push(record);
      save(state);
    }
    const fingerprint = JSON.stringify([block.text, block.start, block.end, block.timezone]);
    if (record.fingerprint === fingerprint) continue;
    const event = await check(record);
    if (event?.status === 'cancelled') { record.eventId = replacementEventId(); record.fingerprint = undefined; save(state); }
    const body = { summary: block.text, start: { dateTime: block.start }, end: { dateTime: block.end }, extendedProperties: { private: { timefoldBlockId: block.id } } };
    const response = event && event.status !== 'cancelled'
      ? await request(`${base}/${record.eventId}`, { method: 'PATCH', body: JSON.stringify(body) })
      : await request(base, { method: 'POST', body: JSON.stringify({ ...body, id: record.eventId }) });
    if (!response.ok) throw new Error(`Could not save a task to Google Calendar (${response.status}). Try again.`);
    record.fingerprint = fingerprint;
    save(state);
  }
  for (const record of [...state]) {
    if (signal.aborted) throw new Error('Sync stopped.');
    const block = current(record.blockId);
    if (block?.start && block.end && block.text.trim()) continue;
    const event = await check(record);
    if (event && event.status !== 'cancelled') {
      const response = await request(`${base}/${record.eventId}`, { method: 'DELETE' });
      if (!response.ok && response.status !== 404 && response.status !== 410) throw new Error(`Could not remove a Google event (${response.status}). Try again.`);
    }
    state = state.filter(item => item.blockId !== record.blockId);
    save(state);
  }
  return state;
}
