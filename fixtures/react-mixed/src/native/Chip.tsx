import { StyleSheet, Text, View } from 'react-native';

export interface ChipProps {
  label: string;
  selected?: boolean;
}

export function Chip({ label, selected = false }: ChipProps) {
  return (
    <View style={[styles.chip, selected ? styles.selected : styles.unselected]}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  selected: {
    backgroundColor: '#2563EB',
  },
  unselected: {
    backgroundColor: '#FFFFFF',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
});
