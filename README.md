# cc-statusline

A custom Claude Code status line for Windows, written in Node.js. Replaces the
default Claude Code footer with a four-line panel showing model info, rate
limits, session timing, and live git state for the current workspace.

> **Where this works:** Claude Code running in a terminal (VS Code integrated
> terminal, Windows Terminal, PowerShell, etc.). It does **not** apply to the
> Claude Code VS Code extension's chat panel — that panel has its own UI and
> does not render a terminal status line.
>
> **Git Bash requirement:** On Windows, Claude Code routes status line commands
> through Git Bash. Git Bash must be installed, and paths in `settings.json`
> must use forward slashes or `~` — backslashes are treated as escape characters
> and silently break the command.

## What it shows

```
┋ ◢◤ claude_code ◥◣ ┋
m: Sonnet 4.6 (200k Context) | e: medium | c: ▓▓▓░░░░░░░ 30%
cs: 12m | s: 5% | w: 2% | r: 4hr 48m
d: ~/projects/my-app | b: main ✓ | +12 | -3
```

| Field | Meaning |
|-------|---------|
| `m:` | Model name + context window size |
| `e:` | Effort level (`low` / `medium` / `high`) |
| `c:` | Context window usage bar + percentage (green → yellow → red) |
| `cs:` | Session elapsed time (resets when Claude Code restarts) |
| `s:` | 5-hour rate limit used % |
| `w:` | 7-day rate limit used % |
| `r:` | Time until 5-hour rate limit resets |
| `d:` | Current workspace directory (`~`-shortened) |
| `b:` | Git branch + sync icon: `✓` synced, `✗` dirty/ahead, `?` no remote |
| `+N / -N` | Staged + unstaged insertions / deletions |

## Install

### 1. Copy the script

Place `statusline.js` in your Claude config directory:

```
C:\Users\<yourname>\.claude\statusline.js
```

### 2. Add the statusLine block to settings.json

Open `C:\Users\<yourname>\.claude\settings.json` and add (or merge) this block:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/statusline.js"
  }
}
```

Save the file, then restart Claude Code — the custom status line will appear at
the bottom of every session.

> **Use `~` or forward slashes in the path.** Claude Code runs this command
> through Git Bash on Windows. Backslash paths (e.g. `C:\\Users\\...`) are
> treated as escape sequences by Git Bash and will silently fail.

### Requirements

- Node.js must be installed and on your PATH (`node --version` to check)
- Git must be on your PATH for the branch/diff fields to populate

---

## Setup on a new device

> **The path to `statusline.js` is hardcoded — you must update it for each machine.**

When cloning this repo on a new computer, two paths need to change:

1. **Script location** — copy `statusline.js` to that machine's config directory:
   ```
   C:\Users\<that-machine-username>\.claude\statusline.js
   ```
   Use the actual username on that device.

2. **settings.json command path** — use `~` so it resolves automatically
   regardless of username:
   ```json
   "command": "node ~/.claude/statusline.js"
   ```
   Claude Code runs this through Git Bash on Windows, and `~` expands correctly
   there. Avoid backslash paths — Git Bash treats them as escape characters.
