import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useGoogleAuth } from './use-google-auth';
import { listGoogleCalendars, listGoogleEvents } from '../core/google-calendar';
import { parseCalendarSelection, type DeviceCalendar, type DeviceEvent } from '../core/device-calendar';
import { allBlocks, getBlock, readPreference, writePreference } from '../core/store';
import { syncGoogleTasks, type SyncRecord } from '../core/google-sync';
import type { Block } from '../core/model';

type CalendarState = {
  account: string; year: number; calendars: DeviceCalendar[]; events: DeviceEvent[];
  selected: string[]; status: 'loading' | 'signedIn' | 'empty' | 'error'; message: string;
};

const selectionKey = (account: string) => 'googleCalendarIds:' + account;
const noEvents: DeviceEvent[] = [];
const noCalendars: DeviceCalendar[] = [];
const noSelection: string[] = [];

export function useGoogleCalendar(year: number, blocks: Block[]) {
  const { accountId, status: authStatus, message: authMessage, signIn, signOut, getAccessToken } = useGoogleAuth();
  const account = authStatus === 'signedIn' ? accountId : null;
  const [data, setData] = useState<CalendarState | null>(null);
  const [syncRevision, setSyncRevision] = useState(0);
  const [syncStatus, setSyncStatus] = useState<{ account: string; message: string } | null>(null);
  const request = useRef<AbortController | null>(null);
  const visible = account && data?.account === account && data.year === year ? data : null;
  const syncEnabled = !!account && readPreference('googleSyncEnabled:' + account) === 'true';

  useEffect(() => {
    if (!account || !syncEnabled) return;
    const controller = new AbortController();
    const key = 'googleSyncRecords:' + account;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          setSyncStatus({ account, message: 'Syncing tasks to Google Calendar…' });
          const raw = readPreference(key);
          const records: unknown = raw ? JSON.parse(raw) : [];
          if (!Array.isArray(records) || !records.every(item => item && typeof item.blockId === 'string' && typeof item.eventId === 'string' && /^df[0-9a-f]{5,1022}$/.test(item.eventId) && (item.fingerprint === undefined || typeof item.fingerprint === 'string')) || new Set(records.map(item => item.blockId)).size !== records.length || new Set(records.map(item => item.eventId)).size !== records.length) throw new Error('Saved sync information is invalid. No Google events were changed.');
          await syncGoogleTasks(allBlocks(), records as SyncRecord[], getAccessToken, items => writePreference(key, JSON.stringify(items)), getBlock, controller.signal);
          if (!controller.signal.aborted) setSyncStatus({ account, message: 'Tasks synced to your primary Google Calendar.' });
        } catch (error) {
          if (!controller.signal.aborted) setSyncStatus({ account, message: error instanceof Error ? error.message : 'Could not sync tasks. Try again.' });
        }
      })();
    }, 1200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [account, syncEnabled, blocks, syncRevision, getAccessToken]);

  const refresh = useCallback(async () => {
    if (!account) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const { signal } = controller;
    const initial: CalendarState = {
      account, year, calendars: [], selected: [], events: [], status: 'loading', message: 'Loading Google calendars…',
    };
    setData(previous => previous?.account === account && previous.year === year
      ? { ...previous, status: 'loading', message: 'Refreshing Google calendars…' } : initial);
    try {
      const calendars = await listGoogleCalendars(getAccessToken, signal);
      if (signal.aborted) return;
      const saved = parseCalendarSelection(readPreference(selectionKey(account)));
      const chosen = calendars.filter(item => saved === null ? item.defaultSelected : saved.includes(item.id));
      const selected = chosen.map(calendar => calendar.id);
      setData(previous => ({
        ...initial, calendars, selected,
        events: previous?.account === account && previous.year === year ? previous.events.filter(event => selected.includes(event.calendarId)) : [],
        message: 'Loading events…',
      }));
      const events: DeviceEvent[] = [];
      let failureMessage: string | null = null;
      for (const calendar of chosen) {
        if (signal.aborted) return;
        try {
          const items = await listGoogleEvents(calendar, year, getAccessToken, signal);
          for (const event of items) events.push(event);
        } catch (error) {
          failureMessage = error instanceof Error ? error.message : 'Could not load a selected calendar. Try refreshing.';
        }
      }
      if (signal.aborted) return;
      let message = 'No readable calendars on this account.';
      if (calendars.length) message = chosen.length ? `${events.length} event${events.length === 1 ? '' : 's'} loaded` : 'Choose a calendar to show its events.';
      setData({ account, year, calendars, selected, events, status: failureMessage ? 'error' : calendars.length ? 'signedIn' : 'empty', message: failureMessage ?? message });
    } catch (error) {
      if (signal.aborted) return;
      const message = error instanceof Error ? error.message : 'Could not read Google calendars. Try refreshing.';
      setData(previous => ({ ...(previous?.account === account && previous.year === year ? previous : initial), events: [], status: 'error', message }));
    }
  }, [account, year, getAccessToken]);

  useEffect(() => {
    if (!account) return;
    let active = true;
    void Promise.resolve().then(() => { if (active) return refresh(); });
    const listener = AppState.addEventListener('change', state => { if (state === 'active') { void refresh(); setSyncRevision(value => value + 1); } });
    return () => { active = false; listener.remove(); request.current?.abort(); };
  }, [account, refresh]);

  function choose(id: string, value: boolean) {
    if (!account || !visible?.calendars.some(item => item.id === id)) return;
    try {
      const ids = new Set(parseCalendarSelection(readPreference(selectionKey(account))) ?? visible.selected);
      if (value) ids.add(id);
      else ids.delete(id);
      const selected = [...ids];
      writePreference(selectionKey(account), JSON.stringify(selected));
      setData(previous => previous && { ...previous, selected, events: previous.events.filter(event => ids.has(event.calendarId)) });
      void refresh();
    } catch {
      setData(previous => previous && { ...previous, status: 'error', message: 'Could not save your calendar selection. Try again.' });
    }
  }

  async function disconnect() {
    request.current?.abort();
    try {
      await signOut();
      setData(null);
    } catch {
      if (account) {
        setData(previous => ({
          ...(previous?.account === account && previous.year === year ? previous : { account, year, calendars: [], events: [], selected: [] }),
          status: 'error', message: 'Could not disconnect from Google. Try again.',
        }));
      }
    }
  }

  let events = visible?.events ?? noEvents;
  const primary = visible?.calendars.find(item => item.source === 'Primary calendar');
  if (account && primary) {
    try {
      const records: unknown = JSON.parse(readPreference('googleSyncRecords:' + account) || '[]');
      if (Array.isArray(records)) {
        const own = new Set(records.filter(record => typeof record?.fingerprint === 'string' && getBlock(record.blockId)?.start).map(record => record.eventId));
        events = events.filter(event => event.calendarId !== primary.id || !own.has(event.id));
      }
    } catch { /* Leave Google events visible if sync information cannot be read. */ }
  }

  const status = account ? visible?.status ?? 'loading' : authStatus;
  return {
    status, message: account ? visible?.message ?? 'Loading Google calendars…' : authMessage,
    enabled: !!account, loading: status === 'loading' || status === 'signingIn',
    calendars: visible?.calendars ?? noCalendars, selected: visible?.selected ?? noSelection,
    events, connect: signIn, disconnect, refresh, choose,
    syncEnabled, syncMessage: syncStatus?.account === account ? syncStatus?.message ?? '' : '',
    setSyncEnabled: (value: boolean) => {
      if (!account) return;
      try { writePreference('googleSyncEnabled:' + account, String(value)); setSyncStatus({ account, message: value ? 'Preparing to sync…' : 'Task syncing is off.' }); setSyncRevision(revision => revision + 1); }
      catch { setSyncStatus({ account, message: 'Could not save the sync setting.' }); }
    },
    retrySync: () => setSyncRevision(revision => revision + 1),
  };
}
