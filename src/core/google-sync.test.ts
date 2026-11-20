import { afterEach, expect, test } from 'bun:test';
import { syncGoogleTasks, type SyncRecord } from './google-sync';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const block = { id: 'task-1', noteDate: '2026-11-19', text: 'Call', kind: 'task' as const, completed: false, position: 0, start: '2026-11-19T10:00:00Z', end: '2026-11-19T11:00:00Z', timezone: 'UTC' };
const token = async () => 'test-token';

test('stores event ID before creating, then updates and deletes only its own event', async () => {
  let records: SyncRecord[] = [];
  let remote: Record<string, unknown> | null = null;
  const methods: string[] = [];
  globalThis.fetch = (async (_url, init) => {
    const method = init?.method || 'GET';
    methods.push(method);
    if (method === 'GET') return remote ? Response.json(remote) : new Response(null, { status: 404 });
    if (method === 'POST') { expect(records).toHaveLength(1); remote = JSON.parse(String(init?.body)); return Response.json(remote); }
    if (method === 'PATCH') { remote = { ...remote, ...JSON.parse(String(init?.body)) }; return Response.json(remote); }
    remote = null; return new Response(null, { status: 204 });
  }) as typeof fetch;
  const save = (items: SyncRecord[]) => { records = structuredClone(items); };
  const signal = new AbortController().signal;
  await syncGoogleTasks([block], records, token, save, () => block, signal);
  const firstId = records[0].eventId;
  await syncGoogleTasks([block], records, token, save, () => block, signal);
  expect(methods).toEqual(['GET', 'POST']);
  const changed = { ...block, text: 'Call again' };
  await syncGoogleTasks([changed], records, token, save, () => changed, signal);
  expect(methods).toEqual(['GET', 'POST', 'GET', 'PATCH']);
  expect(records[0].eventId).toBe(firstId);
  await syncGoogleTasks([], records, token, save, () => null, signal);
  expect(methods).toEqual(['GET', 'POST', 'GET', 'PATCH', 'GET', 'DELETE']);
  expect(records).toEqual([]);
});

test('never changes a Google event that lacks the matching ownership marker', async () => {
  let records: SyncRecord[] = [{ blockId: block.id, eventId: 'df12345' }];
  const methods: string[] = [];
  globalThis.fetch = (async (_url, init) => { methods.push(init?.method || 'GET'); return Response.json({ summary: 'Someone else' }); }) as typeof fetch;
  await expect(syncGoogleTasks([], records, token, items => { records = items; }, () => null, new AbortController().signal)).rejects.toThrow('already in use');
  expect(methods).toEqual(['GET']);
  expect(records).toHaveLength(1);
});

test('a lost create response retries using the saved ID and updates the existing event', async () => {
  let records: SyncRecord[] = [];
  let remote: Record<string, unknown> | null = null;
  globalThis.fetch = (async (_url, init) => {
    if (!init?.method) return remote ? Response.json(remote) : new Response(null, { status: 404 });
    if (init.method === 'POST') { remote = JSON.parse(String(init.body)); throw new Error('network lost'); }
    expect(init.method).toBe('PATCH');
    return Response.json(remote);
  }) as typeof fetch;
  const save = (items: SyncRecord[]) => { records = structuredClone(items); };
  await expect(syncGoogleTasks([block], records, token, save, () => block, new AbortController().signal)).rejects.toThrow('network lost');
  const id = records[0].eventId;
  await syncGoogleTasks([block], records, token, save, () => block, new AbortController().signal);
  expect(records[0].eventId).toBe(id);
  expect(records[0].fingerprint).toBeDefined();
});
