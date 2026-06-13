#!/usr/bin/env node
// Claude Code custom status line — Windows-native, Node.js

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const R = '\x1b[0m';
const green  = s => `\x1b[32m${s}${R}`;
const yellow = s => `\x1b[33m${s}${R}`;
const red    = s => `\x1b[31m${s}${R}`;
const bold   = s => `\x1b[1m${s}${R}`;
const cyan   = s => `\x1b[36m${s}${R}`;

// ── Read settings.json for fallback effortLevel ───────────────────────────────
function readSettings() {
  try {
    const p = path.join(process.env.USERPROFILE || process.env.HOME || '', '.claude', 'settings.json');
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

// ── Model name: "claude-sonnet-4-6" → "Sonnet 4.6" ───────────────────────────
function formatModelName(raw) {
  if (!raw) return 'n/a';
  // Strip "claude-" prefix and trailing date stamps like "-20251001"
  const cleaned = raw.replace(/^claude-/i, '').replace(/-\d{8}$/, '');
  const parts = cleaned.split('-');
  const family = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  const version = parts.slice(1).join('.');
  return version ? `${family} ${version}` : family;
}

// ── Context size: 200000 → "200k", 1000000 → "1M" ────────────────────────────
function formatCtxSize(size) {
  if (!size) return null;
  if (size >= 1000000) return `${Math.round(size / 1000000)}M`;
  return `${Math.round(size / 1000)}k`;
}

// ── Directory: replace home prefix with "~", use forward slashes ──────────────
function tildeify(fullPath) {
  if (!fullPath) return '~';
  const home = (process.env.USERPROFILE || process.env.HOME || '').replace(/\\/g, '/');
  const norm = fullPath.replace(/\\/g, '/');
  if (home && norm.toLowerCase().startsWith(home.toLowerCase())) {
    const rest = norm.slice(home.length);
    return rest ? `~${rest}` : '~';
  }
  return norm;
}

// ── Git: branch + diff stats + sync status in one pass ───────────────────────
function gitInfo(cwd) {
  const result = { branch: 'n/a', insertions: null, deletions: null, sync: null };

  try {
    result.branch = execSync('git rev-parse --abbrev-ref HEAD',
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return result; // not a git repo
  }

  // Staged + unstaged diff stats
  try {
    const staged   = execSync('git diff --numstat --cached', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const unstaged = execSync('git diff --numstat',          { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    let ins = 0, del = 0;
    for (const line of (staged + unstaged).split('\n')) {
      const [a, d] = line.trim().split('\t');
      if (a && d && a !== '-' && d !== '-') { ins += parseInt(a) || 0; del += parseInt(d) || 0; }
    }
    result.insertions = ins;
    result.deletions  = del;
  } catch {}

  // Sync status: dirty → ✗, unpushed → ✗, synced → ✓, no remote → ?
  try {
    const porcelain = execSync('git status --porcelain',
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (porcelain) {
      result.sync = 'dirty';
    } else {
      try {
        const ahead  = parseInt(execSync('git rev-list @{upstream}..HEAD --count',
          { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(), 10);
        const behind = parseInt(execSync('git rev-list HEAD..@{upstream} --count',
          { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(), 10);
        result.sync = (ahead === 0 && behind === 0) ? 'synced' : (ahead > 0 ? 'ahead' : 'behind');
      } catch {
        result.sync = 'no-remote'; // branch has no upstream set
      }
    }
  } catch {}

  return result;
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function progressBar(pct, width = 10) {
  const filled = Math.round((pct / 100) * width);
  const bar = '▓'.repeat(filled) + '░'.repeat(width - filled);
  if (pct < 50)  return green(bar);
  if (pct <= 80) return yellow(bar);
  return red(bar);
}

// ── Time helpers ──────────────────────────────────────────────────────────────
// Handles ISO strings AND Unix timestamps in seconds or milliseconds.
function parseTimestamp(val) {
  if (!val) return null;
  const n = Number(val);
  if (!isNaN(n)) return new Date(n < 1e10 ? n * 1000 : n);
  return new Date(val);
}

function formatResetCountdown(timestamp) {
  if (!timestamp) return 'n/a';
  try {
    const ms = parseTimestamp(timestamp) - Date.now();
    if (ms <= 0) return 'now';
    const totalMin = Math.floor(ms / 60000);
    const hr  = Math.floor(totalMin / 60);
    const min = totalMin % 60;
    return hr > 0 ? `${hr}hr ${min}m` : `${min}m`;
  } catch {
    return 'n/a';
  }
}

// Tracks session start via a stamp file; resets each time the stamp is missing.
function sessionElapsed() {
  const stampFile = path.join(process.env.USERPROFILE || process.env.HOME || '', '.claude', '.session_start');
  try {
    const ts = parseInt(fs.readFileSync(stampFile, 'utf8').trim(), 10);
    if (isNaN(ts)) throw new Error();
    const ms = Date.now() - ts;
    const totalMin = Math.floor(ms / 60000);
    const hr  = Math.floor(totalMin / 60);
    const min = totalMin % 60;
    return hr > 0 ? `${hr}hr ${min}m` : `${min}m`;
  } catch {
    try { fs.writeFileSync(stampFile, String(Date.now()), 'utf8'); } catch {}
    return '0m';
  }
}

// ── Safe nested key accessor ──────────────────────────────────────────────────
function get(obj, ...keys) {
  let cur = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[k];
  }
  return cur;
}

function pct(val) {
  const n = parseFloat(val);
  return isNaN(n) ? null : Math.round(n);
}

// ── Main ──────────────────────────────────────────────────────────────────────
let _raw = '';
process.stdin.on('data', chunk => _raw += chunk);
process.stdin.on('end', () => {
  const data     = _raw ? (() => { try { return JSON.parse(_raw); } catch { return {}; } })() : {};
  const settings = readSettings();

  // Write raw payload for inspection — remove once everything looks right.
  try {
    const dbg = path.join(process.env.USERPROFILE || process.env.HOME || '', '.claude', '.statusline_last.json');
    fs.writeFileSync(dbg, JSON.stringify(data, null, 2), 'utf8');
  } catch {}

  // ── Line 1: header ────────────────────────────────────────────────────────
  const header = bold('┋ ◢◤ claude_code ◥◣ ┋');

  // ── Model + context size ──────────────────────────────────────────────────
  const rawModel  = get(data, 'model', 'display_name') || '';
  const modelName = rawModel ? formatModelName(rawModel) : 'n/a';
  const ctxSize   = get(data, 'context_window', 'context_window_size');
  const ctxSzLabel = formatCtxSize(ctxSize);
  const modelLabel = ctxSzLabel ? `${modelName} (${ctxSzLabel} Context)` : modelName;

  // ── Effort ────────────────────────────────────────────────────────────────
  const effort = get(data, 'effort', 'level') || 'n/a';

  // ── Context window bar (percentage only, size moved to model line) ────────
  const ctxPct = pct(get(data, 'context_window', 'used_percentage'));
  const ctxBar = ctxPct != null ? progressBar(ctxPct) : green('░'.repeat(10));
  const ctxLabel = ctxPct != null ? `${ctxBar} ${ctxPct}%` : 'n/a';

  // Line 2
  const line2 = `m: ${cyan(modelLabel)} | e: ${cyan(effort)} | c: ${ctxLabel}`;

  // ── Rate limits ───────────────────────────────────────────────────────────
  const sessUsedPct = pct(get(data, 'rate_limits', 'five_hour', 'used_percentage'));
  const sessReset   = get(data, 'rate_limits', 'five_hour', 'resets_at');
  const weekUsedPct = pct(get(data, 'rate_limits', 'seven_day', 'used_percentage'));

  const sessLabel = sessUsedPct != null ? `${sessUsedPct}%` : 'n/a';
  const weekLabel = weekUsedPct != null ? `${weekUsedPct}%` : 'n/a';
  const countdown = formatResetCountdown(sessReset);
  const elapsed   = sessionElapsed();

  // Line 3
  const line3 = `cs: ${elapsed} | s: ${sessLabel} | w: ${weekLabel} | r: ${countdown}`;

  // ── Directory + git ───────────────────────────────────────────────────────
  const rawDir = get(data, 'workspace', 'current_dir') || process.cwd();
  const dir    = tildeify(rawDir);
  const git    = gitInfo(rawDir);

  const syncIcon = git.sync === 'synced'                     ? green('✓')
                 : (git.sync === 'dirty' || git.sync === 'ahead') ? red('✗')
                 : git.sync === 'behind'                     ? yellow('✗')
                 : git.sync === 'no-remote'                  ? yellow('?')
                 : '';

  const branchLabel = git.branch !== 'n/a'
    ? `${git.branch} ${syncIcon}`.trim()
    : 'n/a';

  const insLabel = git.insertions != null ? green(`+${git.insertions}`) : green('+n/a');
  const delLabel = git.deletions  != null ? red(`-${git.deletions}`)    : red('-n/a');

  // Line 4
  const line4 = `d: ${dir} | b: ${branchLabel} | ${insLabel} | ${delLabel}`;

  // ── Output ────────────────────────────────────────────────────────────────
  console.log([header, line2, line3, line4].join('\n'));
});
