# @repo2ds/react

React adapter for Repo2DS. Finds components, reads their props, and records the styles they declare
inline or in imported stylesheets.

Most people want the CLI instead:

```bash
npx repo2ds scan ./my-project
```

## Usage

```ts
import { DiagnosticCollector, AnalysisPipeline } from '@repo2ds/core';
import { ReactAdapter } from '@repo2ds/react';
import { TailwindStyleAdapter } from '@repo2ds/tailwind';

const rootDir = '/path/to/repo';
const diagnostics = new DiagnosticCollector();

const result = await new AnalysisPipeline({
  rootDir,
  diagnostics,
  adapters: [
    new ReactAdapter({
      rootDir,
      diagnostics,
      // Optional: interpret className utilities as styles.
      classStyleAdapter: new TailwindStyleAdapter(),
    }),
  ],
}).run();
```

## What it recognises

- Function components, arrow components, `React.FC` annotations and class components
- Props from an interface, a type alias, an inline object type, or destructured parameters, with
  default values when they are statically visible
- `style={{ ... }}` objects, including both branches of a conditional and nested objects
- `className` strings, when a `ClassStyleAdapter` is supplied
- Imported `.css`, `.scss`, `.sass` and `.less` files, resolving `var(--token)` references to the
  values declared in the same stylesheet

Anything that cannot be resolved without running the code is recorded as a dynamic value and left
out of token inference rather than guessed.

`ReactStoryGenerator` writes Storybook CSF3 stories from a discovered component.

## License

[MIT](./LICENSE)
