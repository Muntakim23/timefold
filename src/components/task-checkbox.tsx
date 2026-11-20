// Adapted from Uiverse.io by SelfMadeSystem for React Native.
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, View } from 'react-native';

type Props = { checked: boolean; dark: boolean; label: string; onPress: () => void };

export function TaskCheckbox({ checked, dark, label, onPress }: Props) {
  const [progress] = useState(() => new Animated.Value(checked ? 1 : 0));
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; listener.remove(); };
  }, []);

  useEffect(() => {
    if (reduceMotion) { progress.setValue(checked ? 1 : 0); return; }
    const animation = Animated.timing(progress, { toValue: checked ? 1 : 0, duration: 250, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [checked, progress, reduceMotion]);

  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked }} onPress={onPress} style={styles.touch}>
    <View style={[styles.box, { borderColor: checked ? (dark ? '#ededed' : '#161616') : dark ? '#a1a1a6' : '#919191', backgroundColor: checked ? (dark ? '#ededed' : '#161616') : 'transparent' }]}>
      <Animated.View style={[styles.tick, { borderColor: dark ? '#161616' : '#fff', opacity: progress, transform: [{ rotate: '45deg' }, { scale: progress }] }]} />
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  touch: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  box: { width: 26, height: 26, borderWidth: 2, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  tick: { width: 7, height: 13, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#fff', marginTop: -3 },
});
