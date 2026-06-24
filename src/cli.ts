/** Commander setup: defines the `gity` command surface. */
import { createRequire } from "node:module";
import { Command } from "commander";
import pc from "picocolors";
import { addCommand } from "./commands/add.js";
import { listCommand } from "./commands/list.js";
import { testCommand } from "./commands/test.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string; description: string };

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("gity")
    .description(pkg.description)
    .version(pkg.version, "-v, --version", "print the gity version");

  program
    .command("add")
    .description("Add a new Git/GitHub profile (interactive wizard)")
    .action(async () => {
      await addCommand();
    });

  program
    .command("list")
    .alias("ls")
    .description("List configured profiles, their directories and emails")
    .action(() => listCommand());

  program
    .command("test")
    .alias("t")
    .argument("[profile]", "test only this profile")
    .description("Verify each profile's SSH key authenticates with GitHub")
    .action((profile?: string) => testCommand(profile));

  program.configureOutput({
    outputError: (str, write) => write(pc.red(str)),
  });

  return program;
}

export async function run(argv: string[]): Promise<void> {
  const program = buildProgram();
  // No sub-command → show help instead of an error.
  if (argv.length <= 2) {
    program.help();
  }
  await program.parseAsync(argv);
}
