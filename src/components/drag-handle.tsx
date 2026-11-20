import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

type Props = {
  color: string;
  text: string;
  completed: boolean;
  label: string;
  edit: () => void;
  onStart: () => void;
  onPreview: (x: number, y: number) => void;
  onDrop: (x: number, y: number) => void;
  onCancel: () => void;
};

export function DragHandle(props: Props) {
  const latest = useRef(props);
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const active = useRef(false);
  const moved = useRef(false);
  const [dragging, setDragging] = useState(false);
  useEffect(() => { latest.current = props; }, [props]);
  useEffect(() => () => clearTimeout(hold.current), []);

  // The callbacks read current props only while a pointer is down.
  // eslint-disable-next-line react-hooks/refs
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      active.current = false;
      moved.current = false;
      clearTimeout(hold.current);
      hold.current = setTimeout(() => {
        active.current = true;
        setDragging(true);
        latest.current.onStart();
      }, 300);
    },
    onPanResponderTerminationRequest: () => !active.current,
    onPanResponderMove: (_, gesture) => {
      if (Math.abs(gesture.dx) + Math.abs(gesture.dy) > 6) {
        moved.current = true;
        clearTimeout(hold.current);
      }
      if (active.current) latest.current.onPreview(gesture.moveX, gesture.moveY);
    },
    onPanResponderRelease: (_, gesture) => {
      clearTimeout(hold.current);
      if (active.current && moved.current) latest.current.onDrop(gesture.moveX, gesture.moveY);
      else if (!active.current && !moved.current) latest.current.edit();
      else latest.current.onCancel();
      active.current = false;
      setDragging(false);
    },
    onPanResponderTerminate: () => {
      clearTimeout(hold.current);
      active.current = false;
      setDragging(false);
      latest.current.onCancel();
    },
  }), []);

  return <View {...pan.panHandlers} accessible accessibilityRole="button" accessibilityLabel={props.label}
    accessibilityHint="Tap to edit, or hold and drag to a time in the calendar. Scheduling is also available from note actions."
    accessibilityActions={[{ name: 'activate', label: 'Edit' }]} onAccessibilityAction={props.edit}
    onAccessibilityTap={props.edit} style={[styles.handle, dragging && { backgroundColor: 'rgba(128,128,128,0.16)' }]}>
    <Text selectable={false} style={[styles.title, { color: props.color }, props.completed && styles.complete]}>{props.text}</Text>
    {dragging && <Text style={[styles.hint, { color: props.color }]}>Drag to a time</Text>}
  </View>;
}

const styles = StyleSheet.create({
  handle: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center', paddingVertical: 5, borderRadius: 6, touchAction: 'pan-y' },
  title: { fontSize: 16, lineHeight: 23 },
  complete: { textDecorationLine: 'line-through', opacity: 0.6 },
  hint: { fontSize: 11, marginTop: 4 },
});

