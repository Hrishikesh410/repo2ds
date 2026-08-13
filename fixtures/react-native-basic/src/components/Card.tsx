import { StyleSheet, Text, View } from 'react-native';

interface CardProps {
  title: string;
  subtitle?: string;
  elevation?: number;
}

export default function Card({ title, subtitle, elevation = 2 }: CardProps) {
  return (
    <View style={[styles.card, { elevation }]}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
});
