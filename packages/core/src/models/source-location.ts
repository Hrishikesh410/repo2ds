/** 1-based line, 1-based column, matching editor and `file:line:col` conventions. */
export interface SourceLocation {
  line: number;
  column: number;
}

/** Formats a location as `src/Button.tsx:42:7`, or just the path when unknown. */
export function formatLocation(filePath: string, location?: SourceLocation): string {
  return location ? `${filePath}:${location.line}:${location.column}` : filePath;
}
