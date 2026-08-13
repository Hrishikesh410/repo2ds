#!/usr/bin/env node
import { describeError } from '@repo2ds/core';
import { createProgram } from './program.js';
import { ConsoleWriter } from './output/writer.js';

async function main(): Promise<void> {
  const program = createProgram({
    writer: new ConsoleWriter(),
    cwd: process.cwd(),
    colors: process.stdout.isTTY === true && process.env.NO_COLOR === undefined,
  });
  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  console.error(`✖ ${describeError(error)}`);
  process.exitCode = 1;
});
