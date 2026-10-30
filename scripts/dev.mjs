#!/usr/bin/env node
/**
 * SpaceShooter Dev Supervisor (TUI)
 *
 * Usage: node scripts/dev.mjs
 *
 * Keys:
 *   ↑/↓     Navigate
 *   SPACE   Toggle on/off
 *   ENTER   Show logs (tail)
 *   q       Quit
 */

import { spawn } from 'node:child_process';

const COMPOSE_FILE = process.env.COMPOSE_FILE || 'docker-compose.dev.yml';
const DEV_NETWORK = process.env.DEV_NETWORK || 'space-shooter-dev';

const CONTAINERS = {
  postgres: process.env.POSTGRES_CONTAINER || 'space-shooter-postgres',
  be: process.env.BE_CONTAINER || 'space-shooter-be',
  fe: process.env.FE_CONTAINER || 'space-shooter-fe',
};

const VOLUMES = {
  postgres: process.env.POSTGRES_VOLUME || 'space-shooter-postgres-data',
  beNodeModules: process.env.BE_NODE_MODULES_VOLUME || 'space-shooter-be-node-modules',
  feNodeModules: process.env.FE_NODE_MODULES_VOLUME || 'space-shooter-fe-node-modules',
};

const PORTS = {
  postgres: process.env.POSTGRES_PORT || '54320',
  be: process.env.BE_PORT || '4000',
  fe: process.env.FE_PORT || '5173',
};

const SERVICES = [
  { name: 'colima', label: 'colima', kind: 'colima' },
  { name: 'postgres', label: 'postgres', kind: 'compose' },
  { name: 'be', label: 'be', kind: 'compose' },
  { name: 'fe', label: 'fe', kind: 'compose' },
];

// ── ANSI ────────────────────────────────────────────
const RST = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[90m';
const INV = '\x1b[7m';

function statusColor(status) {
  switch (status) {
    case 'active': return '\x1b[32m';
    case 'starting': return '\x1b[33m';
    case 'error': return '\x1b[31m';
    case 'inactive': return '\x1b[90m';
    case 'missing': return '\x1b[90m';
    default: return '\x1b[0m';
  }
}

// ── State ───────────────────────────────────────────
let cursor = 0;
let shuttingDown = false;
let renderTimer = null;
let pollTimer = null;
/** @type {{cmd:string,argsPrefix:string[]}|null} */
let composeBin = null;
/** @type {'compose'|'docker'} */
let engine = 'compose';

/** @type {Map<string, {status:string, detail:string, lastErr:string, logs:Array<{ts:number,line:string,isError:boolean}>}>} */
const state = new Map();
for (const svc of SERVICES) {
  state.set(svc.name, { status: 'inactive', detail: '', lastErr: '', logs: [] });
}

function pushLog(name, line, isError = false) {
  const s = state.get(name);
  if (!s) return;
  s.logs.push({ ts: Date.now(), line, isError });
  if (s.logs.length > 200) s.logs.splice(0, s.logs.length - 200);
}

function pushMultiline(name, text, isError = false) {
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line) continue;
    pushLog(name, line, isError);
  }
}

function scheduleRender() {
  if (renderTimer) return;
  renderTimer = setTimeout(() => {
    renderTimer = null;
    render();
  }, 33);
}

function render() {
  if (!process.stdout.isTTY) return;

  const lines = [];
  lines.push(`${BOLD}SpaceShooter Dev${RST}  ${DIM}compose: ${COMPOSE_FILE}${RST}`);
  lines.push(`${DIM}space=toggle  enter=logs  q=quit${RST}`);
  lines.push('');

  for (let i = 0; i < SERVICES.length; i++) {
    const svc = SERVICES[i];
    const s = state.get(svc.name);
    const sel = i === cursor;
    const pre = sel ? INV : '';
    const suf = sel ? RST : '';

    const badgeText = s.status.toUpperCase().padEnd(8);
    const badge = `${statusColor(s.status)}${badgeText}${RST}`;
    const err = s.lastErr ? ` ${DIM}${s.lastErr}${RST}` : '';
    const detail = s.detail ? ` ${DIM}${s.detail}${RST}` : '';
    lines.push(`${pre} ${badge} ${svc.label.padEnd(10)}${detail}${err} ${suf}`.trimEnd());
  }

  lines.push('');
  lines.push(`${DIM}Recent:${RST}`);
  const all = [];
  for (const [name, s] of state) {
    for (const entry of s.logs.slice(-3)) all.push({ name, ...entry });
  }
  all.sort((a, b) => a.ts - b.ts);
  for (const entry of all.slice(-10)) {
    const ts = new Date(entry.ts).toTimeString().slice(0, 8);
    const c = entry.isError ? '\x1b[31m' : DIM;
    lines.push(`${c}${ts} [${entry.name}] ${entry.line.slice(0, 140)}${RST}`);
  }

  process.stdout.write('\x1b[2J\x1b[H');
  process.stdout.write(lines.join('\n') + '\n');
}

