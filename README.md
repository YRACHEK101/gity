<div align="center">

# gity

**Run multiple GitHub accounts on one machine — with zero identity leakage and no SSH key conflicts.**

`gity` uses [Git's native conditional includes](https://git-scm.com/docs/git-config#_conditional_includes) so the correct **name, email, and SSH key are chosen automatically based on which folder a repository lives in.** No manual switching. Ever.

```
~/Development/work/*      →  you@company.com    +  id_ed25519_work
~/Development/personal/*  →  you@gmail.com      +  id_ed25519_personal
~/Development/freelance/* →  you@freelance.dev  +  id_ed25519_freelance
```

</div>

---

## Table of contents

- [The problem it solves](#the-problem-it-solves)
- [Requirements (per OS)](#requirements-per-os)
- [Install (per OS)](#install-per-os)
- [Quick start](#quick-start-60-seconds)
- [Commands](#commands)
- [Use-case walkthroughs](#use-case-walkthroughs)
- [How it works](#how-it-works)
- [Troubleshooting (per OS)](#troubleshooting-per-os)
- [Undo / uninstall](#undo--uninstall)
- [Development](#development)
- [Publishing](#publishing-maintainers)

---

## The problem it solves

If you commit to a work repo with your personal email — or push with the wrong SSH key — you leak identities and get *"Permission denied (publickey)"* or commits attributed to the wrong account. The usual workarounds (manually running `git config user.email …` per repo, juggling `~/.ssh/config` host aliases like `git@github-work`) are fragile and easy to forget.

`gity` makes it automatic and **folder-based**: decide once that *"everything under `~/Development/work` is my work account"*, and Git handles the rest. You keep using normal `git@github.com:owner/repo.git` URLs — no special host aliases needed.

---

## Requirements (per OS)

| OS | Node.js ≥ 18 | OpenSSH client (`ssh`, `ssh-keygen`) |
|----|--------------|--------------------------------------|
| **macOS** | `brew install node` | ✅ Pre-installed |
| **Linux** (Ubuntu/Debian) | `sudo apt install nodejs npm` | `sudo apt install openssh-client` (usually present) |
| **Linux** (Fedora) | `sudo dnf install nodejs` | `sudo dnf install openssh-clients` |
| **Windows** | [nodejs.org installer](https://nodejs.org) | *Settings → Apps → Optional Features → **OpenSSH Client*** (or use Git Bash) |

> If OpenSSH is missing, `gity` tells you exactly what to enable instead of crashing.

---

## Install (per OS)

`gity` is a standard global npm package — the command is identical everywhere:

```bash
npm install -g gity-tool
```

> 📦 The npm package is **`gity-tool`**; the command it installs is **`gity`** (with `gity-tool` as an alias). Install once, type `gity`.

**macOS / Linux** — if you get an `EACCES` permission error, either use a Node version manager (`nvm`) or:
```bash
sudo npm install -g gity-tool
```

**Windows** — run in **PowerShell** or **Command Prompt**:
```powershell
npm install -g gity-tool
```

**Verify the install** (any OS):
```bash
gity --version
```

---

## Quick start (60 seconds)

```bash
gity add        # answer a few questions → profile wired up + SSH key generated
                # paste the printed public key into GitHub → Settings → SSH keys
gity test       # confirm GitHub authentication works
```

That's it. Clone or move repos into the folder you chose and the right identity is used automatically.

---

## Commands

| Command | Alias | What it does |
|---------|-------|--------------|
| `gity add` | | Interactive wizard: create a profile (name, email, folder, SSH key). |
| `gity list` | `gity ls` | Show all profiles, their folders, emails, and key status as a table. |
| `gity test [profile]` | `gity t` | Verify each profile authenticates with GitHub (or just one). |
| `gity --help` | `-h` | Help for any command, e.g. `gity add --help`. |
| `gity --version` | `-v` | Print the version. |

### `gity add`
```
$ gity add
┌  gity — add a profile
│
◇  Unique name for this profile (e.g. personal, work, company):  work
◇  Full name for Git commits:                                    Jane Doe
◇  Email address for this GitHub profile:                        jane@company.com
◇  Absolute path to this profile's projects directory:           ~/Development/work
◇  Generate a new SSH key for this profile?                      Yes
│
◇  SSH key created at ~/.ssh/id_ed25519_work
●  Public key  ssh-ed25519 AAAAC3Nza... jane@company.com
│
└  Done! Repos under ~/Development/work/ now use jane@company.com automatically.
```

### `gity list`
```
$ gity list
+----------+-------------------------+------------------+----------------------------+
| Profile  | Directory               | Email            | SSH Key                    |
+----------+-------------------------+------------------+----------------------------+
| personal | ~/Development/personal/ | jane@gmail.com   | ~/.ssh/id_ed25519_personal |
| work     | ~/Development/work/     | jane@company.com | ~/.ssh/id_ed25519_work     |
+----------+-------------------------+------------------+----------------------------+
```

### `gity test`
```
$ gity test
✓ work     — authenticated as jane-at-work
✓ personal — authenticated as jane-personal
```

---

## Use-case walkthroughs

### 1. Work + personal on the same laptop
The classic split. Run `gity add` twice:

```bash
gity add        # name: work,     email: jane@company.com, dir: ~/Development/work
gity add        # name: personal, email: jane@gmail.com,   dir: ~/Development/personal
```
Add each printed public key to the **matching** GitHub account (Settings → SSH and GPG keys). Now:
```bash
cd ~/Development/work
git clone git@github.com:company/api.git     # uses work identity + work key
cd ~/Development/personal
git clone git@github.com:jane/blog.git       # uses personal identity + personal key
```
Same `git@github.com` URLs — `gity` selects the right key per folder.

### 2. Add a freelance / client identity later
Just add another profile anytime — existing ones are untouched:
```bash
gity add        # name: acme, email: jane@acme-client.com, dir: ~/Development/clients/acme
```

### 3. Move an existing repo onto the right identity
The identity is decided by **location**, so simply move the repo into the profile's folder:
```bash
mv ~/code/old-work-repo ~/Development/work/
cd ~/Development/work/old-work-repo
git config user.email        # → jane@company.com  ✅ now correct
```
No re-clone needed. (Already-made commits keep their old author; new commits use the new identity.)

### 4. Verify before you push
```bash
gity test work               # checks just the work profile
gity test                    # checks all of them
```
A `✓` with your GitHub username means pushes will work. A `✗ Permission denied (publickey)` means the public key isn't on that GitHub account yet.

### 5. Fix "wrong account / commits show the wrong email"
```bash
gity list                    # confirm the folder → email mapping
cd <your-repo>
git config user.email        # what Git will actually use here
```
If a repo shows the wrong email, it's outside the mapped folder — move it in (use case 3) or run `gity add` for that location.

### 6. Reuse an existing SSH key (don't generate a new one)
At the *"Generate a new SSH key?"* step, answer **No** and provide the path to a key you already have. `gity` wires that key into the profile instead.

---

## How it works

For a profile named `work`, `gity` makes two **append-only** changes (your existing config is never rewritten):

**1. `~/.gitconfig`** gains a conditional include:
```ini
[includeIf "gitdir:~/Development/work/"]
    path = ~/.gitconfig-work
```

**2. `~/.gitconfig-work`** (a new, dedicated file) pins the identity + key:
```ini
[user]
    name = Jane Doe
    email = jane@company.com
[core]
    sshCommand = "ssh -i ~/.ssh/id_ed25519_work -o IdentitiesOnly=yes"
```

`IdentitiesOnly=yes` forces SSH to use **only** that key — eliminating the "wrong key offered first" failure that plagues multi-account setups, and removing any need for `~/.ssh/config` host aliases.

---

## Troubleshooting (per OS)

**`gity: command not found` (all OS)** — npm's global bin isn't on your `PATH`. Run `npm bin -g` and add that folder to your `PATH`, or reinstall Node via `nvm`.

**`ssh-keygen` not found**
- **Windows** — enable *Settings → Apps → Optional Features → OpenSSH Client*, or run `gity` inside **Git Bash**.
- **Linux** — `sudo apt install openssh-client` (Debian/Ubuntu) or `sudo dnf install openssh-clients` (Fedora).

**`Permission denied (publickey)` from `gity test`** — the profile's **public** key isn't on the matching GitHub account. Copy it from `~/.ssh/id_ed25519_<profile>.pub` into GitHub → Settings → SSH and GPG keys.

**Identity didn't switch** — Git matches the folder **path** literally. Confirm the repo is *inside* the mapped directory (`gity list` shows it), and that the directory in your config ends with `/`. `gity` always adds the trailing slash for you.

**Windows path note** — Git stores paths with forward slashes even on Windows (e.g. `~/Development/work/`); `gity` handles this conversion automatically, so don't hand-edit them to backslashes.

---

## Undo / uninstall

`gity` only writes plain text files, so removing a profile is manual and transparent:
```bash
# 1. delete the profile's sub-config
rm ~/.gitconfig-work
# 2. remove its [includeIf ...] block from ~/.gitconfig (edit by hand)
# 3. (optional) delete the key pair
rm ~/.ssh/id_ed25519_work ~/.ssh/id_ed25519_work.pub
```
Uninstall the tool itself with `npm uninstall -g gity-tool`.

---

## Development

```bash
git clone git@github.com:YRACHEK101/gity-tool.git
cd gity-tool
npm install
npm run build      # compile TypeScript → dist/
npm test           # 30 unit tests (Vitest)
npm run typecheck  # type-check only
```

### Project layout
```
src/
├── index.ts            # entry point (#!/usr/bin/env node)
├── cli.ts              # commander command surface
├── config-manager.ts   # gitconfig parse + non-destructive append + discovery
├── ssh-manager.ts      # safe ssh-keygen / ssh wrappers
├── commands/           # add · list · test
└── utils/              # path normalization + ascii table
tests/                  # paths · config · ssh specs
```

### Design principles
- **KISS** — 3 runtime dependencies (`commander`, `@clack/prompts`, `picocolors`), no database, no daemon. State is plain Git config you can read and edit.
- **Non-destructive** — the global config is only ever *appended to*, idempotently. Existing keys/profiles are never clobbered without confirmation.
- **Cross-platform** — `~`, `\` and `/` are normalized through Node's `os`/`path` to the form Git stores on every OS.
- **Safe shell-outs** — `ssh`/`ssh-keygen` run with explicit argument arrays (never a shell string); a missing binary becomes a friendly message, not a crash.

---

## Publishing (maintainers)

```bash
npm login                     # or a token in ~/.npmrc — never commit it
npm publish --access public   # prepublishOnly auto-runs build + tests
```
> 🔐 **Never paste an npm token into a chat, commit, or share it.** If one is exposed, revoke it immediately at npmjs.com → *Access Tokens*.

---

## License

[MIT](./LICENSE) © Yahia Rachek
