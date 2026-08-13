# Repo2DS

**Reverse-engineer a design system from an existing React or React Native codebase.**

Repo2DS reads your source code and tells you what design system you already have: which
components exist, what props they take, which style values are repeated often enough to look like
design tokens, and what Storybook stories would document them.

```text
Existing application
        ↓
Static analysis
        ↓
Component inventory
        ↓
Style analysis
        ↓
Token candidates
        ↓
Storybook generation
```

**Repo2DS does not require an LLM.** There is no API key, no account, no database and no network
call. V1 is a deterministic static analyser: the same repository always produces the same report,
and your source code never leaves your machine.

## Status

V1 is complete: every phase below is implemented, tested and usable.

| Area                                                               | Status      |
| ------------------------------------------------------------------ | ----------- |
| Repository scanner: discovery, ignore patterns, TypeScript parsing | Implemented |
| React adapter: components, props, inline styles, imported CSS      | Implemented |
| Token inference: colors, spacing, typography, radius, confidence   | Implemented |
| Tailwind adapter                                                   | Implemented |
| Storybook generation (CSF3) and the JSON report                    | Implemented |
| React Native adapter: `StyleSheet.create`, inline styles           | Implemented |
| NativeWind adapter (reuses the Tailwind parser)                    | Implemented |
| CLI: `scan`, `components`, `tokens`, `generate`, config loading    | Implemented |

## Install

Requires Node 20.19 or newer.

```bash
npx repo2ds scan ./my-project
```

Or add it to a project:

```bash
npm install --save-dev repo2ds
```

## Usage

There are four commands. Each one analyses the repository you point it at; they differ only in what
they report.

```bash
repo2ds scan ./my-project        # what is in here?
repo2ds components ./my-project  # which components exist?
repo2ds tokens ./my-project      # which values repeat enough to be tokens?
repo2ds generate ./my-project    # write stories, the report and the tokens file
```

### `scan`

```text
Repo2DS

Project                  example-app
Framework                React
Files scanned            182
Components               34
Styled components        31
Tailwind CSS components  28

Potential tokens
Colors      12
Spacing     7
Typography  5
Radius      3
Shadows     1

Scan completed with no warnings.
```

### `components`

```bash
repo2ds components ./my-project --filter Button --props
```

```text
Button  React · 5 props · 11 styles
  src/components/Button.tsx
  label: string
  variant?: 'primary' | 'secondary' = 'primary'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  onPress?: function
```

### `tokens`

```bash
repo2ds tokens ./my-project --category spacing --locations
```

```text
Spacing:
  16  5 uses · confidence 0.59
    src/components/Badge.tsx:8:5
    src/components/Button.tsx:16:7
    src/components/Card.tsx:12:7
```

Confidence is a hint, not a verdict: it summarises how often a value repeats, across how many
components and files, and whether it is used for a property where design decisions usually live.

A use is a place where the value is written: a `style` object, a utility class, a `StyleSheet.create`
entry or a stylesheet declaration. A shared declaration counts once however many components use it,
because it represents one design decision — the component and file counts behind the score are what
show how far it reaches.

### `generate`

```bash
repo2ds generate ./my-project --dry-run
```

Writes Storybook stories, plus `.repo2ds/report.json` and `.repo2ds/design-tokens.json`. Nothing
already on disk is overwritten unless you pass `--force`: a story that was edited by hand is the
source of truth, not the generated one.

Where the stories go depends on the layout.

**`beside`** puts `Button.stories.tsx` next to `Button.tsx`, following the convention a project
that already writes stories has settled on:

```text
src/components/
├── Button.tsx
└── Button.stories.tsx
```

**`folder`** builds a directory of component folders instead, and leaves the application alone. No
file the application owns is written, moved, or reimported:

```text
repo2ds/components/
├── README.md
└── Button/
    ├── Button.tsx          re-exports src/components/Button
    ├── Button.types.ts     re-exports its props type, if the source exports one
    ├── Button.stories.tsx  a story, importing the re-export
    ├── Button.example.tsx  the component used with the props it expects
    └── index.ts
```

Every file in a folder points back at the original component, so there is still exactly one copy of
your code and the two cannot drift. Deleting the directory changes nothing. To adopt a component,
move its implementation into the folder and replace the re-export; Repo2DS then leaves that folder
alone, since a component that already lives there cannot be re-exported from itself.

