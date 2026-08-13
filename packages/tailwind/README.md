# @repo2ds/tailwind

Tailwind CSS support for Repo2DS. Turns utility classes into the style values they represent, so
`px-4 rounded-lg bg-blue-600` becomes padding 16, radius 8 and a colour.

Most people want the CLI instead:

```bash
npx repo2ds scan ./my-project
```

## Usage

```ts
import { TailwindStyleAdapter, parseTailwindClasses } from '@repo2ds/tailwind';

parseTailwindClasses('md:px-4 rounded-lg');
// [{ property: 'padding-left/right', value: 16, variants: ['md'], ... }, ...]

const adapter = new TailwindStyleAdapter();
adapter.parseClassNames('px-4', { filePath: 'src/Button.tsx', componentName: 'Button' });
```

Pass the adapter to `ReactAdapter` as its `classStyleAdapter` to have `className` strings read as
styles.

## What it covers

Spacing, colours, radius, typography and the common layout utilities, including variants
(`md:`, `hover:`), the `!` important prefix, negative values and arbitrary values (`p-[13px]`).

Values come from Tailwind's default scale: `p-4` is 16, `rounded-lg` is 8, `text-sm` is 14. A custom
`tailwind.config.js` is not evaluated, because that would mean running code from the repository being
scanned. Colours are reported as written (`blue-600`), not as the hex value they compile to.

Utilities the parser does not recognise are ignored rather than guessed at, so a project class name
such as `card-header` is never mistaken for a utility.

## License

[MIT](./LICENSE)
