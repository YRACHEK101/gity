/** `gity list` (alias `ls`) — print all configured profiles as a table. */
import pc from "picocolors";
import { listProfiles } from "../config-manager.js";
import { tildify } from "../utils/paths.js";
import { renderTable } from "../utils/table.js";

export function listCommand(): void {
  const profiles = listProfiles();

  if (profiles.length === 0) {
    console.log(
      pc.yellow("No gity profiles found.") + ` Run ${pc.cyan("gity add")} to create one.`
    );
    return;
  }

  const rows = profiles.map((p) => [
    pc.bold(p.name),
    p.dir ?? pc.dim("(not linked)"),
    p.email ?? pc.dim("(unknown)"),
    p.sshKeyPath
      ? (p.keyExists ? "" : pc.red("missing ")) + tildify(p.sshKeyPath)
      : pc.dim("(none)"),
  ]);

  console.log(renderTable(["Profile", "Directory", "Email", "SSH Key"], rows));
  console.log(pc.dim(`\n${profiles.length} profile(s). Run "gity test" to verify GitHub access.`));
}
