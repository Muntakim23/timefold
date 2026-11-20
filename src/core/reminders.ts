import { Platform } from 'react-native';
import type { Block } from './model';
import { readPreference, writePreference } from './store';
import { defaultReminder, planReminder, type ReminderSettings } from './reminder-plan';

export type { ReminderSettings } from './reminder-plan';
type SavedReminder = ReminderSettings & { notificationId: string | null };
const key = (id: string) => `reminder:${id}`;
const empty = (): SavedReminder => ({ ...defaultReminder, notificationId: null });

function savedReminder(id: string): SavedReminder {
  const raw = readPreference(key(id));
  if (!raw) return empty();
  const data = JSON.parse(raw) as SavedReminder;
  if (typeof data.enabled !== 'boolean' || ![0, 5, 15, 30, 60].includes(data.offsetMinutes) || !['never', 'daily', 'weekly'].includes(data.repeat) || !(data.notificationId === null || typeof data.notificationId === 'string')) throw new Error('This reminder could not be read. The note has not been changed.');
  return data;
}

export function readReminder(id: string): ReminderSettings { const { enabled, offsetMinutes, repeat } = savedReminder(id); return { enabled, offsetMinutes, repeat }; }

export async function initializeReminderDelivery(): Promise<void> {
  if (Platform.OS === 'web') return;
  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }) });
}

export async function applyReminder(block: Block, settings: ReminderSettings): Promise<void> {
  const previous = savedReminder(block.id);
  const plan = planReminder(block.start, settings);
  if (!plan) { await clearReminder(block.id); return; }
  if (Platform.OS === 'web') throw new Error('Reminders are available in the Android and iOS app.');
  const Notifications = await import('expo-notifications');
  await initializeReminderDelivery();
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('dayfold-reminders', { name: 'Task reminders', importance: Notifications.AndroidImportance.DEFAULT });
  let permission = await Notifications.getPermissionsAsync();
  const allowed = () => permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL || permission.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL;
  if (!allowed()) permission = await Notifications.requestPermissionsAsync();
  if (!allowed()) throw new Error('Notification permission was not granted. Turn the reminder off to save without one.');
  const channelId = Platform.OS === 'android' ? 'dayfold-reminders' : undefined;
  const trigger = plan.kind === 'date'
    ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date: plan.at, channelId } as const
    : plan.kind === 'daily'
      ? { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: plan.hour, minute: plan.minute, channelId } as const
      : { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: plan.weekday, hour: plan.hour, minute: plan.minute, channelId } as const;
  const notificationId = await Notifications.scheduleNotificationAsync({ content: { title: 'Timefold reminder', body: block.text, data: { blockId: block.id, noteDate: block.noteDate }, sound: 'default' }, trigger });
  // Keep the previous reminder until its replacement and preference are safely stored.
  try {
    writePreference(key(block.id), JSON.stringify({ ...settings, notificationId }));
    if (previous.notificationId) await Notifications.cancelScheduledNotificationAsync(previous.notificationId);
  } catch (error) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    writePreference(key(block.id), JSON.stringify(previous));
    throw error;
  }
}

export async function clearReminder(id: string): Promise<void> {
  const previous = savedReminder(id);
  if (previous.notificationId && Platform.OS !== 'web') {
    const Notifications = await import('expo-notifications');
    await Notifications.cancelScheduledNotificationAsync(previous.notificationId);
  }
  if (previous.enabled || previous.notificationId) writePreference(key(id), JSON.stringify(empty()));
}

export async function refreshReminderText(block: Block): Promise<void> {
  const settings = readReminder(block.id);
  if (!settings.enabled || !block.start) return;
  let start = new Date(block.start);
  const now = Date.now();
  if (start.getTime() - settings.offsetMinutes * 60000 <= now) {
    if (settings.repeat === 'never') return;
    const step = settings.repeat === 'daily' ? 1 : 7;
    while (start.getTime() - settings.offsetMinutes * 60000 <= now) {
      start = new Date(start);
      start.setDate(start.getDate() + step);
    }
  }
  await applyReminder({ ...block, start: start.toISOString() }, settings);
}
