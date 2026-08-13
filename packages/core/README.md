# @repo2ds/core

Framework-independent core of Repo2DS: the models, the repository scanner, framework and styling
detection, token inference and report building.

Most people want the CLI instead:

```bash
npx repo2ds scan ./my-project
```

This package is for building on top of Repo2DS — a custom pipeline, another framework adapter, or a
different report format. It contains no React or React Native specifics; those live in
`@repo2ds/react` and `@repo2ds/react-native`.

## Usage

```ts
import { AnalysisPipeline, DiagnosticCollector } from '@repo2ds/core';
import { ReactAdapter } from '@repo2ds/react';

const rootDir = '/path/to/repo';
const diagnostics = new DiagnosticCollector();

const result = await new AnalysisPipeline({
  rootDir,
  diagnostics,
  adapters: [new ReactAdapter({ rootDir, diagnostics })],
}).run();

console.log(result.report.statistics);
```

The pipeline never executes code from the repository it analyses, and the same repository always
produces the same report.

## What is here

| Export                 | Purpose                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `AnalysisPipeline`     | Scan, analyse, infer tokens and build a report             |
| `RepositoryScanner`    | File discovery and syntax-only parsing, one file at a time |
| `FrameworkAdapter`     | The port a framework adapter implements                    |
| `ClassStyleAdapter`    | The port a utility-class parser implements                 |
| `StoryGenerator`       | The port a Storybook generator implements                  |
| `TokenInferenceEngine` | Groups repeated style values into scored token candidates  |
| `buildReport`          | Assembles the versioned JSON report                        |

## License

[MIT](./LICENSE)
