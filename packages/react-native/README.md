# @repo2ds/react-native

React Native adapter for Repo2DS. Reads `StyleSheet.create` declarations, inline styles and
component props from React Native sources, and writes React Native Storybook stories.

Most people want the CLI instead:

```bash
npx repo2ds scan ./my-app
```

## Usage

```ts
import { AnalysisPipeline, DiagnosticCollector } from '@repo2ds/core';
import { ReactNativeAdapter } from '@repo2ds/react-native';
import { NativeWindStyleAdapter } from '@repo2ds/nativewind';

const rootDir = '/path/to/app';
const diagnostics = new DiagnosticCollector();

const result = await new AnalysisPipeline({
  rootDir,
  diagnostics,
  adapters: [
    new ReactNativeAdapter({
      rootDir,
      diagnostics,
      // Optional: interpret NativeWind classes as styles.
      classStyleAdapter: new NativeWindStyleAdapter(),
    }),
  ],
}).run();
```

A repository can hold both web and native code. Offer this adapter before `ReactAdapter`: React
Native files also contain JSX, so the more specific adapter has to see each file first.

## What it recognises

- Files importing `react-native` or a `react-native-*` package, and files declaring a style sheet
- `StyleSheet.create` entries, attributed to the component that renders them
- Every style prop, including `contentContainerStyle` and style arrays
- Component discovery and prop extraction inherited from `@repo2ds/react`

A shared `styles.card` is counted once however many screens render it: it is one design decision.

## License

[MIT](./LICENSE)