**`auto`**, the default, uses `beside` when the repository already has stories and `folder` when it
has none, on the grounds that a project with no stories has no convention to follow yet. Stories
Repo2DS generated itself do not count, so repeated runs keep the same layout.

### Flags

Every command accepts:

| Flag                   | Meaning                                            |
| ---------------------- | -------------------------------------------------- |
| `--include <globs...>` | Glob patterns to analyse, replacing the defaults   |
| `--exclude <globs...>` | Glob patterns to ignore, replacing the defaults    |
| `--max-file-size <kb>` | Skip files larger than this many kilobytes         |
| `--min-usage <count>`  | How often a value must repeat to be a candidate    |
| `--config <path>`      | Use this config file instead of searching for one  |
| `--json`               | Print machine-readable output instead of a summary |

Command specific flags:

| Command      | Flag                         | Meaning                                                     |
| ------------ | ---------------------------- | ----------------------------------------------------------- |
| `components` | `--filter <text>`            | Only components whose name contains this text               |
| `components` | `--props`                    | List each component's props                                 |
| `tokens`     | `--category <name>`          | One of `color`, `spacing`, `typography`, `radius`, `shadow` |
| `tokens`     | `--min-confidence <score>`   | Hide candidates below this score (0–1)                      |
| `tokens`     | `--locations`                | Show where each value was found                             |
| `generate`   | `--out <dir>`                | Directory for the JSON artifacts                            |
| `generate`   | `--layout <mode>`            | One of `auto`, `beside`, `folder`                           |
| `generate`   | `--components-dir <dir>`     | Directory for the generated component folders               |
| `generate`   | `--storybook-package <name>` | Package the stories import CSF types from                   |
| `generate`   | `--no-stories`               | Skip Storybook stories                                      |
| `generate`   | `--no-report`                | Skip `report.json`                                          |
| `generate`   | `--no-tokens`                | Skip `design-tokens.json`                                   |
| `generate`   | `--force`                    | Overwrite generated files that already exist                |
| `generate`   | `--dry-run`                  | Report what would be written, write nothing                 |

## Architecture

Repo2DS is a pipeline of small, independent stages. Framework knowledge lives only in adapters, so
supporting another framework means adding an adapter rather than editing the core.

```text
RepositoryScanner      find and parse files
        ↓
FrameworkDetector      React, React Native, or both
        ↓
FrameworkAdapter       components, props, styles
        ↓
StyleAdapters          inline, StyleSheet, Tailwind, NativeWind
        ↓
TokenInferenceEngine   repeated values → token candidates
        ↓
ReportGenerator        .repo2ds/report.json
        ↓
StoryGenerator         *.stories.tsx
```

| Package                 | Responsibility                                                         |
| ----------------------- | ---------------------------------------------------------------------- |
| `@repo2ds/core`         | Framework-independent models, scanner, detection, inference, reporting |
| `@repo2ds/react`        | React components, props, inline styles, imported stylesheets           |
| `@repo2ds/react-native` | React Native primitives, `StyleSheet.create`, RN stories               |
| `@repo2ds/tailwind`     | Tailwind utility class parsing                                         |
| `@repo2ds/nativewind`   | NativeWind, configured from the Tailwind parser                        |
| `repo2ds`               | The CLI, and the only place that knows which adapters exist            |

The Tailwind parser is shared: the NativeWind adapter configures it rather than reimplementing class
parsing, so `p-4` means 16 on both platforms and a value written in a utility class groups with the
same value written in a stylesheet.

The core models (`ComponentInfo`, `PropInfo`, `StyleUsage`, `TokenCandidate`, `ScanReport`) contain
no React or React Native specifics. The JSON report is a versioned public contract, so downstream
tooling can consume it instead of re-analysing source code.

## Configuration

Repo2DS works with no configuration. To override the defaults, add `repo2ds.config.ts` to your
repository root:

```ts
export default {
  framework: 'auto', // 'auto' | 'react' | 'react-native'

  include: ['src/**/*.{ts,tsx,js,jsx}'],

  exclude: ['node_modules', 'dist', 'build', '.next'],

  storybook: {
    enabled: true,
    layout: 'auto', // 'auto' | 'beside' | 'folder'
    componentsDir: 'repo2ds/components', // used by the folder layout
    package: '@storybook/react', // '@storybook/react-vite' and '@storybook/nextjs' on Storybook 9
  },

  tokens: {
    enabled: true,
    minUsageCount: 2, // a value seen once is an occurrence, twice is a pattern
  },
};
```

