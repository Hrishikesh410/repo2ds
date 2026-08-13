import { Pressable, StyleSheet, Text } from 'react-native';

export interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  onPress?: () => void;
}

export function Button({ label, variant = 'primary', disabled, onPress }: ButtonProps) {
  return (
    <Pressable
      style={[styles.base, variant === 'primary' ? styles.primary : styles.secondary]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  primary: {
    backgroundColor: '#2563EB',
  },
  secondary: {
    backgroundColor: '#E5E7EB',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
