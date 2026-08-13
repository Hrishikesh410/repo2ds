import { StyleSheet, Text, View } from 'react-native';

export interface CardProps {
  title: string;
  subtitle?: string;
}

export function Card({ title, subtitle }: CardProps) {
  return (
    <View className="gap-4 p-4 rounded-lg bg-white" style={styles.border}>
      <Text className="text-sm font-semibold text-gray-900">{title}</Text>
      {subtitle ? <Text className="text-sm text-gray-500">{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  border: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
});