`repo2ds.config.ts`, `.mts`, `.js`, `.mjs`, `.cjs` and `.json` are all supported, in that order of
preference, and a config may export a function if it needs to compute its settings. Importing a
TypeScript config requires a Node version that can strip types (22.6 with a flag, 23.6 onwards); on
older runtimes use the `.js` or `.json` form. Command line flags override the config file.

`include` and `exclude` replace the built-in defaults rather than extending them. Bare directory
names such as `dist` are treated as "this directory, anywhere".

Config files are validated when they load. A misspelled option or a value of the wrong type is an
error that names the option, rather than a setting that is silently ignored.

## Safety

Repo2DS is a static analyser, and stays one deliberately. It never:

- executes application code or scripts from the repository it scans,
- resolves or installs dependencies,
- uploads or transmits source code,
- requires credentials of any kind,
- edits, moves or deletes a file the application already owns.

Everything Repo2DS writes is new. `generate` only ever adds files, never overwrites one without
`--force`, and `--dry-run` lists the whole set before any of it is written. `componentsDir` has to
be a relative path inside the repository, so a config file cannot direct output somewhere else.

Files are parsed for syntax only. No `tsconfig.json` is loaded and the type checker is never
invoked, so scans work even on repositories that do not currently compile.

## Resilience

One unsupported file never fails a scan. Problems are reported as diagnostics with a status of
`warning`, `error` or `skipped`, the scan continues, and the run ends with a summary:

```text
⚠ syntax-error src/Button.tsx:42:3 — File has syntax errors; analysis of this file may be incomplete.
Scan completed with 1 warning.
```

Diagnostics describe the repository, not the tool, so they do not fail the command: a scan that
finished exits `0` even when files were skipped, and the full list is in the JSON report. An exit code
of `1` means the command itself could not do its job — the path does not exist, the config is invalid,
or a file could not be written. That makes `repo2ds` safe to run in CI without a wrapper.

## Limitations

These are design decisions for V1, not bugs. Where Repo2DS cannot read something it usually says
so in a diagnostic, because output that looks complete and is not would be worse than a warning.

Repo2DS reports structure and style, never behaviour: business logic is not analysed.

### Components and props

- **Props come from TypeScript annotations or `propTypes`.** A JavaScript project gets its props
  from `propTypes` and `defaultProps`, including `oneOf` enums. Props described only in JSDoc are
  not read.
- **Full TypeScript type resolution is out of scope.** Common prop shapes are handled precisely;
  anything else is reported as `unknown` rather than guessed.
- **A props type imported from another file is not resolved.** It is reported as
  `unresolved-props-type` and the component gets no props. Resolving it would mean running the
  type checker, which V1 deliberately does not do.
- **A props type computed from other types is not resolved either.** `React.ComponentProps<'button'>`,
  `Omit<ButtonProps, 'size'>` and `VariantProps<typeof variants>` are reported as
  `computed-props-type`. On a repository built from primitives this is the most common reason a
  component has no props, so it is reported separately from a type that simply lives elsewhere.
- **A props type that extends itself is reported, not followed.** `circular-props-type` is raised and
  the component gets no props, which is what the TypeScript compiler concludes as well.
- **`propsResolved` says whether to trust an empty props list.** A component with no props and a
  component whose props could not be read both have `"props": []`, and the flag tells them apart.
- **Flow-annotated source is parsed as TypeScript.** Older React Native codebases that use Flow in
  `.js` files produce `syntax-error` diagnostics and yield no props, though their components and
  styles are still found.
- **A component assigned to a property is not discovered.** `Card.Header = ...` is a compound
  component, and only `Card` is reported. Neither is an anonymous `export default function () {}`,
  which has no name to give a story.

### Styles

- **Dynamic runtime styles cannot always be analysed.** `padding: getSpacing(size)` is recorded as
  a dynamic value and excluded from token inference. Repo2DS never evaluates expressions.
- **CSS-in-JS is not parsed.** Values inside a `styled.button` or `css` template literal are not
  read; the file gets a `css-in-js-unsupported` diagnostic instead.
- **Stylesheets imported through a path alias are not resolved.** `import '@/styles/theme.css'`
  produces a `stylesheet-alias-unresolved` diagnostic. Relative imports are followed as usual.
