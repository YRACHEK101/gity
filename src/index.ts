#!/usr/bin/env node
/** gity entry point. */
import pc from "picocolors";
import { run } from "./cli.js";

run(process.argv).catch((err) => {
  console.error(pc.red(`\ngity: ${err instanceof Error ? err.message : String(err)}`));
  process.exit(1);
});
