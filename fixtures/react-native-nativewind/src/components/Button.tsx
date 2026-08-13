import { Pressable, Text } from 'react-native';

export interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary';
  onPress?: () => void;
}

export function Button({ label, variant = 'primary', onPress }: ButtonProps) {
  return (
    <Pressable
      className={
        variant === 'primary'
          ? 'px-4 py-2 rounded-lg bg-blue-600'
          : 'px-4 py-2 rounded-lg bg-gray-200'
      }
      onPress={onPress}
    >
      <Text className="text-sm font-semibold text-white">{label}</Text>
    </Pressable>
  );
}
