/**
 * `plural(1, 'component')` gives `1 component`, `plural(3, 'component')` gives
 * `3 components`. Only regular nouns are handled; irregular plurals are written
 * out where they are needed.
 */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