// ── Process helpers ─────────────────────────────────
function hasCmd(cmd) {
  return new Promise((resolve) => {
    const p = spawn('sh', ['-lc', `command -v ${cmd} >/dev/null 2>&1`], { stdio: 'ignore' });
    p.on('exit', (code) => resolve(code === 0));
    p.on('error', () => resolve(false));
  });
}

function run(cmd, args, { nameForLogs } = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (b) => {
      const s = b.toString('utf8');
      out += s;
      if (nameForLogs) for (const line of s.split(/\r?\n/)) if (line) pushLog(nameForLogs, line, false);
    });
    p.stderr.on('data', (b) => {
      const s = b.toString('utf8');
      err += s;
      if (nameForLogs) for (const line of s.split(/\r?\n/)) if (line) pushLog(nameForLogs, line, true);
    });
    p.on('close', (code) => resolve({ code: code ?? 1, stdout: out, stderr: err }));
    p.on('error', (e) => resolve({ code: 1, stdout: '', stderr: String(e?.message || e) }));
  });
}

async function resolveComposeBin() {
  // Prefer modern docker compose subcommand, fallback to legacy docker-compose.
  const dockerCompose = await run('docker', ['compose', 'version']);
  if (dockerCompose.code === 0) return { cmd: 'docker', argsPrefix: ['compose'] };

  const legacy = await hasCmd('docker-compose');
  if (legacy) return { cmd: 'docker-compose', argsPrefix: [] };

  return null;
}

function composeArgs(args) {
  if (!composeBin) throw new Error('composeBin not initialized');
  return [composeBin.cmd, [...composeBin.argsPrefix, '-f', COMPOSE_FILE, ...args]];
}

async function ensureDockerNetwork(nameForLogs) {
  const res = await run('docker', ['network', 'inspect', DEV_NETWORK]);
  if (res.code === 0) return;
  const created = await run('docker', ['network', 'create', DEV_NETWORK], { nameForLogs });
  if (created.code !== 0) throw new Error(`failed to create network ${DEV_NETWORK}`);
}

async function dockerContainerState(containerName) {
  const res = await run('docker', ['inspect', '-f', '{{.State.Status}}', containerName]);
  if (res.code !== 0) return { status: 'inactive', detail: '' };
  const st = (res.stdout || '').trim();
  if (st === 'running') return { status: 'active', detail: '' };
  if (st === 'exited' || st === 'dead') return { status: 'error', detail: st };
  return { status: st || 'inactive', detail: '' };
}

async function dockerContainerExists(containerName) {
  const res = await run('docker', ['inspect', containerName]);
  return res.code === 0;
}

async function dockerStopRm(containerName, nameForLogs) {
  await run('docker', ['stop', containerName], { nameForLogs });
  await run('docker', ['rm', containerName], { nameForLogs });
}

async function dockerEnsureImage(image, nameForLogs) {
  const inspect = await run('docker', ['image', 'inspect', image]);
  if (inspect.code === 0) return true;
  pushLog(nameForLogs, `pulling image: ${image}`, false);
  const pulled = await run('docker', ['pull', image], { nameForLogs });
  return pulled.code === 0;
}

// ── Service ops ─────────────────────────────────────
async function getComposeState(serviceName) {
  const [cmd, args] = composeArgs(['ps', '--format', 'json', serviceName]);
  const res = await run(cmd, args);
  if (res.code !== 0) return { status: 'error', detail: 'compose ps failed', raw: res.stderr || res.stdout };
  const line = (res.stdout || '').trim().split(/\r?\n/).filter(Boolean)[0];
  if (!line) return { status: 'inactive', detail: '' };
  try {
    const obj = JSON.parse(line);
    const st = String(obj?.State || '').toLowerCase();
    if (st === 'running') return { status: 'active', detail: '' };
    if (st === 'exited' || st === 'dead') return { status: 'error', detail: st };
    return { status: st || 'inactive', detail: '' };
  } catch {
    return { status: 'error', detail: 'bad ps json', raw: line };
  }
}

async function getColimaState() {
  const ok = await hasCmd('colima');
  if (!ok) return { status: 'missing', detail: '' };
  const res = await run('colima', ['status']);
  if (res.code === 0) return { status: 'active', detail: '' };
  return { status: 'inactive', detail: '' };
}

