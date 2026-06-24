import { describe, it, expect } from "vitest";
import {
  expandHome,
  toAbsolute,
  tildify,
  toGitdirPattern,
  toGitPath,
  isValidProfileName,
  isValidEmail,
} from "../src/utils/paths.js";

/**
 * Test Case 1 — Path normalization.
 *
 * `expandHome`/`toAbsolute`/`toGitdirPattern` delegate to Node's `path` module,
 * which uses the SEPARATOR of the host OS. In real use `home` always comes from
 * `os.homedir()` (OS-native), so these are correct on every platform — but a test
 * that hard-codes a POSIX home only holds on POSIX, and a Windows home only on
 * Windows. We therefore gate the OS-specific assertions by platform, and keep the
 * pure-string helpers (which are separator-independent) running everywhere.
 */
const isWindows = process.platform === "win32";

describe("path normalization", () => {
  // ---- platform-independent: pure string logic, runs on every OS ----
  describe("platform-independent", () => {
    it("expands a bare ~ to the home directory", () => {
      expect(expandHome("~", "/Users/alice")).toBe("/Users/alice");
    });

    it("leaves paths without a leading ~ untouched", () => {
      expect(expandHome("/opt/code", "/Users/alice")).toBe("/opt/code");
    });

    it("normalizes backslashes to the git-native forward-slash form", () => {
      expect(toGitPath("C:\\Users\\alice\\dev")).toBe("C:/Users/alice/dev");
    });

    it("tildifies a POSIX home-relative path back to ~", () => {
      expect(tildify("/Users/alice/dev/work", "/Users/alice")).toBe("~/dev/work");
    });

    it("tildifies a Windows home path to ~ with forward slashes", () => {
      expect(tildify("C:\\Users\\alice\\dev\\work", "C:\\Users\\alice")).toBe("~/dev/work");
    });

    it("is case-insensitive about the drive/home prefix", () => {
      expect(tildify("c:\\users\\alice\\repo", "C:\\Users\\alice")).toBe("~/repo");
    });
  });

  // ---- POSIX semantics: only valid where path.* produces POSIX paths ----
  describe.skipIf(isWindows)("POSIX path semantics", () => {
    const home = "/Users/alice";

    it("expands a leading ~ using the OS home", () => {
      expect(expandHome("~/Development/work", home)).toBe("/Users/alice/Development/work");
    });

    it("resolves ~ to an absolute path", () => {
      expect(toAbsolute("~/dev/work", home)).toBe("/Users/alice/dev/work");
    });

    it("builds a gitdir pattern with a trailing slash", () => {
      expect(toGitdirPattern("~/dev/work", home)).toBe("~/dev/work/");
    });
  });

  // ---- Windows semantics: only valid where path.* produces Windows paths ----
  describe.runIf(isWindows)("Windows path semantics", () => {
    const home = "C:\\Users\\alice";

    it("expands a leading ~ to the git-native form", () => {
      expect(toGitPath(expandHome("~/dev/work", home))).toBe("C:/Users/alice/dev/work");
    });

    it("builds a gitdir pattern (tildified, trailing slash)", () => {
      expect(toGitdirPattern("~/dev/work", home)).toBe("~/dev/work/");
    });
  });

  // ---- validators: platform-independent ----
  describe("validators", () => {
    it("accepts safe profile names", () => {
      expect(isValidProfileName("work")).toBe(true);
      expect(isValidProfileName("work-2_personal.x")).toBe(true);
    });

    it("rejects names with path separators or spaces", () => {
      expect(isValidProfileName("work/evil")).toBe(false);
      expect(isValidProfileName("two words")).toBe(false);
      expect(isValidProfileName("")).toBe(false);
    });

    it("validates emails permissively", () => {
      expect(isValidEmail("a@b.com")).toBe(true);
      expect(isValidEmail("not-an-email")).toBe(false);
    });
  });
});
