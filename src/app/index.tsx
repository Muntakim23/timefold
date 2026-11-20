import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Alert, Animated, BackHandler, Keyboard, KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useColorScheme, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { DayTimeline, type TimelineDragTarget } from '../components/day-timeline';
import { DragHandle } from '../components/drag-handle';
import { GlassProvider, GlassSurface, FrostedButton, FrostedIconButton, FrostedTextButton, useGlassMotion } from '../components/glass-surface';
import { FrostedTabBar } from '../components/frosted-tab-bar';
import { ScheduleSheet } from '../components/schedule-sheet';
import { TaskCheckbox } from '../components/task-checkbox';
import { CalendarPeriodControl } from '../components/calendar-period-control';
import { CalendarOverview } from '../components/calendar-overview';
import { ChoiceCards } from '../components/choice-controls';
import { CalendarPeriod, movePeriod, scheduledOnDay, weekDates } from '../core/calendar';
import { Block, localDateKey, restoreSchedule, scheduleBlock } from '../core/model';
import { allBlocks, getBlock, readPreference, removeBlock, removeDailyNote, restoreBackup, restoreDeletedBlocks, saveBlock, writePreference } from '../core/store';
import { resolveAppearance, ThemeChoice } from '../core/appearance';
import { applyReminder, clearReminder, initializeReminderDelivery, readReminder, refreshReminderText, type ReminderSettings } from '../core/reminders';
import { deviceEventsOnDay } from '../core/device-calendar';
import { useGoogleCalendar } from '../hooks/use-google-calendar';
import { GoogleCalendarSettings } from '../components/google-calendar-settings';

