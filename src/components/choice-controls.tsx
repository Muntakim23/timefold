import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassSurface, useGlassMotion } from './glass-surface';

export type Choice = { value: string; label: string; description?: string };

/** A compact choice that opens into its options, adapted for native touch. */
export function ChoiceSelect({ label, value, options, onChange, dark, effects, disabled = false }: {
  label: string; value: string; options: Choice[]; onChange: (value: string) => void;
  dark: boolean; effects: boolean; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));
  const reduced = useGlassMotion();
  useEffect(() => {
    if (reduced) { progress.setValue(open ? 1 : 0); return; }
    const animation = Animated.timing(progress, { toValue: open ? 1 : 0, duration: 160, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [open, progress, reduced]);
  const color = dark ? '#eeeef0' : '#242528';
  const selected = options.find(option => option.value === value);
  return <View style={styles.selectWrap}>
    <Text style={[styles.caption, { color: dark ? '#aeafb5' : '#65666d' }]}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${selected?.label ?? 'Select'}`} accessibilityState={{ expanded: open, disabled }} disabled={disabled} onPress={() => setOpen(!open)} style={styles.trigger}>
      <GlassSurface dark={dark} enabled={effects} radius={14} />
      <Text numberOfLines={1} style={[styles.label, { color }]}>{selected?.label ?? 'Select'}</Text><Text style={{ color, fontSize: 16 }}>{open ? '⌃' : '⌄'}</Text>
    </Pressable>
    {open && <Animated.View style={[styles.list, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-4, 0] }) }] }]}>
      <GlassSurface dark={dark} enabled={effects} radius={14} />
      {options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: option.value === value, disabled }} disabled={disabled} onPress={() => { onChange(option.value); setOpen(false); }} style={styles.option}>
        <Text style={[styles.optionText, { color }]}>{option.label}</Text><Text style={{ color }}>{option.value === value ? '✓' : ''}</Text>
      </Pressable>)}
    </Animated.View>}
  </View>;
}

/** Accessible list of radio cards for appearance choices. */
export function ChoiceCards({ value, options, onChange, dark, effects }: {
  value: string; options: Choice[]; onChange: (value: string) => void; dark: boolean; effects: boolean;
}) {
  return <View accessibilityRole="radiogroup" accessibilityLabel="Appearance theme" style={styles.cards}>
    {options.map(option => { const selected = option.value === value; return <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => onChange(option.value)} style={styles.card}>
      <GlassSurface dark={dark} enabled={effects} radius={14} />
      <View style={styles.cardText}><Text style={[styles.label, { color: dark ? '#eeeef0' : '#242528' }]}>{option.label}</Text>{option.description && <Text style={[styles.caption, { color: dark ? '#aeafb5' : '#65666d' }]}>{option.description}</Text>}</View>
      <View style={[styles.radio, { borderColor: selected ? (dark ? '#eeeef0' : '#242528') : dark ? '#8e8f96' : '#8b8c92' }]}>{selected && <View style={[styles.radioDot, { backgroundColor: dark ? '#eeeef0' : '#242528' }]} />}</View>
    </Pressable>; })}
  </View>;
}

const styles = StyleSheet.create({
  selectWrap: { gap: 4 }, caption: { fontSize: 12, lineHeight: 18 }, label: { fontSize: 14, fontWeight: '600' },
  trigger: { minHeight: 44, paddingHorizontal: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  list: { borderRadius: 14, paddingVertical: 4, marginTop: 2 }, option: { minHeight: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 }, optionText: { flex: 1, fontSize: 14 },
  cards: { gap: 8 }, card: { minHeight: 52, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }, cardText: { flex: 1, gap: 2 },
  radio: { width: 20, height: 20, borderWidth: 1.5, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, radioDot: { width: 10, height: 10, borderRadius: 5 },
});
