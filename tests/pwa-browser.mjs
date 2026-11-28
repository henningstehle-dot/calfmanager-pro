import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.CALFMANAGER_PLAYWRIGHT || 'playwright-core');
const repo = fileURLToPath(new URL('..', import.meta.url));
const workspace = await mkdtemp(join(tmpdir(), 'calfmanager-pwa-'));
const previousSource = join(workspace, 'previous');
const previousOutput = join(workspace, '3.2.4');
const output = join(workspace, '3.4.0');
const base = '/calfmanager-pro/';
const oldCache = 'calfmanager-shell-v3-2-4';
const currentCache = 'calfmanager-shell-v3-4-0';
const mobile = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const contentTypes = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json',
};
let oldRelease = true;
let networkAvailable = true;
let browser;

const server = createServer((request, response) => {
  if (!networkAvailable) {
    request.socket.destroy();
    return;
  }
  const path = new URL(request.url, 'http://localhost').pathname;
  response.setHeader('Cache-Control', 'no-store');
  if (path === '/observer') {
    response.writeHead(200, { 'Content-Type': 'text/html' }).end('<p>Service-Worker-Prüfung</p>');
    return;
  }
  if (!path.startsWith(base)) {
    response.writeHead(404).end();
    return;
  }
  const file = path.slice(base.length) || 'index.html';
  void readFile(join(oldRelease ? previousOutput : output, file)).then(content => {
    response.writeHead(200, { 'Content-Type': contentTypes[extname(file)] }).end(content);
  }, () => response.writeHead(404).end());
});

// Playwright's waitForFunction polls for a truthy return value. A Promise is
// already truthy, so poll the resolved value from page.evaluate for async checks.
async function waitForBrowserState(read, ready, message) {
  const deadline = performance.now() + 15_000;
  let state;
  do {
    state = await read();
    if (ready(state)) return state;
    await delay(50);
  } while (performance.now() < deadline);
  assert.fail(`${message} Letzter Stand: ${JSON.stringify(state)}`);
}

try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const app = `${origin}${base}`;
  // Serve both real builds with the same GitHub Pages base and local API URL.
  const archive = process.env.CALFMANAGER_PREVIOUS_ZIP;
  if (!archive) throw new Error('CALFMANAGER_PREVIOUS_ZIP muss auf das Originalarchiv 3.2.4 zeigen.');
  await mkdir(previousSource);
  execFileSync('unzip', ['-q', archive, '-d', previousSource]);
  const entries = await readdir(previousSource);
  const previousRoot = entries.length === 1 ? join(previousSource, entries[0]) : previousSource;
  await symlink(join(repo, 'node_modules'), join(previousRoot, 'node_modules'));
  const buildEnvironment = { ...process.env, GITHUB_REPOSITORY: 'fixture/calfmanager-pro',
    VITE_SUPABASE_URL: origin, VITE_SUPABASE_ANON_KEY: 'local-fixture-only' };
  for (const [source, destination] of [[previousRoot, previousOutput], [repo, output]]) {
    execFileSync(process.execPath, [join(repo, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', destination, '--emptyOutDir'], {
      cwd: source, stdio: 'inherit', env: buildEnvironment,
    });
  }
  assert.match(await readFile(join(previousOutput, 'sw.js'), 'utf8'), new RegExp(oldCache));
  const assets = await readdir(join(output, 'assets'));
  assert.ok(assets.some(file => file.endsWith('.js')) && assets.some(file => file.endsWith('.css')));
  browser = await chromium.launch({ executablePath: process.env.CALFMANAGER_CHROMIUM || '/usr/bin/chromium' });

  const upgrading = await browser.newContext(mobile);
  const current = await upgrading.newPage();
  await current.goto(app);
  await current.getByRole('heading', { name: 'Anmelden', exact: true }).waitFor();
  await current.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  assert.deepEqual(await current.evaluate(() => caches.keys()), [oldCache]);
  const previousScript = await current.locator('script[type="module"][src]').getAttribute('src');
  assert.ok(previousScript);
  oldRelease = false;
  await current.reload();
  await current.getByRole('heading', { name: 'Anmelden', exact: true }).waitFor();
  const currentScript = await current.locator('script[type="module"][src]').getAttribute('src');
  assert.ok(currentScript && currentScript !== previousScript);
  await current.evaluate(async () => (await navigator.serviceWorker.ready).update());
  const waiting = await waitForBrowserState(
    () => current.evaluate(async ({ currentCache, base }) => {
      const registration = await navigator.serviceWorker.getRegistration();
      const names = await caches.keys();
      const requests = names.includes(currentCache) ? await (await caches.open(currentCache)).keys() : [];
      const assets = requests.map(request => new URL(request.url).pathname)
        .filter(path => path.startsWith(`${base}assets/`)).map(path => path.split('/').pop()).sort();
      return { waiting: registration?.waiting?.state, names, assets };
    }, { currentCache, base }),
    state => state.waiting === 'installed' && state.assets.length === assets.length,
    'Der neue Service Worker wartet nicht mit vollständig gespeichertem App-Cache.',
  );
  assert.ok(waiting.names.includes(oldCache));
  assert.deepEqual(waiting.assets, [...assets].sort());

  const observer = await upgrading.newPage();
  await observer.goto(`${origin}/observer`);
  await current.close();
  await waitForBrowserState(
    () => observer.evaluate(async app => {
      const registration = await navigator.serviceWorker.getRegistration(app);
      return { active: registration?.active?.state, names: await caches.keys() };
    }, app),
    state => state.active === 'activated' && state.names.includes(currentCache) && !state.names.includes(oldCache),
    'Der neue Service Worker wurde nicht aktiviert oder der bisherige App-Cache blieb bestehen.',
  );
  networkAvailable = false;
  await upgrading.setOffline(true);
  const afterUpgrade = await upgrading.newPage();
  await afterUpgrade.goto(app);
  await afterUpgrade.getByRole('heading', { name: 'Anmelden', exact: true }).waitFor();
  assert.equal(await afterUpgrade.locator('script[type="module"][src]').getAttribute('src'), currentScript);
  await upgrading.close();
  console.log('Chromium 390 × 844: 3.2.4 → 3.4.0, Wartephase, Cache-Wechsel und erster Offline-Start geprüft.');

  networkAvailable = true;
  const fresh = await browser.newContext(mobile);
  const installed = await fresh.newPage();
  await installed.goto(app);
  await installed.getByRole('heading', { name: 'Anmelden', exact: true }).waitFor();
  await installed.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  networkAvailable = false;
  await fresh.setOffline(true);
  await installed.reload();
  await installed.getByRole('heading', { name: 'Anmelden', exact: true }).waitFor();
  console.log('Chromium 390 × 844: erster Offline-Start nach frischer Service-Worker-Installation geprüft.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  await rm(workspace, { recursive: true, force: true });
}
