# @repo2ds/nativewind

NativeWind support for Repo2DS. NativeWind is Tailwind syntax compiled for React Native, so this is
a configuration of `@repo2ds/tailwind` rather than a second parser: same utilities, same scale,
reported as `nativewind`.

Most people want the CLI instead:

```bash
npx repo2ds scan ./my-app
```

## Usage

```ts
import { NativeWindStyleAdapter } from '@repo2ds/nativewind';
import { ReactNativeAdapter } from '@repo2ds/react-native';

const adapter = new ReactNativeAdapter({
  rootDir,
  diagnostics,
  classStyleAdapter: new NativeWindStyleAdapter(),
});
```

## Behaviour worth knowing

A Tailwind spacing unit maps to a density-independent pixel, so `p-4` is 16 on both platforms. That
means a value written as a utility class groups with the same value written in a `StyleSheet.create`
entry, which is what makes a shared scale visible across a codebase that uses both.

Utilities that only mean something on the web are dropped: recording `display: grid` for a native
screen would describe styling that cannot apply.

## License

[MIT](./LICENSE)
