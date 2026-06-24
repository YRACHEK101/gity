/**
 * `gity test` (alias `t`) — verify each profile's SSH key authenticates with
 * GitHub. Optionally pass a single profile name to test just that one.
 */
import pc from "picocolors";
import { listProfiles } from "../config-manager.js";
import { testProfile } from "../ssh-manager.js";
import { tildify } from "../utils/paths.js";

export function testCommand(only?: string): void {
  let profiles = listProfiles();
  if (only) profiles = profiles.filter((p) => p.name === only);

  if (profiles.length === 0) {
    console.log(
      only
        ? pc.yellow(`No profile named "${only}".`)
        : pc.yellow("No gity profiles found.") + ` Run ${pc.cyan("gity add")} to create one.`
    );
    return;
  }

  console.log(pc.bold("Testing GitHub authentication...\n"));

  let failures = 0;
  for (const p of profiles) {
    if (!p.sshKeyPath) {
      console.log(`${pc.yellow("?")} ${pc.bold(p.name)} — no SSH key configured`);
      failures++;
      continue;
    }
    if (!p.keyExists) {
      console.log(`${pc.red("✗")} ${pc.bold(p.name)} — key not found at ${tildify(p.sshKeyPath)}`);
      failures++;
      continue;
    }

    const result = testProfile({ keyPath: p.sshKeyPath });
    if (result.ok) {
      console.log(`${pc.green("✓")} ${pc.bold(p.name)} — authenticated as ${pc.cyan(result.username ?? "?")}`);
    } else {
      failures++;
      const firstLine = result.message.split("\n")[0] ?? "authentication failed";
      console.log(`${pc.red("✗")} ${pc.bold(p.name)} — ${firstLine}`);
    }
  }

  console.log(
    "\n" +
      (failures === 0
        ? pc.green(`All ${profiles.length} profile(s) authenticated successfully.`)
        : pc.yellow(`${failures} of ${profiles.length} profile(s) need attention.`))
  );
  if (failures > 0) process.exitCode = 1;
}
