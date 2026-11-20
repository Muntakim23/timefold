// Adapted from Uiverse.io by lawson_5090 for React Native.
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarPeriod } from '../core/calendar';
import { GlassSurface } from './glass-surface';

const periods: CalendarPeriod[] = ['day', 'week', 'month', 'year'];
type Props = { value: CalendarPeriod; onChange: (value: CalendarPeriod) => void; dark: boolean; effects: boolean };

export function CalendarPeriodControl({ value, onChange, dark, effects }: Props) {
  const [position] = useState(() => new Animated.Value(periods.indexOf(value)));
  const [width, setWidth] = useState(304);
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => { if (mounted) setReduceMotion(enabled); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    const next = periods.indexOf(value);
    if (reduceMotion) { position.setValue(next); return; }
    const animation = Animated.timing(position, { toValue: next, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [position, reduceMotion, value]);

  const segmentWidth = (width - 8) / 4;
  return <View style={styles.scroller}>
    <View accessibilityRole="tablist" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.control}>
      <GlassSurface dark={dark} enabled={effects} radius={24} />
      <Animated.View pointerEvents="none" style={[styles.thumb, { width: segmentWidth, transform: [{ translateX: Animated.multiply(position, segmentWidth) }] }]} />
      {periods.map(period => <Pressable key={period} accessibilityRole="tab" accessibilityState={{ selected: value === period }} onPress={() => onChange(period)} style={styles.item}>
        <Text style={[styles.label, { color: value === period ? '#fff' : dark ? '#e0e1e5' : '#555b66' }]}>{period[0].toUpperCase() + period.slice(1)}</Text>
      </Pressable>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  scroller: { alignItems: 'center', paddingHorizontal: 4 },
  control: { width: '100%', maxWidth: 304, height: 48, padding: 4, flexDirection: 'row', overflow: 'hidden', borderRadius: 24 },
  thumb: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: 20, backgroundColor: '#0b1220' },
  item: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '600' },
});
