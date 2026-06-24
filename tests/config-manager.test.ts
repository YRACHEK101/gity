import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  addProfile,
  ensureInclude,
  hasIncludeFor,
  listProfiles,
  makeProfile,
  parseGitConfig,
  extractKeyPath,
  type Paths,
} from "../src/config-manager.js";

/**
 * Test Case 2 — Gitconfig parsing & appending.
 * We use an isolated temporary HOME (true filesystem isolation, no shared
 * state) and assert the `add` action APPENDS the includeIf block without
 * wiping out pre-existing user sections or other profiles.
 */
describe("config-manager", () => {
  let home: string;
  let opts: Paths;

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "gity-test-"));
    opts = { home, globalConfigPath: path.join(home, ".gitconfig") };
  });

  afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true });
  });

  describe("parseGitConfig", () => {
    it("parses sections, subsections and quoted values", () => {
      const entries = parseGitConfig(
        [
          "[user]",
          "\tname = Existing User",
          "\temail = me@home.com",
          '[includeIf "gitdir:~/dev/work/"]',
          "\tpath = ~/.gitconfig-work",
        ].join("\n")
      );

      expect(entries).toContainEqual({
        section: "user",
        subsection: undefined,
        key: "name",
        value: "Existing User",
      });
      expect(entries).toContainEqual({
        section: "includeif",
        subsection: "gitdir:~/dev/work/",
        key: "path",
        value: "~/.gitconfig-work",
      });
    });

    it("ignores comments and blank lines", () => {
      const entries = parseGitConfig("# a comment\n; another\n\n[user]\nname = X\n");
      expect(entries).toEqual([{ section: "user", subsection: undefined, key: "name", value: "X" }]);
    });
  });

  describe("ensureInclude (non-destructive append)", () => {
    it("preserves pre-existing config and appends the include block", () => {
      const original = "[user]\n\tname = Existing User\n\temail = me@home.com\n";
      fs.writeFileSync(opts.globalConfigPath!, original);

      const profile = makeProfile(
        { name: "work", fullName: "Work Me", email: "me@work.com", dir: "~/dev/work" },
        opts
      );
      const added = ensureInclude(profile, opts);

      const after = fs.readFileSync(opts.globalConfigPath!, "utf8");
      expect(added).toBe(true);
      // Original content survives verbatim.
      expect(after).toContain(original.trim());
      expect(after).toContain('[includeIf "gitdir:~/dev/work/"]');
      expect(after).toContain("path = ~/.gitconfig-work");
    });

    it("does not duplicate an include that already exists (idempotent)", () => {
      const profile = makeProfile(
        { name: "work", fullName: "Work Me", email: "me@work.com", dir: "~/dev/work" },
        opts
      );
      expect(ensureInclude(profile, opts)).toBe(true);
      expect(ensureInclude(profile, opts)).toBe(false); // second time: no-op

      const after = fs.readFileSync(opts.globalConfigPath!, "utf8");
      const occurrences = after.split('[includeIf "gitdir:~/dev/work/"]').length - 1;
      expect(occurrences).toBe(1);
    });

    it("keeps multiple distinct profiles side by side", () => {
      const work = makeProfile({ name: "work", fullName: "W", email: "w@x.com", dir: "~/dev/work" }, opts);
      const personal = makeProfile({ name: "personal", fullName: "P", email: "p@x.com", dir: "~/dev/personal" }, opts);
      ensureInclude(work, opts);
      ensureInclude(personal, opts);

      const after = fs.readFileSync(opts.globalConfigPath!, "utf8");
      expect(after).toContain("gitdir:~/dev/work/");
      expect(after).toContain("gitdir:~/dev/personal/");
    });
  });

  describe("hasIncludeFor", () => {
    it("matches case-insensitively on the gitdir pattern", () => {
      const content = '[includeIf "gitdir:~/Dev/Work/"]\n\tpath = ~/.gitconfig-work\n';
      expect(hasIncludeFor(content, "~/Dev/Work/")).toBe(true);
      expect(hasIncludeFor(content, "~/dev/other/")).toBe(false);
    });
  });

  describe("addProfile + listProfiles round-trip", () => {
    it("writes the sub-config and discovers it back", () => {
      const result = addProfile(
        { name: "work", fullName: "Work Me", email: "me@work.com", dir: "~/dev/work" },
        opts
      );

      // Sub-config file exists with the right identity.
      const sub = fs.readFileSync(result.profile.subConfigPath, "utf8");
      expect(sub).toContain("email = me@work.com");
      expect(sub).toContain("sshCommand =");

      const profiles = listProfiles(opts);
      expect(profiles).toHaveLength(1);
      expect(profiles[0]).toMatchObject({
        name: "work",
        email: "me@work.com",
        dir: "~/dev/work/",
      });
      expect(profiles[0].sshKeyPath).toContain("id_ed25519_work");
    });
  });

  describe("extractKeyPath", () => {
    it("pulls the -i argument out of a sshCommand", () => {
      expect(extractKeyPath("ssh -i ~/.ssh/id_ed25519_work -o IdentitiesOnly=yes")).toContain(
        "id_ed25519_work"
      );
    });
    it("handles a quoted path", () => {
      expect(extractKeyPath('ssh -i "~/.ssh/my key" -o IdentitiesOnly=yes')).toContain("my key");
    });
  });
});
