/** Not a component: no JSX, lower-case name. Discovery must ignore it. */
export function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

/** Not a component either, despite the capitalised name: it returns a string. */
export function Titlecase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
