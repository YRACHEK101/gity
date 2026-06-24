import { describe, it, expect } from "vitest";
import {
  expandHome,
  tildify,
  toGitdirPattern,
  toGitPath,
  isValidProfileName,
  isValidEmail,
} from "../src/utils/paths.js";

/**
 * Test Case 1 — Path normalization.
 * `~` must resolve to the real home on macOS/Linux, and Windows-style paths
 * must normalize to the forward-slash form Git stores on disk.
 */
describe("path normalization", () => {
  describe("macOS / Linux", () => {
    const home = "/Users/alice";

    it("expands a leading ~", () => {
      expect(expandHome("~/Development/work", home)).toBe("/Users/alice/Development/work");
    });

    it("expands a bare ~", () => {
      expect(expandHome("~", home)).toBe(home);
    });

    it("leaves absolute paths untouched", () => {
      expect(expandHome("/opt/code", home)).toBe("/opt/code");
    });

    it("tildifies a home-relative path back to ~", () => {
      expect(tildify("/Users/alice/dev/work", home)).toBe("~/dev/work");
    });

    it("builds a gitdir pattern with a trailing slash", () => {
      expect(toGitdirPattern("~/dev/work", home)).toBe("~/dev/work/");
    });
  });

  describe("Windows", () => {
    const home = "C:\\Users\\alice";

    it("normalizes backslashes to the git-native forward-slash form", () => {
      expect(toGitPath("C:\\Users\\alice\\dev")).toBe("C:/Users/alice/dev");
    });

    it("tildifies a Windows home path to ~ with forward slashes", () => {
      expect(tildify("C:\\Users\\alice\\dev\\work", home)).toBe("~/dev/work");
    });

    it("is case-insensitive about the drive/home prefix", () => {
      expect(tildify("c:\\users\\alice\\repo", home)).toBe("~/repo");
    });
  });

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
