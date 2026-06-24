import { describe, it, expect, vi, beforeEach } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import {
  generateKey,
  readPublicKey,
  testProfile,
  KeyExistsError,
  SshBinaryNotFoundError,
} from "../src/ssh-manager.js";

// Isolate all filesystem + process mutations behind mocks.
vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));
vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(() => false),
    mkdirSync: vi.fn(),
    rmSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}));

const enoent = () => Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" });
const KEY = "/home/alice/.ssh/id_ed25519_work";

/**
 * Test Case 3 — Command-line safety.
 * Shell commands must be spawned with explicit arg arrays (no injection),
 * and a missing binary must surface as a typed, catchable error instead of
 * crashing the runtime.
 */
describe("ssh-manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  describe("generateKey", () => {
    it("invokes ssh-keygen with a safe argument array (no shell string)", () => {
      vi.mocked(spawnSync).mockReturnValue({ status: 0, stdout: "", stderr: "" } as never);

      generateKey({ keyPath: KEY, email: "alice@work.com" });

      expect(spawnSync).toHaveBeenCalledWith(
        "ssh-keygen",
        ["-t", "ed25519", "-C", "alice@work.com", "-f", KEY, "-N", ""],
        expect.objectContaining({ encoding: "utf8" })
      );
    });

    it("throws SshBinaryNotFoundError when ssh-keygen is missing (Windows-safe)", () => {
      vi.mocked(spawnSync).mockReturnValue({ error: enoent() } as never);

      expect(() => generateKey({ keyPath: KEY, email: "a@b.com" })).toThrow(
        SshBinaryNotFoundError
      );
    });

    it("throws KeyExistsError instead of clobbering an existing key", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      expect(() => generateKey({ keyPath: KEY, email: "a@b.com" })).toThrow(KeyExistsError);
      expect(spawnSync).not.toHaveBeenCalled(); // never reached ssh-keygen
    });

    it("removes the old key first when overwrite is requested", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(spawnSync).mockReturnValue({ status: 0 } as never);

      generateKey({ keyPath: KEY, email: "a@b.com", overwrite: true });

      expect(fs.rmSync).toHaveBeenCalledWith(KEY, { force: true });
      expect(fs.rmSync).toHaveBeenCalledWith(KEY + ".pub", { force: true });
      expect(spawnSync).toHaveBeenCalled();
    });

    it("surfaces a non-zero exit as a descriptive error", () => {
      vi.mocked(spawnSync).mockReturnValue({ status: 1, stderr: "boom" } as never);

      expect(() => generateKey({ keyPath: KEY, email: "a@b.com" })).toThrow(/boom/);
    });
  });

  describe("readPublicKey", () => {
    it("reads and trims the .pub file", () => {
      vi.mocked(fs.readFileSync).mockReturnValue("ssh-ed25519 AAAA alice@work.com\n" as never);
      expect(readPublicKey(KEY)).toBe("ssh-ed25519 AAAA alice@work.com");
      expect(fs.readFileSync).toHaveBeenCalledWith(KEY + ".pub", "utf8");
    });
  });

  describe("testProfile", () => {
    it("detects GitHub's success greeting despite a non-zero exit code", () => {
      vi.mocked(spawnSync).mockReturnValue({
        status: 1,
        stdout: "",
        stderr:
          "Hi octocat! You've successfully authenticated, but GitHub does not provide shell access.",
      } as never);

      const result = testProfile({ keyPath: KEY });
      expect(result.ok).toBe(true);
      expect(result.username).toBe("octocat");
    });

    it("reports failure on permission denied", () => {
      vi.mocked(spawnSync).mockReturnValue({
        status: 255,
        stdout: "",
        stderr: "git@github.com: Permission denied (publickey).",
      } as never);

      const result = testProfile({ keyPath: KEY });
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/Permission denied/);
    });

    it("gracefully reports a missing ssh binary", () => {
      vi.mocked(spawnSync).mockReturnValue({ error: enoent() } as never);

      const result = testProfile({ keyPath: KEY });
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/not found/i);
    });

    it("passes IdentitiesOnly + BatchMode so it can never hang on a prompt", () => {
      vi.mocked(spawnSync).mockReturnValue({ status: 1, stderr: "" } as never);

      testProfile({ keyPath: KEY });

      const args = vi.mocked(spawnSync).mock.calls[0][1] as string[];
      expect(args).toContain("IdentitiesOnly=yes");
      expect(args).toContain("BatchMode=yes");
      expect(args).toContain(KEY);
    });
  });
});