type Screen = 'today' | 'settings';
type Menu = { type: 'page' } | { type: 'block'; id: string } | { type: 'confirm'; day: string };
type Undo = { type: 'delete'; blocks: Block[]; reminders: ReminderSettings[] } | { type: 'reminders'; blocks: Block[]; reminders: ReminderSettings[] } | { type: 'schedule'; block: Block; reminder: ReminderSettings };
const themeLabels = { system: 'System', light: 'Light', dark: 'Dark', 'frosted-light': 'Frosted Light', 'frosted-dark': 'Frosted Dark' };
const icons = {
  calendar: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  more: { ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' }, close: { ios: 'xmark', android: 'close', web: 'close' },
  clock: { ios: 'clock', android: 'schedule', web: 'schedule' }, previous: { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
  next: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }, expand: { ios: 'arrow.up.left.and.arrow.down.right', android: 'open_in_full', web: 'open_in_full' }, task: { ios: 'checklist', android: 'checklist', web: 'checklist' },
} as const;
function id() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`; }

function WavingHand() {
  const [wave] = useState(() => new Animated.Value(0));
  const reduced = useGlassMotion();
  useEffect(() => {
    if (reduced) return;
    const animation = Animated.sequence([1, -1, 1, -1, 0].map(toValue => Animated.timing(wave, { toValue, duration: 160, useNativeDriver: true })));
    animation.start();
    return () => animation.stop();
  }, [wave, reduced]);
  return <Animated.Text accessible={false} style={{ fontSize: 25, transform: [{ rotate: wave.interpolate({ inputRange: [-1, 1], outputRange: ['-16deg', '16deg'] }) }] }}>👋</Animated.Text>;
}

export default function HomeScreen() {
  const system = useColorScheme();
  const [theme, setTheme] = useState<ThemeChoice>(() => { const value = readPreference('theme'); return value && value in themeLabels ? value as ThemeChoice : 'system'; });
  const effects = false;
  const { dark } = resolveAppearance(theme, system, effects);
  const colors = dark ? { bg: '#19191c', text: '#ededf0', muted: '#a5a5af', line: '#35353b', surface: '#222226', event: '#35353c' } : { bg: '#efeff1', text: '#202025', muted: '#696971', line: '#e3e3e8', surface: '#fafafb', event: '#e9e9ee' };
  const text = { color: colors.text };
  const { width } = useWindowDimensions();
  const [date, setDate] = useState(() => new Date());
  const [blocks, setBlocks] = useState<Block[]>(() => allBlocks());
  const googleCalendar = useGoogleCalendar(date.getFullYear(), blocks);
  const [screen, setScreen] = useState<Screen>('today');
  const [split, setSplit] = useState(false);
  const [calendarFullScreen, setCalendarFullScreen] = useState(false);
  const [calendarPeriod, setCalendarPeriod] = useState<CalendarPeriod>('day');
  const displayedPeriod: CalendarPeriod = calendarFullScreen ? calendarPeriod : 'day';
  const [ratio, setRatio] = useState(0.5);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selected, setSelected] = useState<Block | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const drafts = useRef(new Set<string>());
  const editingText = useRef(new Map<string, string>());
  const inputs = useRef(new Map<string, ComponentRef<typeof TextInput>>());
  const timelineTarget = useRef<TimelineDragTarget>(null);
  const backgroundTarget = useRef<ComponentRef<typeof View>>(null);
  const contentTarget = useRef<ComponentRef<typeof View>>(null);
  const notebookScroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const day = localDateKey(date);
  const page = useMemo(() => blocks.filter(b => b.noteDate === day).sort((a, b) => a.position - b.position), [blocks, day]);
  const events = useMemo(() => scheduledOnDay(blocks, date), [blocks, date]);
  const googleEvents = useMemo(() => deviceEventsOnDay(googleCalendar.events, date), [googleCalendar.events, date]);
  const refresh = () => setBlocks(allBlocks());
  const upsert = (block: Block) => setBlocks(current => current.some(item => item.id === block.id) ? current.map(item => item.id === block.id ? block : item) : [...current, block]);
  const persist = (block: Block) => { saveBlock(block); drafts.current.delete(block.id); upsert(block); };
  const run = async (action: () => Promise<void>) => {
    if (operation.current) return;
    operation.current = true; setBusy(true);
    try { await action(); } catch (error) { Alert.alert('Could not complete action', String(error)); }
    finally { operation.current = false; setBusy(false); }
  };
  const update = (block: Block, change: Partial<Block>) => {
    try {
      const current = drafts.current.has(block.id) ? block : getBlock(block.id);
      if (!current) return;
      const next = { ...current, ...change };
      // Blank input is transient; never persist a new meaningless task.
      if (!next.text.trim()) { upsert({ ...next, completed: false }); return; }
      persist(next);
    } catch (error) { Alert.alert('Could not save note', String(error)); }
  };
  const finishEditing = (block: Block) => {
    if (block.text.trim()) {
      const previous = editingText.current.get(block.id);
      editingText.current.delete(block.id);
      if (previous !== undefined && previous !== block.text) {
        try { if (!readReminder(block.id).enabled) return; }
        catch { Alert.alert('Reminder could not be read', 'The note was saved, but its reminder could not be updated.'); return; }
        if (operation.current) {
          Alert.alert('Reminder may have the old text', 'Open the schedule and save it again to update the reminder.');
          return;
        }
        void run(async () => {
          const current = getBlock(block.id);
          if (!current) return;
          try { await refreshReminderText(current); }
          catch { throw new Error('The note was saved, but its reminder could not be updated. Open the schedule and save it again.'); }
        });
      }
      return;
    }
    editingText.current.delete(block.id);
    if (drafts.current.delete(block.id)) setBlocks(current => current.filter(item => item.id !== block.id));
    else { const saved = getBlock(block.id); if (saved) upsert(saved); }
  };
  const create = (kind: Block['kind'] = 'text') => {
    const existing = page.find(block => !block.text.trim());
    if (existing) { editNote(existing); return; }
    const block: Block = { id: id(), noteDate: day, text: '', kind, completed: false, position: Math.max(-1, ...page.map(b => b.position)) + 1, start: null, end: null, timezone: null };
    drafts.current.add(block.id); upsert(block); setFocusId(block.id);
    requestAnimationFrame(() => notebookScroll.current?.scrollToEnd({ animated: true }));
  };
  const goToday = () => { Keyboard.dismiss(); setDate(new Date()); setScreen('today'); setCalendarFullScreen(false); };
  const openDate = (next: Date) => { Keyboard.dismiss(); setDate(next); };
  const chooseSchedule = (block: Block) => { Keyboard.dismiss(); const current = getBlock(block.id); if (current?.text.trim()) { setMenu(null); setSelected(current); } };
  const commitSchedule = async (block: Block, start: Date | null, settings: ReminderSettings) => {
    const current = getBlock(block.id);
    if (!current) throw new Error('This note no longer exists.');
    const previousReminder = readReminder(current.id);
    const duration = current.start && current.end ? Date.parse(current.end) - Date.parse(current.start) : 3600000;
    const next = start ? scheduleBlock(current, start.toISOString(), new Date(start.getTime() + duration).toISOString(), Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC') : { ...current, start: null, end: null, timezone: null };
    await applyReminder(next, settings);
    try { const fresh = getBlock(block.id); if (!fresh) throw new Error('This note no longer exists.'); persist({ ...fresh, start: next.start, end: next.end, timezone: next.timezone }); }
    catch (error) { await applyReminder(current, previousReminder); throw error; }
    setUndo({ type: 'schedule', block: current, reminder: previousReminder });
  };
  const saveSchedule = async (start: Date, reminder: ReminderSettings) => { if (!selected) return false; await commitSchedule(selected, start, reminder); setSelected(null); return true; };
  const unschedule = async () => { if (!selected) return false; await commitSchedule(selected, null, { enabled: false, offsetMinutes: 0, repeat: 'never' }); setSelected(null); return true; };
  const deleteNotes = (items: Block[], sourceDay?: string) => { void run(async () => {
    const saved = items.map(item => getBlock(item.id)).filter((item): item is Block => !!item);
    const reminders = saved.map(item => readReminder(item.id));
    // Cancel first; a failed cancellation must not leave a deleted task still notifying.
    const cancelled: number[] = [];
    try {
      for (let i = 0; i < saved.length; i++) { await clearReminder(saved[i].id); cancelled.push(i); }
      if (sourceDay) removeDailyNote(sourceDay); else if (items[0]) removeBlock(items[0].id);
    } catch (error) {
      for (const i of cancelled) if (reminders[i].enabled) await applyReminder(saved[i], reminders[i]);
      throw error;
    }
    for (const item of items) drafts.current.delete(item.id);
    setBlocks(previous => previous.filter(item => sourceDay ? item.noteDate !== sourceDay : item.id !== items[0]?.id)); setMenu(null);
    if (saved.length) setUndo({ type: 'delete', blocks: saved, reminders });
  }); };
  const duplicate = (block: Block) => { try { const current = getBlock(block.id); if (!current?.text.trim()) return; const copy = { ...current, id: id(), completed: false, position: Math.max(-1, ...page.map(item => item.position)) + 1, start: null, end: null, timezone: null }; persist(copy); setMenu(null); editNote(copy); } catch (error) { Alert.alert('Could not duplicate', String(error)); } };
  const undoAction = () => { if (!undo) return; const action = undo; void run(async () => {
    if (action.type === 'delete' || action.type === 'reminders') {
      if (action.type === 'delete') { restoreDeletedBlocks(action.blocks); refresh(); }
      const failedBlocks: Block[] = [];
      const failedReminders: ReminderSettings[] = [];
      for (let i = 0; i < action.blocks.length; i++) {
        if (!action.reminders[i].enabled) continue;
        const current = getBlock(action.blocks[i].id);
        if (!current) continue;
        try { await applyReminder(current, action.reminders[i]); }
        catch { failedBlocks.push(current); failedReminders.push(action.reminders[i]); }
      }
      if (failedBlocks.length) {
        setUndo({ type: 'reminders', blocks: failedBlocks, reminders: failedReminders });
        Alert.alert('Some reminders could not be restored', `Check notification permission and the scheduled times, then retry. ${failedBlocks.map(item => item.text).join(', ')}`);
      } else setUndo(null);
    } else {
      const current = getBlock(action.block.id);
      if (current) { const next = restoreSchedule(current, action.block); await applyReminder(next, action.reminder); persist(next); }
      setUndo(null);
    }
  }); };
  useEffect(() => { if (!undo || undo.type === 'reminders') return; const timer = setTimeout(() => setUndo(null), 10000); return () => clearTimeout(timer); }, [undo]);
  useEffect(() => { void initializeReminderDelivery().catch(error => Alert.alert('Reminders unavailable', String(error))); }, []);
  useEffect(() => { const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true)); const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false)); return () => { show.remove(); hide.remove(); }; }, []);
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (searchOpen) { Keyboard.dismiss(); setSearchOpen(false); setQuery(''); return true; } if (menu) { if (!busy) setMenu(null); return true; } return false; }); return () => sub.remove(); }, [menu, busy, searchOpen]);
  const ratioStart = useRef(0.5); const currentRatio = useRef(ratio); const currentWidth = useRef(width);
  useEffect(() => { currentRatio.current = ratio; currentWidth.current = width; }, [ratio, width]);
  // eslint-disable-next-line react-hooks/refs, react-hooks/preserve-manual-memoization
  const divider = useMemo(() => PanResponder.create({ onStartShouldSetPanResponder: () => true, onPanResponderGrant: () => { ratioStart.current = currentRatio.current; }, onPanResponderMove: (_, gesture) => setRatio(Math.min(0.65, Math.max(0.35, ratioStart.current + gesture.dx / currentWidth.current))) }), []);
  const scheduleDrop = (block: Block, x: number, y: number) => {
    timelineTarget.current?.finish(x, y, minute => {
      const start = new Date(date);
      start.setHours(0, minute, 0, 0);
      void run(async () => {
        await commitSchedule(block, start, readReminder(block.id));
        void Haptics.selectionAsync().catch(() => {});
      });
    });
  };
  const editNote = (block: Block) => {
    setEditingId(block.id);
    setFocusId(block.id);
    requestAnimationFrame(() => inputs.current.get(block.id)?.focus());
  };
  const exportData = async () => { try { const file = new File(Paths.cache, 'donefold-backup.json'); file.write(JSON.stringify({ version: 1, blocks: allBlocks() }, null, 2)); await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export Timefold backup' }); } catch (error) { Alert.alert('Export failed', String(error)); } };
  const importData = async () => { try { const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true }); if (result.canceled) return; restoreBackup(JSON.parse(await new File(result.assets[0].uri).text())); refresh(); Alert.alert('Restore complete'); } catch (error) { Alert.alert('Restore failed', String(error)); } };
  const chooseTheme = (option: ThemeChoice) => { try { writePreference('theme', option); setTheme(option); } catch (error) { Alert.alert('Could not save appearance', String(error)); } };
  const button = (label: string, onPress: () => void, active = false) => <FrostedTextButton label={label} onPress={onPress} active={active} dark={dark} effects={effects} disabled={busy} />;
  const menuRow = (label: string, onPress: () => void, destructive = false) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={busy} onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}><Text style={{ color: destructive ? (dark ? '#ffb4b4' : '#a62727') : colors.text, fontSize: 15 }}>{label}</Text></Pressable>;
  const icon = (name: keyof typeof icons, label: string, onPress: () => void, active = false, quiet = false) => <FrostedIconButton name={icons[name]} accessibilityLabel={label} onPress={onPress} active={active} quiet={quiet} dark={dark} effects={effects} disabled={busy} />;
  const calendarTitle = calendarPeriod === 'year' ? String(date.getFullYear()) : calendarPeriod === 'month' ? date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : calendarPeriod === 'week' ? `${weekDates(date)[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekDates(date)[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  const heading = <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Return to today" onPress={goToday} style={styles.dateHeading}><Text style={[styles.eyebrow, { color: colors.muted }]}>{date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</Text><Text numberOfLines={2} style={[styles.title, text]}>{day === localDateKey(new Date()) ? 'Today' : date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</Text></Pressable>
    <View style={styles.headerActions}><View style={styles.wave}><WavingHand /></View>{icon('more', 'Daily note menu', () => { Keyboard.dismiss(); setMenu({ type: 'page' }); })}</View>
  </View>;
  const timeline = <View style={styles.flex}>
    {calendarFullScreen && <CalendarPeriodControl value={calendarPeriod} onChange={setCalendarPeriod} dark={dark} effects={effects} />}
    {calendarFullScreen && <View style={styles.calendarNav}>{icon('previous', 'Previous period', () => openDate(movePeriod(date, calendarPeriod, -1)), false, true)}<Text style={[text, styles.calendarLabel]} numberOfLines={2}>{calendarTitle}</Text>{icon('next', 'Next period', () => openDate(movePeriod(date, calendarPeriod, 1)), false, true)}</View>}
    {displayedPeriod === 'day' ? <DayTimeline ref={timelineTarget} tasks={events} events={googleEvents} date={date} colors={colors} editTask={chooseSchedule} /> : <CalendarOverview period={displayedPeriod} date={date} blocks={blocks} deviceEvents={googleCalendar.events} onDate={openDate} onPeriod={setCalendarPeriod} dark={dark} effects={effects} textColor={colors.text} mutedColor={colors.muted} lineColor={colors.line} />}
  </View>;
  const rowActions = (block: Block) => <View style={styles.rowActions}>{!split && icon('clock', `Schedule ${block.text || 'note'}`, () => chooseSchedule(block), false, true)}{icon('more', `Actions for ${block.text || 'empty note'}`, () => { Keyboard.dismiss(); setMenu({ type: 'block', id: block.id }); }, false, true)}</View>;
  const notebook = <View style={[styles.notebook, { backgroundColor: colors.surface }]}><ScrollView ref={notebookScroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.notebookContent}>
    <Text style={[styles.section, { color: colors.muted }]}>Daily note</Text>
    {page.map(block => <Pressable key={block.id} onLongPress={split ? undefined : () => { Keyboard.dismiss(); setMenu({ type: 'block', id: block.id }); }} delayLongPress={450} style={styles.block}>
      <View style={styles.blockLine}>{block.kind === 'task' ? <TaskCheckbox checked={!!block.text.trim() && block.completed} dark={dark} label={`${block.completed ? 'Mark incomplete' : 'Complete'} ${block.text || 'task'}`} onPress={() => { if (block.text.trim()) update(block, { completed: !block.completed }); }} /> : <Pressable onPress={() => update(block, { kind: 'task', completed: false })} accessibilityRole="button" accessibilityLabel="Make task" style={styles.rowIcon}><Text style={{ color: colors.muted, fontSize: 24 }}>·</Text></Pressable>}
      {split && block.text.trim() && editingId !== block.id && focusId !== block.id ? <DragHandle color={colors.text}
        text={block.text} completed={block.completed} label={`Drag ${block.text} to calendar`}
        edit={() => editNote(block)} onStart={() => { Keyboard.dismiss(); timelineTarget.current?.begin(); }}
        onPreview={(x, y) => timelineTarget.current?.preview(x, y)} onDrop={(x, y) => scheduleDrop(block, x, y)}
        onCancel={() => timelineTarget.current?.cancel()} /> : <TextInput ref={input => { if (input) inputs.current.set(block.id, input); else inputs.current.delete(block.id); }} multiline autoFocus={block.id === focusId} onFocus={() => { editingText.current.set(block.id, block.text); if (split) setEditingId(block.id); if (block.id === focusId) setFocusId(null); }} onBlur={() => { finishEditing(block); setEditingId(null); }} value={block.text} onChangeText={value => update(block, { text: value })} placeholder="Add a note…" placeholderTextColor={colors.muted} accessibilityLabel="Note text" style={[styles.input, text, block.completed && styles.completed]} />}
      {!split && rowActions(block)}</View>
      {split && <View style={styles.splitActions}>{rowActions(block)}</View>}
    </Pressable>)}
    <View style={styles.capture}><FrostedTextButton label="＋ Add a note…" accessibilityLabel="Add a note" onPress={() => create()} dark={dark} effects={effects} style={{ flexShrink: 1 }} />{icon('task', 'Add task', () => create('task'))}</View>
  </ScrollView></View>;
  const menuBlock = menu?.type === 'block' ? blocks.find(block => block.id === menu.id) : undefined;
  const overlayOpen = !!menu || !!selected || searchOpen;

  return <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View ref={backgroundTarget} pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]} />
    <GlassProvider blurTarget={backgroundTarget}><View style={styles.flex} accessibilityElementsHidden={overlayOpen} importantForAccessibility={overlayOpen ? 'no-hide-descendants' : 'auto'}>
      {screen === 'today' ? <>{split && !calendarFullScreen ? <View style={styles.workspaceHeader}>
        {icon('previous', 'Previous day', () => openDate(movePeriod(date, 'day', -1)), false, true)}
        <Pressable accessibilityRole="button" accessibilityLabel="Return to today" onPress={goToday} style={styles.workspaceDate}>
          <Text style={[styles.workspaceTitle, text]}>{date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
        </Pressable>
        {icon('next', 'Next day', () => openDate(movePeriod(date, 'day', 1)), false, true)}
        {icon('expand', 'Full screen calendar', () => setCalendarFullScreen(true), false, true)}
        {icon('more', 'Daily note menu', () => setMenu({ type: 'page' }), false, true)}
      </View> : !calendarFullScreen ? <>{heading}<View style={styles.week}>{Array.from({ length: 7 }, (_, i) => movePeriod(date, 'day', i - 3)).map(value => { const key = localDateKey(value); const active = key === day; return <FrostedButton key={key} accessibilityLabel={value.toDateString()} accessibilityState={{ selected: active }} onPress={() => openDate(value)} dark={dark} effects={effects} active={active} style={styles.day}><Text style={{ color: active ? '#fff' : colors.muted, fontSize: 11 }}>{value.toLocaleDateString(undefined, { weekday: 'short' })}</Text><Text style={{ color: active ? '#fff' : colors.text, fontWeight: '600' }}>{value.getDate()}</Text><View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: blocks.some(block => block.noteDate === key && block.text.trim()) ? active ? '#fff' : colors.muted : 'transparent' }} /></FrostedButton>; })}</View></> : <View style={styles.calendarTop}><Text style={[styles.section, text]}>Calendar</Text>{button('Split view', () => { setCalendarFullScreen(false); setSplit(true); })}{icon('more', 'Daily note menu', () => setMenu({ type: 'page' }))}</View>}
      </> : <View style={styles.header}>{icon('previous', 'Back to notebook', () => setScreen('today'))}<Text style={[styles.section, text]}>Settings</Text><View style={{ width: 44 }} /></View>}
      <View ref={contentTarget} style={styles.flex}>
        {screen === 'today' ? <View style={styles.content}>{!calendarFullScreen && <View style={{ width: split ? `${ratio * 100}%` : '100%' }}>{notebook}</View>}{split && <>{!calendarFullScreen && <View accessibilityRole="adjustable" accessibilityLabel="Resize notebook and calendar" accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={event => setRatio(value => Math.min(0.65, Math.max(0.35, value + (event.nativeEvent.actionName === 'increment' ? 0.05 : -0.05))))} {...divider.panHandlers} style={styles.grip}><View style={{ width: 2, height: 32, borderRadius: 1, backgroundColor: colors.muted }} /></View>}<View style={styles.flex}>{!calendarFullScreen && <Text style={[styles.timelineHeading, { color: colors.muted }]}>Timeline</Text>}{timeline}</View></>}</View> : <ScrollView contentContainerStyle={styles.settings}><Text style={[styles.section, text]}>Appearance</Text>{button('Theme: ' + themeLabels[theme], () => setSettingsOpen(!settingsOpen))}{settingsOpen && <ChoiceCards value={theme} options={(['system', 'light', 'dark'] as ThemeChoice[]).map(option => ({ value: option, label: themeLabels[option] }))} onChange={value => { if (value in themeLabels) { chooseTheme(value as ThemeChoice); setSettingsOpen(false); } }} dark={dark} effects={effects} />}<Text style={[styles.section, text]}>Google Calendar</Text><GoogleCalendarSettings calendar={googleCalendar} dark={dark} effects={effects} /><Text style={[styles.section, text]}>Data and backup</Text><Text style={[text, { lineHeight: 22 }]}>Your notes stay on this device. Back up regularly to keep a separate copy. Reminders are device-local and excluded from backups.</Text>{button('Export backup', () => { void exportData(); })}{button('Restore into empty library', () => { void importData(); })}</ScrollView>}
      </View>
    </View></GlassProvider>
    <GlassProvider blurTarget={contentTarget}>
      {!keyboardVisible && !overlayOpen && <FrostedTabBar value={searchOpen ? 'search' : screen === 'today' && split ? 'calendar' : 'today'} dark={dark} effects={effects} onChange={value => { Keyboard.dismiss(); if (value === 'search') { setQuery(''); setSearchOpen(true); } else if (value === 'calendar') { setScreen('today'); setSplit(true); setCalendarFullScreen(false); } else { goToday(); setSplit(false); } }} style={styles.bottomNav} />}
      {searchOpen && <View style={[styles.overlay, Platform.OS === 'android' && styles.searchOverlayAndroid]} accessibilityViewIsModal onAccessibilityEscape={() => { Keyboard.dismiss(); setSearchOpen(false); setQuery(''); }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close search" onPress={() => { Keyboard.dismiss(); setSearchOpen(false); setQuery(''); }} style={[StyleSheet.absoluteFill, { backgroundColor: dark ? 'rgba(0,0,0,0.25)' : 'rgba(24,24,30,0.12)' }]} />
        <View style={[styles.searchPanel, { backgroundColor: colors.surface }]}>
          <View style={styles.searchHeader}><Text style={[styles.section, text]}>Search notes</Text>{icon('close', 'Close search panel', () => { Keyboard.dismiss(); setSearchOpen(false); setQuery(''); }, false, true)}</View>
          <TextInput value={query} onChangeText={setQuery} autoFocus placeholder="Search notes" placeholderTextColor={colors.muted} accessibilityLabel="Search notes" style={[styles.search, text, { backgroundColor: colors.bg }]} />
          {!!query.trim() && <ScrollView keyboardShouldPersistTaps="handled" style={styles.searchResults}>{blocks.filter(block => block.text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map(block => <Pressable key={block.id} accessibilityRole="button" onPress={() => { Keyboard.dismiss(); openDate(new Date(`${block.noteDate}T12:00:00`)); setCalendarFullScreen(false); setSplit(false); setScreen('today'); setSearchOpen(false); setQuery(''); }} style={[styles.result, { borderColor: colors.line }]}><Text style={text}>{block.text}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{block.noteDate}</Text></Pressable>)}</ScrollView>}
        </View>
      </View>}
      {undo && !overlayOpen && <View style={styles.undo}><GlassSurface dark={dark} enabled={effects} radius={16} /><Text style={[text, { flexShrink: 1 }]} accessibilityLiveRegion="polite">{undo.type === 'delete' ? 'Note deleted' : undo.type === 'reminders' ? 'Reminders need attention' : 'Schedule updated'}</Text>{button(undo.type === 'reminders' ? 'Retry' : 'Undo', undoAction)}</View>}
      {menu && <View style={styles.overlay} accessibilityViewIsModal onAccessibilityEscape={() => { if (!busy) setMenu(null); }}><Pressable accessibilityRole="button" accessibilityLabel="Dismiss menu" disabled={busy} onPress={() => setMenu(null)} style={[StyleSheet.absoluteFill, { backgroundColor: dark ? 'rgba(0,0,0,0.25)' : 'rgba(24,24,30,0.12)' }]} /><View style={styles.menu}><GlassSurface dark={dark} enabled={effects} radius={24} intensity={75} /><View style={styles.menuHeader}><Text style={[styles.section, text]}>{menu.type === 'confirm' ? 'Delete daily note?' : menu.type === 'block' ? 'Note actions' : 'Daily note'}</Text>{icon('close', 'Close menu', () => setMenu(null))}</View>
        {menu.type === 'page' ? <><Text style={{ color: colors.muted, fontSize: 12 }}>Appearance</Text><View style={styles.quickThemes}>{(['system', 'light', 'dark'] as const).map(option => <FrostedTextButton key={option} label={themeLabels[option]} onPress={() => chooseTheme(option)} active={theme === option} dark={dark} effects={effects} style={{ flex: 1 }} />)}</View>{menuRow('Settings', () => { setMenu(null); setScreen('settings'); })}{menuRow('Delete daily note', () => setMenu({ type: 'confirm', day }), true)}</> : menu.type === 'confirm' ? <><Text style={[text, { lineHeight: 22 }]}>Delete notes belonging to {menu.day}? Notes from other dates remain, including those scheduled on this day.</Text><View style={styles.actions}>{button('Cancel', () => setMenu(null))}{button('Delete daily note', () => deleteNotes(blocks.filter(block => block.noteDate === menu.day), menu.day), true)}</View></> : menuBlock && <><Text numberOfLines={2} style={{ color: colors.muted }}>{menuBlock.text || 'Empty note'}</Text>{menuRow('Edit', () => { setMenu(null); editNote(menuBlock); })}{menuBlock.text.trim() ? <>{menuRow('Schedule', () => chooseSchedule(menuBlock))}{menuRow('Duplicate', () => duplicate(menuBlock))}</> : null}{menuRow('Delete', () => deleteNotes([menuBlock]), true)}</>}
      </View></View>}
      {selected && <ScheduleSheet key={selected.id} selected={selected} initialDate={selected.start ? new Date(selected.start) : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 11)} initialReminder={readReminder(selected.id)} dark={dark} effects={effects} onClose={() => setSelected(null)} onSave={saveSchedule} onUnschedule={unschedule} />}
    </GlassProvider>
  </KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
  workspaceHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6 },
  wave: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  searchOverlayAndroid: { justifyContent: 'flex-start' },
  searchPanel: { width: '100%', maxWidth: 440, maxHeight: '65%', alignSelf: 'center', borderRadius: 24, padding: 16 },
  searchHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  searchResults: { flexGrow: 0, flexShrink: 1 },
  workspaceDate: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  workspaceTitle: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  timelineHeading: { marginVertical: 12, paddingHorizontal: 4, fontSize: 16, fontWeight: '600' },
  flex: { flex: 1 }, header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, dateHeading: { flex: 1, minHeight: 60, justifyContent: 'center' }, eyebrow: { fontSize: 12, fontWeight: '500' }, title: { fontSize: 30, fontWeight: '600', marginTop: 4 }, headerActions: { flexDirection: 'row', gap: 4 },
  week: { flexDirection: 'row', justifyContent: 'space-between', gap: 4, paddingHorizontal: 12, paddingBottom: 16 }, day: { flex: 1, maxWidth: 48, minWidth: 0, minHeight: 60, paddingHorizontal: 0, paddingVertical: 8, borderRadius: 16, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 },
  content: { flex: 1, flexDirection: 'row', paddingHorizontal: 8 }, notebook: { flex: 1, borderRadius: 24, overflow: 'hidden' }, notebookContent: { paddingHorizontal: 8, paddingBottom: 112 }, section: { fontSize: 16, fontWeight: '600', marginVertical: 12 }, block: { minHeight: 48 }, blockLine: { flexDirection: 'row', alignItems: 'flex-start' }, input: { flex: 1, minWidth: 0, minHeight: 44, fontSize: 16, lineHeight: 23, paddingVertical: 10, paddingHorizontal: 0 }, completed: { textDecorationLine: 'line-through', opacity: 0.6 }, rowActions: { flexDirection: 'row' }, rowIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, splitActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 0 }, capture: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', paddingTop: 16, paddingBottom: 8 },
  bottomNav: { position: 'absolute', bottom: 12, alignSelf: 'center', width: 288 }, calendarTop: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 }, calendarNav: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }, calendarLabel: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '500' }, splitToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 12, paddingBottom: 4 }, grip: { width: 12, alignItems: 'center', justifyContent: 'center' }, hour: { position: 'absolute', left: 0, right: 0, height: 64, borderTopWidth: StyleSheet.hairlineWidth }, hourLabel: { width: 40, fontSize: 10, paddingTop: 5 }, event: { position: 'absolute', left: 40, right: 0, minHeight: 48, borderRadius: 8, padding: 6, gap: 2 }, dropTarget: { position: 'absolute', left: 36, right: 0, borderTopWidth: 2, padding: 4 },
  search: { marginHorizontal: 16, marginVertical: 8, padding: 12, borderRadius: 12, fontSize: 16 }, result: { minHeight: 64, padding: 16, marginHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 }, settings: { padding: 20, paddingBottom: 112, gap: 12 }, settingRow: { minHeight: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12 }, undo: { position: 'absolute', bottom: 80, alignSelf: 'center', maxWidth: '92%', padding: 8, gap: 12, flexDirection: 'row', alignItems: 'center', borderRadius: 16 }, overlay: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', padding: 12 }, menu: { width: '100%', maxWidth: 440, alignSelf: 'center', borderRadius: 24, padding: 16, gap: 8 }, menuHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, menuRow: { minHeight: 44, borderRadius: 12, justifyContent: 'center', paddingHorizontal: 12 }, quickThemes: { flexDirection: 'row', gap: 6 }, actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8, marginTop: 12 },
});