async function refreshOne(serviceName) {
  const svc = SERVICES.find((s) => s.name === serviceName);
  if (!svc) return;
  const s = state.get(serviceName);
  if (!s) return;

  let r;
  if (svc.kind === 'colima') r = await getColimaState();
  else r = engine === 'compose'
    ? await getComposeState(serviceName)
    : await dockerContainerState(CONTAINERS[serviceName]);

  const nextStatus = r.status || 'inactive';
  const nextDetail = r.detail || '';

  if (s.status !== nextStatus || s.detail !== nextDetail) {
    s.status = nextStatus;
    s.detail = nextDetail;
    scheduleRender();
  }
}

async function refreshAll() {
  for (const svc of SERVICES) await refreshOne(svc.name);
}

async function toggle(serviceName) {
  const svc = SERVICES.find((s) => s.name === serviceName);
  const s = state.get(serviceName);
  if (!svc || !s) return;

  s.lastErr = '';
  scheduleRender();

  if (svc.kind === 'colima') {
    if (s.status === 'missing') {
      s.lastErr = 'colima not installed';
      scheduleRender();
      return;
    }
    const actual = await getColimaState();
    const op = actual.status === 'active' ? 'stop' : 'start';
    s.status = 'starting';
    s.detail = op;
    scheduleRender();
    const res = await run('colima', [op], { nameForLogs: 'colima' });
    if (res.code !== 0) s.lastErr = `${op} failed`;
    await refreshOne('colima');
    scheduleRender();
    return;
  }

  if (engine === 'compose') {
    const current = await getComposeState(serviceName);
    if (current.status === 'active') {
      const [cmd, args] = composeArgs(['stop', serviceName]);
      const res = await run(cmd, args, { nameForLogs: serviceName });
      if (res.code !== 0) s.lastErr = 'stop failed';
    } else {
      s.status = 'starting';
      scheduleRender();
      const [cmd, args] = composeArgs(['up', '-d', serviceName]);
      const res = await run(cmd, args, { nameForLogs: serviceName });
      if (res.code !== 0) s.lastErr = 'start failed';
    }
    await refreshOne(serviceName);
    scheduleRender();
    return;
  }

  // docker-only fallback (no compose installed)
  await ensureDockerNetwork(serviceName);
  const containerName = CONTAINERS[serviceName];
  const current = await dockerContainerState(containerName);

  if (current.status === 'active') {
    const res = await run('docker', ['stop', containerName], { nameForLogs: serviceName });
    if (res.code !== 0) s.lastErr = 'stop failed';
    await run('docker', ['rm', containerName], { nameForLogs: serviceName });
    await refreshOne(serviceName);
    scheduleRender();
    return;
  }

  // Ensure stale container removed
  await dockerStopRm(containerName, serviceName);

  s.status = 'starting';
  scheduleRender();

  if (serviceName === 'postgres') {
    await dockerEnsureImage('postgres:16-alpine', serviceName);
    const res = await run('docker', [
      'run', '-d',
      '--name', containerName,
      '--network', DEV_NETWORK,
      '--network-alias', 'postgres',
      '-e', 'POSTGRES_USER=space_shooter',
      '-e', 'POSTGRES_PASSWORD=space_shooter',
      '-e', 'POSTGRES_DB=space_shooter',
      '-p', `${PORTS.postgres}:5432`,
      '-v', `${VOLUMES.postgres}:/var/lib/postgresql/data`,
      'postgres:16-alpine',
    ], { nameForLogs: serviceName });
    if (res.code !== 0) {
      s.lastErr = 'start failed';
      pushMultiline(serviceName, res.stderr || res.stdout, true);
    } else {
      pushLog(serviceName, `started: ${(res.stdout || '').trim()}`, false);
    }
    await refreshOne(serviceName);
    scheduleRender();
    return;
  }

  if (serviceName === 'be') {
    await dockerEnsureImage('node:20-alpine', serviceName);
    const jwtSecret = process.env.JWT_SECRET || 'dev_secret_change_me';
    const databaseUrl = 'postgresql://space_shooter:space_shooter@postgres:5432/space_shooter?schema=public';
    const res = await run('docker', [
      'run', '-d',
      '--name', containerName,
      '--network', DEV_NETWORK,
      '-w', '/app',
      '-e', `BE_PORT=${PORTS.be}`,
      '-e', `JWT_SECRET=${jwtSecret}`,
      '-e', `DATABASE_URL=${databaseUrl}`,
      '-p', `${PORTS.be}:4000`,
      '-v', `${process.cwd()}/be:/app`,
      '-v', `${VOLUMES.beNodeModules}:/app/node_modules`,
      'node:20-alpine',
      'sh', '-lc', 'npm ci && npm run start:dev',
    ], { nameForLogs: serviceName });
    if (res.code !== 0) {
      s.lastErr = 'start failed';
      pushMultiline(serviceName, res.stderr || res.stdout, true);
    } else {
      pushLog(serviceName, `started: ${(res.stdout || '').trim()}`, false);
    }
    await refreshOne(serviceName);
    scheduleRender();
    return;
  }

  if (serviceName === 'fe') {
    await dockerEnsureImage('node:20-alpine', serviceName);
    const res = await run('docker', [
      'run', '-d',
      '--name', containerName,
      '--network', DEV_NETWORK,
      '-w', '/app',
      '-p', `${PORTS.fe}:5173`,
      '-v', `${process.cwd()}/fe:/app`,
      '-v', `${VOLUMES.feNodeModules}:/app/node_modules`,
      'node:20-alpine',
      'sh', '-lc', 'npm ci && npm run dev -- --host 0.0.0.0 --port 5173',
    ], { nameForLogs: serviceName });
    if (res.code !== 0) {
      s.lastErr = 'start failed';
      pushMultiline(serviceName, res.stderr || res.stdout, true);
    } else {
      pushLog(serviceName, `started: ${(res.stdout || '').trim()}`, false);
    }
    await refreshOne(serviceName);
    scheduleRender();
    return;
  }
}