- **Tailwind support covers a defined subset of utilities** (spacing, colors, radius, typography and
  common layout classes), not every utility or arbitrary value.
- **Tailwind values come from Tailwind's default scale.** A project that customises `theme.spacing`
  or `theme.borderRadius` sees the default numbers, because reading the real ones would mean
  evaluating your Tailwind config.
- **Tailwind colour names are reported as written.** `bg-blue-600` is reported as `blue-600`, not as
  the hex value it compiles to. A colour written as a utility class therefore does not group with
  the same colour written as hex.

### Monorepos

Running Repo2DS at a workspace root works: frameworks are detected from the source, and Tailwind or
NativeWind declared by a package up to three directories deep is found. Scanning a package directory
still gives the cleaner report, because the manifest, the styling config and the components then all
describe one thing.

### Tokens and generated files

- **Semantic token names are not inferred.** You get `#2563EB used 124 times`, not `color.primary`.
  Naming requires judgement Repo2DS does not claim to have.
- **Inferred tokens are candidates.** Every candidate carries a confidence score and the evidence
  behind it, because a repeated value is not automatically a design decision.
- **Generated stories may need manual adjustment.** Default args are derived from prop types;
  props with no safely inferable value are omitted.
- **A story is typed as strictly as its args allow.** When every required prop has a value the story
  uses `satisfies Meta<typeof Component>`, which makes Storybook check each arg against the real
  props. When one does not — a required list, a shape, a type from another file — the story falls
  back to `const meta: Meta<typeof Component>` and names the missing props in a comment, because a
  story that does not compile helps nobody.
- **An example takes the props it cannot invent.** Where a required prop has no inferable value the
  generated example accepts it as a parameter rather than making one up, so the file compiles and
  the gap is visible in the code.
- **Stories import `@storybook/react` by default.** Storybook 9 moved the CSF types to the framework
  package, so pass `--storybook-package @storybook/react-vite`, `@storybook/nextjs` or whichever the
  project uses if you are on 9 and have removed `@storybook/react`.
- **Platform variants become one component.** `Button.tsx`, `Button.ios.tsx` and `Button.android.tsx`
  get a single story that imports `./Button`, leaving the bundler to resolve the platform. The
  variants are still scanned, so their style values count towards token inference.
- **Generated component folders re-export, they do not restructure.** The folder layout proposes a
  design-system shape without moving your code. Adopting it is a manual decision, one component at
  a time.
- **A props type is only re-exported when the source file exports it.** A type declared inline or
  kept private gets no `.types.ts` rather than an approximate interface rebuilt from the props
  Repo2DS could resolve.

## Development

```bash
npm install
npm test          # vitest
npm run typecheck
npm run lint
npm run build
npm run verify    # format, lint, typecheck and test
```

The packages are published from this monorepo in dependency order with `npm run release`, which
verifies and rebuilds first.

Run the CLI from source against a fixture:

```bash
npm run repo2ds -- scan fixtures/react-basic
```

Fixtures under `fixtures/` are small, checked-in repositories used as test inputs. They are
deliberately excluded from linting and type checking: they represent other people's code.

| Fixture                   | What it covers                                              |
| ------------------------- | ----------------------------------------------------------- |
| `react-basic`             | React components, props, inline styles, ignored files       |
| `react-tailwind`          | Tailwind utility classes, including conditional class names |
| `react-native-basic`      | `StyleSheet.create`, shared styles, a dynamic style value   |
| `react-native-nativewind` | NativeWind classes alongside a stylesheet                   |
| `react-mixed`             | React and React Native together, plus CSS custom properties |

## Contributing

Issues and pull requests are welcome. Two guidelines matter most:

1. **Framework specifics belong in adapters.** If a change adds `if (framework === ...)` to core,
   it probably belongs behind the `FrameworkAdapter` port instead.
2. **Output must stay deterministic.** No timestamps, absolute paths or unordered iteration in
   reports or generated files.

## License

[MIT](./LICENSE)

Repo2DS reproduces Tailwind's default spacing, radius and typography scales in
`@repo2ds/tailwind` so that utility classes and raw pixel values can be compared. Tailwind CSS is
a separate project, [MIT licensed](https://github.com/tailwindlabs/tailwindcss/blob/main/LICENSE),
and is not affiliated with Repo2DS.
