/**
 * Styling systems Repo2DS can interpret. A styling system is orthogonal to a
 * framework: Tailwind is used with React, NativeWind with React Native, and both
 * are parsed by the same code.
 */
export const STYLING_SYSTEM_IDS = ['tailwind', 'nativewind'] as const;

export type StylingSystemId = (typeof STYLING_SYSTEM_IDS)[number];

export function stylingSystemLabel(id: StylingSystemId): string {
  return id === 'tailwind' ? 'Tailwind CSS' : 'NativeWind';
}
