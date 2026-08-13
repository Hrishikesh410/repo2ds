import { SafeAreaView, ScrollView } from 'react-native';

export function Screen({ children }: { children?: unknown }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>{children}</ScrollView>
    </SafeAreaView>
  );
}
