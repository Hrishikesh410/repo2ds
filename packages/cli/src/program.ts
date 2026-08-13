import { DEFAULT_COMPONENTS_DIR, STORY_LAYOUTS } from '@repo2ds/core';
import { Command, Option } from 'commander';
import type { ComponentsCommandOptions } from './commands/components.js';
import { runComponents } from './commands/components.js';
import type { GenerateCommandOptions } from './commands/generate.js';
import { DEFAULT_OUTPUT_DIR, runGenerate } from './commands/generate.js';
import type { ScanCommandOptions } from './commands/scan.js';
import { runScan } from './commands/scan.js';
import type { CommandEnvironment } from './commands/shared.js';
import type { TokensCommandOptions } from './commands/tokens.js';
import { runTokens } from './commands/tokens.js';
import { CLI_VERSION } from './version.js';

/**
 * Builds the CLI. The environment is injected so tests can drive real commands
 * with an in-memory writer.
 */
export function createProgram(env: CommandEnvironment): Command {
  const program = new Command();

  program
    .name('repo2ds')
    .description(
      'Reverse-engineer a design system from an existing React or React Native codebase.',
    )
    .version(CLI_VERSION)
    .addHelpText(
      'after',
      '\nScan is the default command, so `repo2ds ./my-project` scans that directory.\n',
    );

  withCommonOptions(
    program
      .command('scan', { isDefault: true })
      .argument('[path]', 'path to the repository to scan', '.')
      .description('scan a repository and report what Repo2DS found'),
  ).action(async (target: string, options: ScanCommandOptions) => {
    await runScan(target, options, env);
  });

  withCommonOptions(
    program
      .command('components')
      .argument('[path]', 'path to the repository to scan', '.')
      .description('list the components Repo2DS found')
      .addOption(new Option('--filter <text>', 'only components whose name contains this text'))
      .addOption(new Option('--props', 'list each component\u2019s props')),
  ).action(async (target: string, options: ComponentsCommandOptions) => {
    await runComponents(target, options, env);
  });

  withCommonOptions(
    program
      .command('tokens')
      .argument('[path]', 'path to the repository to scan', '.')
      .description('list repeated style values as design token candidates')
      .addOption(
        new Option('--category <name>', 'only this category').choices([
          'color',
          'spacing',
          'typography',
          'radius',
          'shadow',
        ]),
      )
      .addOption(
        new Option('--min-confidence <score>', 'hide candidates below this score (0-1)').argParser(
          parseConfidence,
        ),
      )
      .addOption(new Option('--locations', 'show where each value was found')),
  ).action(async (target: string, options: TokensCommandOptions) => {
    await runTokens(target, options, env);
  });

  withCommonOptions(
    program
      .command('generate')
      .argument('[path]', 'path to the repository to scan', '.')
      .description('write Storybook stories, the scan report and token candidates')
      .addOption(
        new Option('--out <dir>', 'directory for the JSON artifacts').default(DEFAULT_OUTPUT_DIR),
      )
      // Neither of these carries a Commander default: an unset flag has to stay
      // undefined so that a value in the config file is not overridden by one
      // the user never typed.
      .addOption(
        new Option(
          '--layout <mode>',
          'where stories go; auto uses folders when the repository has none',
        ).choices([...STORY_LAYOUTS]),
      )
      .addOption(
        new Option(
          '--components-dir <dir>',
          `directory for generated component folders (default: "${DEFAULT_COMPONENTS_DIR}")`,
        ),
      )
      .addOption(
        new Option(
          '--storybook-package <name>',
          'package the stories import CSF types from, such as @storybook/react-vite',
        ),
      )
      .addOption(new Option('--no-stories', 'do not write Storybook stories'))
      .addOption(new Option('--no-report', 'do not write report.json'))
      .addOption(new Option('--no-tokens', 'do not write design-tokens.json'))
      .addOption(new Option('--force', 'overwrite generated files that already exist'))
      .addOption(new Option('--dry-run', 'report what would be written without writing it')),
  ).action(async (target: string, options: GenerateCommandOptions) => {
    await runGenerate(target, options, env);
  });

  return program;
}

/** Every command analyses a repository, so every command takes these. */
function withCommonOptions(command: Command): Command {
  return command
    .addOption(
      new Option('--include <globs...>', 'glob patterns to analyse (replaces the defaults)'),
    )
    .addOption(
      new Option('--exclude <globs...>', 'glob patterns to ignore (replaces the defaults)'),
    )
    .addOption(
      new Option('--max-file-size <kb>', 'skip files larger than this many kilobytes').argParser(
        positiveInteger('kilobytes'),
      ),
    )
    .addOption(
      new Option('--min-usage <count>', 'how often a value must repeat to be a token').argParser(
        positiveInteger('usages'),
      ),
    )
    .addOption(new Option('--config <path>', 'path to a repo2ds config file'))
    .addOption(new Option('--json', 'print machine-readable output'));
}

function positiveInteger(unit: string): (value: string) => number {
  return (value) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`Expected a positive number of ${unit}, received "${value}".`);
    }
    return parsed;
  };
}

function parseConfidence(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`Expected a confidence between 0 and 1, received "${value}".`);
  }
  return parsed;
}