async function showLogs(serviceName) {
  const svc = SERVICES.find((s) => s.name === serviceName);
  const s = state.get(serviceName);
  if (!svc || !s) return;

  pushLog(serviceName, `--- logs (${serviceName}) ---`, false);

  if (svc.kind === 'colima') {
    if (s.status === 'missing') {
      pushLog(serviceName, 'colima: not installed', true);
      scheduleRender();
      return;
    }
    const res = await run('colima', ['status'], { nameForLogs: serviceName });
    if (res.code !== 0) pushLog(serviceName, 'colima status failed', true);
    scheduleRender();
    return;
  }

  if (engine === 'compose') {
    const [cmd, args] = composeArgs(['logs', '--no-color', '--tail=80', serviceName]);
    const res = await run(cmd, args, { nameForLogs: serviceName });
    if (res.code !== 0) pushLog(serviceName, 'compose logs failed', true);
    scheduleRender();
    return;
  }

  const containerName = CONTAINERS[serviceName];
  const exists = await dockerContainerExists(containerName);
  if (!exists) {
    pushLog(serviceName, `container not found: ${containerName}`, true);
    if (s.lastErr) pushLog(serviceName, `last error: ${s.lastErr}`, true);
    scheduleRender();
    return;
  }

  const res = await run('docker', ['logs', '--tail=120', containerName], { nameForLogs: serviceName });
  if (res.code !== 0) pushLog(serviceName, 'docker logs failed', true);
  scheduleRender();
}

// ── Keyboard ────────────────────────────────────────
function setupInput() {
  if (!process.stdin.isTTY) return;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  process.stdin.on('data', async (key) => {
    if (shuttingDown) return;

    if (key === '\x03' || key === 'q') {
      await shutdown();
      return;
    }

    if (key === '\x1b[A') {
      cursor = Math.max(0, cursor - 1);
      scheduleRender();
      return;
    }
    if (key === '\x1b[B') {
      cursor = Math.min(SERVICES.length - 1, cursor + 1);
      scheduleRender();
      return;
    }

    const svcName = SERVICES[cursor]?.name;
    if (!svcName) return;

    if (key === ' ') {
      toggle(svcName);
      return;
    }

    if (key === '\r') {
      showLogs(svcName);
      return;
    }
  });
}

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  if (pollTimer) clearInterval(pollTimer);

  process.stdout.write('\x1b[2J\x1b[H');
  process.stdout.write('Bye.\n');
  process.exit(0);
}

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());

// ── Main ────────────────────────────────────────────
async function main() {
  const hasDocker = await hasCmd('docker');
  if (!hasDocker) {
    process.stderr.write('docker not found in PATH\n');
    process.exit(1);
  }

  composeBin = await resolveComposeBin();
  if (!composeBin) engine = 'docker';

  setupInput();
  await refreshAll();
  render();

  pollTimer = setInterval(() => {
    refreshAll().catch((e) => {
      pushLog('be', `poll error: ${String(e?.message || e)}`, true);
      scheduleRender();
    });
  }, 800);
}

main().catch((err) => {
  process.stderr.write(String(err?.stack || err) + '\n');
  process.exit(1);
});
