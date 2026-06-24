/**
 * `gity add` — interactive wizard that wires up a new Git identity:
 * directory, sub-config, global `includeIf`, and (optionally) a fresh SSH key.
 */
import fs from "node:fs";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  addProfile,
  defaultKeyPath,
  makeProfile,
  subConfigExists,
  type ProfileInput,
} from "../config-manager.js";
import {
  generateKey,
  KeyExistsError,
  readPublicKey,
  SshBinaryNotFoundError,
} from "../ssh-manager.js";
import { isValidEmail, isValidProfileName, tildify, toAbsolute } from "../utils/paths.js";

/** Abort cleanly if the user pressed Ctrl-C during a prompt. */
function bail<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel("Cancelled — nothing was changed.");
    process.exit(0);
  }
  return value as T;
}

export async function addCommand(): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" gity — add a profile ")));

  const name = bail(
    await p.text({
      message: "Unique name for this profile (e.g. personal, work, company):",
      validate: (v) => {
        if (!v?.trim()) return "Please enter a name.";
        if (!isValidProfileName(v.trim()))
          return "Use only letters, digits, dot, dash or underscore.";
        return undefined;
      },
    })
  ).trim();

  if (subConfigExists(name)) {
    const overwrite = bail(
      await p.confirm({
        message: `A profile config "~/.gitconfig-${name}" already exists. Overwrite it?`,
        initialValue: false,
      })
    );
    if (!overwrite) {
      p.cancel("Aborted — existing profile left untouched.");
      return;
    }
  }

  const fullName = bail(
    await p.text({
      message: "Full name for Git commits:",
      validate: (v) => (v?.trim() ? undefined : "Please enter a name."),
    })
  ).trim();

  const email = bail(
    await p.text({
      message: "Email address for this GitHub profile:",
      validate: (v) => (isValidEmail(v?.trim() ?? "") ? undefined : "Please enter a valid email."),
    })
  ).trim();

  const dir = bail(
    await p.text({
      message: "Absolute path to this profile's projects directory:",
      placeholder: `~/Development/${name}`,
      defaultValue: `~/Development/${name}`,
      validate: (v) => (v?.trim() ? undefined : "Please enter a directory."),
    })
  ).trim();

  const wantsKey = bail(
    await p.confirm({
      message: "Generate a new SSH key for this profile?",
      initialValue: true,
    })
  );

  // Resolve the directory and offer to create it if missing.
  const absDir = toAbsolute(dir);
  if (!fs.existsSync(absDir)) {
    const create = bail(
      await p.confirm({ message: `Directory ${tildify(absDir)} does not exist. Create it?`, initialValue: true })
    );
    if (create) {
      fs.mkdirSync(absDir, { recursive: true });
      p.log.success(`Created ${tildify(absDir)}`);
    }
  }

  const input: ProfileInput = { name, fullName, email, dir };
  let keyPath = defaultKeyPath(name);

  // ----- SSH key -----
  if (wantsKey) {
    const s = p.spinner();
    s.start("Generating ed25519 SSH key");
    try {
      generateKey({ keyPath, email });
      s.stop(`SSH key created at ${tildify(keyPath)}`);
    } catch (err) {
      if (err instanceof KeyExistsError) {
        s.stop(pc.yellow("Key already exists — reusing it."));
      } else if (err instanceof SshBinaryNotFoundError) {
        s.stop(pc.yellow("Skipped key generation."));
        p.log.warn(err.message);
      } else {
        s.stop(pc.red("Key generation failed."));
        p.log.error(err instanceof Error ? err.message : String(err));
      }
    }
  } else {
    const provided = bail(
      await p.text({
        message: "Path to the existing private key to use for this profile:",
        placeholder: tildify(keyPath),
        defaultValue: tildify(keyPath),
      })
    ).trim();
    keyPath = toAbsolute(provided);
    input.sshKeyPath = keyPath;
  }

  // ----- Write configs -----
  const result = addProfile(input);
  p.log.success(`Wrote ${tildify(result.profile.subConfigPath)}`);
  p.log.success(
    result.includeAdded
      ? `Linked ${tildify(result.globalConfigPath)} -> directory ${result.profile.gitdirPattern}`
      : `Global include for ${result.profile.gitdirPattern} was already present`
  );

  // ----- Show the public key with clear instructions -----
  try {
    const pub = readPublicKey(keyPath);
    p.note(pc.green(pub), "Public key");
    p.log.info(
      "Copy the public key above and add it to GitHub:\n" +
        pc.cyan("  Settings → SSH and GPG keys → New SSH key")
    );
  } catch {
    p.log.warn(`No public key found at ${tildify(keyPath + ".pub")} — add one before pushing.`);
  }

  const profile = makeProfile(input);
  p.outro(
    `Done! Clone or move repos into ${pc.bold(profile.gitdirPattern)} and they'll use ` +
      `${pc.bold(email)} automatically.\nRun ${pc.cyan(`gity test ${name}`)} to verify GitHub access.`
  );
}
