import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  archivedCalf, boxes, calf, dateOffset, employee, farm, fixturePassword, initialDate, isMockApi,
  legacyTemplate, makeFixture, mockApi, owner, recurringTemplate, secondCalf, unboxedCalf,
} from './browser-fixtures.mjs';

// Set CALFMANAGER_PLAYWRIGHT to a path such as /opt/local-tests/node_modules/playwright-core
// if playwright-core is installed separately from this repository.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.CALFMANAGER_PLAYWRIGHT || 'playwright-core');
const repo = fileURLToPath(new URL('..', import.meta.url));
const base = '/calfmanager-pro/';
const switchingDay = dateOffset(initialDate, 1);
const futureDay = dateOffset(initialDate, 28);
const mimeTypes = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json',
};

const output = await mkdtemp(join(tmpdir(), 'calfmanager-browser-'));
let state;
const server = createServer((request, response) => {
  serve(request, response).catch(error => {
    console.error(error);
    response.writeHead(500).end();
  });
});
let browser;
try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  execFileSync(process.execPath, [join(repo, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', output, '--emptyOutDir'], {
    cwd: repo, stdio: 'inherit', env: {
      ...process.env,
      GITHUB_REPOSITORY: 'fixture/calfmanager-pro',
      VITE_SUPABASE_URL: origin,
      VITE_SUPABASE_ANON_KEY: 'local-fixture-only',
    },
  });
  browser = await chromium.launch({
    executablePath: process.env.CALFMANAGER_CHROMIUM || '/usr/bin/chromium',
    args: ['--host-resolver-rules=EXCLUDE 127.0.0.1, MAP * ~NOTFOUND', '--no-proxy-server'],
  });
  const app = `${origin}${base}`;
  const mobile = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
  const desktop = { viewport: { width: 1366, height: 900 } };

  state = makeFixture();
  await withPage(browser, mobile, async (page, context) => {
    await verifyMobile(page, context, app);
  });
  assert.deepEqual(state.unexpected, []);
  console.log('Chromium (390 × 844) prüfte Anmeldung, Kälbersuche und -profil, Aufgaben, Gruppenablauf, Dashboard, Behandlung, MAT, Fütterung, PWA, Offline-Wiegeablauf und Historie nach Abgang.');

  state = makeFixture();
  await withPage(browser, desktop, async (ownerPage) => {
    await login(ownerPage, app, owner);
    await templates(ownerPage);
    await matSettings(ownerPage);
    await dashboard(ownerPage);
    await navigate(ownerPage, 'Aufgaben');
    await withPage(browser, desktop, async (employeePage) => {
      await login(employeePage, app, employee);
      await navigate(employeePage, 'Einstellungen');
      await employeePage.getByRole('heading', { name: 'Betriebseinstellungen', exact: true }).waitFor();
      assert.equal(await employeePage.getByRole('button', { name: 'Vorlage anlegen', exact: true }).isVisible(), false);
      await dashboard(employeePage);
      await assertDueCount(employeePage, 1);
      await navigate(employeePage, 'Aufgaben');
      let releaseOwner;
      state.delayOwnerCompletion = new Promise(resolve => { releaseOwner = resolve; });
      try {
        const pending = ownerPage.waitForRequest(request => request.url().endsWith('/complete_farm_tasks_322'));
        await completeCalfTask(ownerPage, 'Ältere Bestandsaufgabe', calf);
        await pending;
        await completeCalfTask(employeePage, 'Ältere Bestandsaufgabe', calf);
        await completionButton(employeePage, 'Ältere Bestandsaufgabe', calf).waitFor({ state: 'detached' });
      } finally {
        releaseOwner();
      }
      await completionButton(ownerPage, 'Ältere Bestandsaufgabe', calf).waitFor({ state: 'detached' });
      await dashboard(employeePage);
      await assertDueCount(employeePage, 0);
      assert.equal(state.completions.size, 1);
      assert.equal([...state.completions.values()][0].completed_by, employee.id);
      await navigate(employeePage, 'Aufgaben');
      const completed = taskSection(employeePage, 'Heute erledigt');
      await completed.locator('.task-category-heading').click();
      await completed.locator('.task-box-heading').first().click();
      await employeePage.getByText(/Toni Test/).waitFor();
    });
  });
  assert.deepEqual(state.unexpected, []);
  console.log('Chromium (1366 × 900) prüfte Vorlagen, MAT-Einstellungen, Mitarbeiterrechte und konkurrierende Bestätigungen gegen den Mock einschließlich Erledigungsprotokoll.');

  state = makeFixture();
  await verifyFeedingStatus(browser, mobile, app);
  assert.deepEqual(state.unexpected, []);
  console.log('Chromium (390 × 844) prüfte die Fütterungsampel über Runden und Tageswechsel, Bestätigungen, Historie, Mitarbeiterrechte und Betriebswechsel.');
} finally {
  await browser?.close();
  if (server.listening) await new Promise(resolve => server.close(resolve));
  await rm(output, { recursive: true, force: true });
}

async function serve(request, response) {
  const { pathname } = new URL(request.url, 'http://localhost');
  if (isMockApi(pathname)) return mockApi(request, response, state);
  if (pathname === '/browser-test-blank') {
    response.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><title>Browser fixture</title>');
    return;
  }
  const relativePath = pathname === base ? 'index.html' : pathname.startsWith(base) ? pathname.slice(base.length) : '';
  if (!/^(?:assets\/)?[\w-][\w.-]*$/.test(relativePath)) {
    response.writeHead(404).end();
    return;
  }
  const data = await readFile(join(output, relativePath)).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (data === null) response.writeHead(404).end();
  else response.writeHead(200, { 'Content-Type': mimeTypes[extname(relativePath)] ?? 'application/octet-stream' }).end(data);
}

async function withPage(browser, device, action) {
  const context = await browser.newContext({ ...device, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Die Anwendung und der Server verwenden beim Fälligkeitswechsel dieselbe lokale Zeit.
  await page.clock.setFixedTime(new Date(`${initialDate}T10:00:00Z`));
  try {
    await action(page, context);
    assert.deepEqual(errors, []);
  } catch (error) {
    console.error((await page.locator('body').innerText().catch(() => '')).slice(-5000));
    throw error;
  } finally {
    await context.close();
  }
}

async function login(page, app, user, invalidAttempt = false) {
  await page.goto(app);
  await page.locator('input[type=email]').fill(user.email);
  const password = page.locator('input[type=password]');
  const loginButton = page.getByRole('button', { name: 'Anmelden', exact: true });
  if (invalidAttempt) {
    await password.fill('incorrect-fixture-password');
    await loginButton.click();
    await page.getByText('E-Mail-Adresse oder Passwort ist nicht korrekt.', { exact: true }).waitFor();
  }
  await password.fill(fixturePassword);
  await loginButton.click();
  await page.locator('select[aria-label="Betrieb auswählen"] option:checked')
    .filter({ hasText: farm.name }).first().waitFor({ state: 'attached' });
}

async function dashboard(page) {
  await page.getByRole('button', { name: /^(Übersicht|Dashboard)$/ }).filter({ visible: true }).first().click();
  await page.getByRole('region', { name: 'Hauptarbeitsbereiche' }).waitFor();
}

async function navigate(page, name) {
  await page.getByRole('button', { name: new RegExp(`^${name}(?:$|\\s)`) })
    .and(page.locator('.navigation-tile')).click();
  await page.getByRole('heading', { name, exact: true }).first().waitFor();
}

async function assertDueCount(page, count) {
  const badge = page.locator('.task-count-badge');
  if (count === 0) await badge.waitFor({ state: 'detached' });
  else await badge.getByText(String(count), { exact: true }).or(badge.filter({ hasText: new RegExp(`^${count}$`) })).first().waitFor();
}

function taskSection(page, heading) {
  return page.locator('details.task-category').filter({ has: page.locator('summary').getByText(heading, { exact: true }) });
}

function completionButton(page, task, target) {
  return page.getByRole('button', { name: new RegExp(`${task}.*${target.ear_tag}.*erledigen`, 'i') });
}

async function completeCalfTask(page, task, target) {
  await completionButton(page, task, target).first().click();
}

async function verifyFits(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
    'Seite erzeugt keinen horizontalen Überlauf');
}

async function verifyMobile(page, context, app) {
  await page.goto(new URL('/browser-test-blank', app).href);
  await page.evaluate(() => caches.open('calfmanager-shell-v3-2-1'));
  await login(page, app, owner, true);
  await assertDueCount(page, 1);
  await verifyFits(page);
  await navigate(page, 'Kälber');
  const earTag = page.getByRole('button', { name: calf.ear_tag, exact: true });
  await earTag.waitFor();
  const search = page.getByPlaceholder('Kälber suchen');
  await search.fill('keine passende Ohrmarke');
  await earTag.waitFor({ state: 'hidden' });
  await search.fill(calf.ear_tag);
  await earTag.click();
  const profile = page.getByRole('dialog', { name: `Kalb ${calf.ear_tag}` });
  await profile.getByRole('button', { name: '🟢 Grün', exact: true }).waitFor();
  await profile.getByRole('button', { name: 'Aufgabe', exact: true }).click();
  let form = page.getByRole('dialog', { name: /Aufgabe/ }).last();
  await form.getByLabel('Aufgabenvorlage').selectOption(recurringTemplate.id);
  assert.equal(await form.getByLabel('Beginn', { exact: true }).inputValue(), initialDate);
  assert.equal(await form.getByLabel('Durchführungen pro Tag').inputValue(), '2');
  await form.getByLabel('Bemerkung').fill('Testnotiz zur Durchführung');
  await form.getByRole('button', { name: 'Anlegen', exact: true }).click();
  await form.waitFor({ state: 'hidden' });
  assert.equal(state.assignments.length, 1);
  assert.equal(state.assignments[0].end_date, dateOffset(initialDate, 2));
  assert.equal(state.assignments[0].notes, 'Testnotiz zur Durchführung');
  await profile.getByRole('button', { name: 'Schließen', exact: true }).click();
  await dashboard(page);
  await assertDueCount(page, 3);

  await navigate(page, 'Aufgaben');
  await page.getByRole('button',{name:'Erledigt',exact:true}).click();
  const completed = taskSection(page, 'Heute erledigt');
  await completed.locator('.task-category-heading').waitFor();
  assert.notEqual(await completed.getAttribute('open'), null);
  await page.getByRole('button',{name:'Offen',exact:true}).click();
  await taskSection(page, 'Überfällig').getByText(/Ältere Bestandsaufgabe/).first().waitFor();
  assert.equal(await page.getByText('Archivierte Aufgabe', { exact: true }).count(), 0);
  await taskSection(page, 'Heute').locator('.task-category-heading').waitFor();
  await verifyFits(page);
  await completeCalfTask(page, recurringTemplate.name, calf);
  await completionButton(page, recurringTemplate.name, calf).nth(1).waitFor({ state: 'detached' });
  assert.equal(await completionButton(page, recurringTemplate.name, calf).count(), 1);
  await page.getByRole('button',{name:'Erledigt',exact:true}).click();
  await completed.getByText(/Hanna Test/).waitFor();
  assert.equal(state.completions.size, 1);
  await dashboard(page);
  await assertDueCount(page, 2);

  await navigate(page, 'Aufgaben');
  await groupAssignment(page, 'Gruppenmessung', initialDate, true);
  await taskSection(page, 'Heute').getByText('Gruppenmessung', { exact: true }).first().waitFor();
  page.once('dialog', dialog => dialog.accept());
  await taskSection(page, 'Heute').getByRole('button', { name: /Box Nord: Gruppenmessung.*abhaken/ }).click();
  await completionButton(page, 'Gruppenmessung', secondCalf).waitFor({ state: 'detached' });
  await completionButton(page, 'Gruppenmessung', unboxedCalf).waitFor();
  assert.equal(state.completions.size, 3);
  const bulk = state.requests.filter(request => request.route.endsWith('/complete_farm_tasks_322')).at(-1).body;
  assert.equal(bulk.p_tasks.length, 2);
  await groupAssignment(page, 'Kontrolle in vier Wochen', futureDay);
  await page.getByRole('button',{name:'Geplant',exact:true}).click();
  const planned = taskSection(page, 'Geplant');
  await planned.getByText('Kontrolle in vier Wochen', { exact: true }).first().waitFor();

  await dashboard(page);
  await navigate(page, 'Stallübersicht');
  await page.getByRole('button', {name:'Boxen und Gruppen', exact:true}).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByLabel(`Box für ${unboxedCalf.ear_tag}`, { exact: true }).selectOption(boxes[1].id);
  await page.getByText(/Boxenzuordnung gespeichert\./).waitFor();
  await dashboard(page);
  await assertDueCount(page, 3);
  await navigate(page, 'Aufgaben');
  const boxContainingMovedCalf = taskSection(page, 'Heute').locator('details').filter({ has: page.locator('summary').getByText('Box Süd', { exact: true }) });
  await boxContainingMovedCalf.getByText(unboxedCalf.ear_tag, { exact: true }).waitFor();

  state.today = switchingDay;
  await page.clock.setFixedTime(new Date(`${switchingDay}T10:00:00Z`));
  await page.reload();
  await assertDueCount(page, 5);
  await navigate(page, 'Aufgaben');
  await taskSection(page, 'Heute').getByText(recurringTemplate.name, { exact: true }).first().waitFor();
  await taskSection(page, 'Heute').getByText(/Tag 2\/3/).first().waitFor();
  assert.equal(await taskSection(page, 'Heute').getByRole('button', { name: new RegExp(`${recurringTemplate.name}.*${calf.ear_tag}.*erledigen`, 'i') }).count(), 2);
  await page.getByRole('button',{name:'Offen',exact:true}).click();
  await taskSection(page, 'Überfällig').getByText('Gruppenmessung', { exact: true }).waitFor();
  page.once('dialog', dialog => dialog.accept());
  await taskSection(page, 'Heute').getByRole('button', { name: /Aufgabe beenden/ }).first().click();
  await completionButton(page, recurringTemplate.name, calf).first().waitFor({ state: 'detached' });
  await dashboard(page);
  await assertDueCount(page, 2);
  await navigate(page, 'Kälber');
  await page.getByRole('button', { name: calf.ear_tag, exact: true }).click();
  await profile.getByRole('button', { name: 'Historie', exact: true }).click();
  await profile.getByText(recurringTemplate.name, { exact: false }).first().waitFor();
  await profile.getByRole('button', { name: 'Schließen', exact: true }).click();
  await dashboard(page);

  await treatmentFlow(page);
  await feedingAndMat(page);
  await offlineWeight(page, context);
  await departedCalfHistory(page);
}

async function groupAssignment(page, title, start, failFirst = false) {
  await page.getByRole('button', { name: 'Gruppenaufgabe', exact: true }).click();
  const form = page.getByRole('dialog', { name: /Aufgabe anlegen/ });
  const boxToggle = form.getByRole('button', { name: /Box Nord/ });
  const boxCheck = form.getByRole('checkbox', { name: /Box Nord/ });
  await boxCheck.check();
  await boxToggle.click();
  const individual = form.getByRole('checkbox', { name: new RegExp(secondCalf.ear_tag) });
  assert.equal(await individual.isChecked(), true);
  await individual.uncheck();
  assert.equal(await boxCheck.isChecked(), false);
  await individual.check();
  assert.equal(await boxCheck.isChecked(), true);
  assert.equal(await form.getByRole('checkbox', { name: new RegExp(archivedCalf.ear_tag) }).count(), 0);
  await form.getByRole('checkbox', { name: /Ohne Box/ }).check();
  await form.getByLabel('Aufgabenbezeichnung').fill(title);
  await form.getByLabel('Beginn', { exact: true }).fill(start);
  if (failFirst) {
    const previousLength = state.assignments.length;
    state.failNextGroup = true;
    await form.getByRole('button', { name: 'Anlegen', exact: true }).click();
    await form.getByText(/Testfehler bei der Gruppenaufgabe/).waitFor();
    assert.equal(state.assignments.length, previousLength);
  }
  await form.getByRole('button', { name: 'Anlegen', exact: true }).click();
  await form.waitFor({ state: 'hidden' });
  const assigned = state.assignments.filter(item => item.name === title);
  assert.deepEqual(assigned.map(item => item.calf_id).sort(), [calf.id, secondCalf.id, unboxedCalf.id].sort());
  assert.equal(new Set(assigned.map(item => item.group_id)).size, 1);
  if (failFirst) {
    const creationRequests = state.requests.filter(({ route, body }) => route.endsWith('/create_farm_tasks_322') && body.p_name === title);
    assert.equal(creationRequests.length, 2);
    assert.equal(creationRequests[0].body.p_request_id, creationRequests[1].body.p_request_id);
  }
}

async function treatmentFlow(page) {
  await navigate(page, 'Gesundheit');
  const treatment = page.locator('#treatment-planner-320');
  await treatment.getByLabel(/^Kalb/).selectOption(calf.id);
  await treatment.getByLabel(/^Vorlage/).selectOption(legacyTemplate.id);
  await treatment.getByLabel('Startdatum').fill(state.today);
  const scheduled = page.waitForRequest(request => request.url().endsWith('/schedule_treatment_320'));
  page.once('dialog', dialog => dialog.accept());
  await treatment.getByRole('button', { name: 'Aufgaben nach Bestätigung planen' }).click();
  await scheduled;
  await treatment.getByText(/2 geplante Anwendungen erstellt/).waitFor();
  await dashboard(page);
  await assertDueCount(page, 3);
  await navigate(page, 'Aufgaben');
  await taskSection(page, 'Heute').getByText('Behandlungstag 1/2', { exact: true }).waitFor();
  page.once('dialog', dialog => dialog.accept());
  await completeCalfTask(page, legacyTemplate.name, calf);
  await completionButton(page, legacyTemplate.name, calf).first().waitFor({ state: 'detached' });
  assert.equal(state.tables.calf_events.filter(event => event.details.includes(legacyTemplate.id) && event.task_status === 'done').length, 1);
  await dashboard(page);
  await assertDueCount(page, 2);
}

async function verifyFeedingStatus(browser, mobile, app) {
  const otherFarm = { ...farm, id: '22222222-2222-4222-8222-333333333333', name: 'Zweiter Betrieb' };
  const otherCalf = { ...calf, id: '33333333-3333-4333-8333-555555555555',
    farm_id: otherFarm.id, box_id: null, health_status: 'red' };
  const singleBox = { ...boxes[0], id: '55555555-5555-4555-8555-333333333333', kind: 'single', name: 'Iglu' };
  state.farmIdsByUser = { [owner.id]: [farm.id, otherFarm.id], [employee.id]: [farm.id] };
  state.tables.farms = [...state.tables.farms, otherFarm];
  state.tables.calves.push(otherCalf);
  state.tables.farm_boxes = [...state.tables.farm_boxes, singleBox];
  const grouped = state.tables.calves.find(row => row.id === calf.id);
  const single = state.tables.calves.find(row => row.id === secondCalf.id);
  single.box_id = singleBox.id;
  state.tables.farm_milk_curves[0].feedings_per_day = 3;
  const historicalRound = { farm_id: farm.id, calf_id: calf.id, round: 'morning', status: 'green',
    feeding_date: dateOffset(initialDate, -1), updated_at: `${dateOffset(initialDate, -1)}T06:30:00Z` };
  const documentedEvening = { ...historicalRound, calf_id: secondCalf.id, round: 'evening', feeding_date: initialDate };
  const historicalEvent = { id: '66666666-6666-4666-8666-111111111111', farm_id: farm.id,
    calf_id: calf.id, kind: 'feeding', event_date: historicalRound.feeding_date, details: 'Bestandstränke', milk_liters: 3.5 };
  state.tables.calf_feeding_rounds.push(structuredClone(historicalRound), structuredClone(documentedEvening));
  state.tables.calf_events.push(structuredClone(historicalEvent));

  async function openFeeding(page) {
    await navigate(page, 'Fütterung');
    await page.getByRole('button', { name: /Box Nord/ }).click();
  }
  const picker = (page, animal) => page.getByLabel(`Tränkestatus ${animal.ear_tag}`);
  async function expectStatus(page, animal, status) {
    await page.locator(`select.feeding-status.${status}:not([disabled])`).and(picker(page, animal)).waitFor();
    assert.equal(await picker(page, animal).inputValue(), status);
  }
  const round = (page, name) => page.getByRole('group', { name: 'Fütterungsrunde' }).getByRole('button', { name, exact: true }).click();
  const statusWrites = () => state.requests.filter(request => request.route === 'PATCH /rest/v1/calves' && request.body.health_status);
  const healthHistory = id => state.tables.calf_events.filter(event => event.kind === 'health' && event.calf_id === id);

  await withPage(browser, mobile, async page => {
    await login(page, app, owner);
    await page.getByText('VERSION 3.4.3', { exact: true }).waitFor({state:'attached'});
    await openFeeding(page);
    await picker(page, calf).selectOption('yellow');
    await expectStatus(page, calf, 'yellow');
    await picker(page, secondCalf).selectOption('red');
    await expectStatus(page, secondCalf, 'red');
    for (const name of ['Mittag', 'Abend', 'Früh']) {
      await round(page, name);
      await expectStatus(page, calf, 'yellow');
      await expectStatus(page, secondCalf, 'red');
    }
    assert.equal(state.tables.calf_feeding_rounds.length, 4);
    assert.equal(statusWrites().length, 2);
    assert.equal(healthHistory(calf.id).length, 1);
    assert.equal(healthHistory(secondCalf.id).length, 1);
    const firstRedRound = structuredClone(state.tables.calf_feeding_rounds.find(row =>
      row.calf_id === secondCalf.id && row.round === 'morning'));
    assert.equal(firstRedRound.status, 'red');

    // A cancelled red → green change leaves current and historical data intact.
    const prompts = [];
    page.once('dialog', async dialog => { prompts.push(dialog.message()); await dialog.dismiss(); });
    await picker(page, secondCalf).selectOption('green');
    await expectStatus(page, secondCalf, 'red');
    assert.match(prompts[0], /Kalb auf Grün setzen/);
    assert.equal(statusWrites().length, 2);

    await dashboard(page);
    await navigate(page, 'Kälber');
    await page.getByRole('button', { name: /Auffällig \(1\)/ }).click();
    await page.locator('.calf-desktop-table:visible, .calf-mobile-list:visible').getByRole('button', { name: calf.ear_tag, exact: true }).waitFor();
    await page.getByRole('button', { name: /Krank \(1\)/ }).click();
    await page.locator('.calf-desktop-table:visible, .calf-mobile-list:visible').getByRole('button', { name: secondCalf.ear_tag, exact: true }).click();
    const profile = page.getByRole('dialog', { name: `Kalb ${secondCalf.ear_tag}` });
    await profile.getByRole('button', { name: '🔴 Rot', exact: true, pressed: true }).waitFor();
    await profile.getByRole('button', { name: 'Schließen', exact: true }).click();

    // A confirmed change still updates the calf when this round already has a snapshot.
    await dashboard(page);
    await openFeeding(page);
    const acceptGreen = async dialog => {
      prompts.push(dialog.message());
      if (dialog.message().includes('Kalb auf Grün setzen?')) await dialog.accept();
      else await dialog.dismiss();
    };
    page.on('dialog', acceptGreen);
    await picker(page, secondCalf).selectOption('green');
    await expectStatus(page, secondCalf, 'green');
    page.off('dialog', acceptGreen);
    assert.equal(prompts.length, 3);
    assert.match(prompts[2], /offenen Krankheitsfälle/);
    assert.deepEqual(state.tables.calf_feeding_rounds.find(row =>
      row.calf_id === secondCalf.id && row.round === 'morning'), firstRedRound);
    assert.equal(healthHistory(secondCalf.id).length, 2);

    // The visible value is stale. A concurrent change to red must win and trigger reloading.
    grouped.health_status = 'red';
    await picker(page, calf).selectOption('green');
    await page.getByText(/Ampel konnte nicht geändert werden/).waitFor();
    await expectStatus(page, calf, 'red');
    assert.equal(healthHistory(calf.id).length, 1);
    await picker(page, calf).selectOption('yellow');
    await expectStatus(page, calf, 'yellow');
    await round(page, 'Abend');
    await picker(page, secondCalf).selectOption('red');
    await expectStatus(page, secondCalf, 'red');

    await dashboard(page);
    const farmPicker = page.getByRole('combobox', { name: 'Betrieb auswählen' }).filter({ visible: true });
    await farmPicker.selectOption(otherFarm.id);
    await navigate(page, 'Fütterung');
    await page.getByRole('button', { name: /Ohne Box/ }).click();
    await expectStatus(page, otherCalf, 'red');
    assert.equal(await picker(page, secondCalf).count(), 0);
  });

  // A new login at the next day's morning loads statuses from persisted calves.
  state.today = switchingDay;
  await withPage(browser, mobile, async page => {
    await page.clock.setFixedTime(new Date(`${switchingDay}T06:00:00Z`));
    await login(page, app, employee);
    assert.equal(await page.locator(`option[value="${otherFarm.id}"]`).count(), 0);
    await openFeeding(page);
    await expectStatus(page, calf, 'yellow');
    await expectStatus(page, secondCalf, 'red');
    const writesBefore = statusWrites().length;
    await page.getByRole('button', { name: secondCalf.ear_tag, exact: true }).click();
    const profile = page.getByRole('dialog', { name: `Kalb ${secondCalf.ear_tag}` });
    await profile.getByRole('button', { name: '🟡 Gelb', exact: true }).click();
    await profile.getByRole('button', { name: '🟡 Gelb', exact: true, pressed: true }).waitFor();
    await profile.getByRole('button', { name: 'Schließen', exact: true }).click();
    await expectStatus(page, secondCalf, 'yellow');
    await round(page, 'Mittag');
    await expectStatus(page, secondCalf, 'yellow');
    assert.equal(statusWrites().length, writesBefore + 1);
    assert.equal(statusWrites().at(-1).userId, employee.id);
    assert.equal(statusWrites().at(-1).query.farm_id, `eq.${farm.id}`);
    assert.equal(otherCalf.health_status, 'red');
    assert.equal(state.tables.calf_feeding_rounds.length, 4);
    assert.deepEqual(state.tables.calf_feeding_rounds[0], historicalRound);
    assert.deepEqual(state.tables.calf_feeding_rounds[1], documentedEvening);
    assert.deepEqual(state.tables.calf_events.find(event => event.id === historicalEvent.id), historicalEvent);

    await round(page, 'Abend');
    await picker(page, calf).selectOption('red');
    await expectStatus(page, calf, 'red');
    assert.ok(state.tables.calf_feeding_rounds.some(row =>
      row.calf_id === calf.id && row.feeding_date === switchingDay && row.round === 'evening' && row.status === 'red'));
    assert.equal(state.tables.calf_events.filter(event => event.calf_id === calf.id && event.details.startsWith('[AUTO-GESUNDHEIT]')).length, 1);
    assert.equal(state.tables.calf_events.find(event =>
      event.calf_id === calf.id && event.details.startsWith('[AUTO-GESUNDHEIT]')).priority, 'urgent');

    const openCase = { id: '66666666-6666-4666-8666-222222222222', farm_id: farm.id,
      calf_id: calf.id, onset_date: switchingDay, status: 'open', diagnosis: 'Testfall' };
    state.tables.calf_health_cases.push(openCase);
    await page.getByRole('button', { name: calf.ear_tag, exact: true }).click();
    const redProfile = page.getByRole('dialog', { name: `Kalb ${calf.ear_tag}` });
    const confirmBoth = dialog => dialog.accept();
    page.on('dialog', confirmBoth);
    const profileReload = page.waitForResponse(response => response.url().includes('/calves') && response.request().method() === 'GET');
    await redProfile.getByRole('button', { name: '🟢 Grün', exact: true }).click();
    await redProfile.getByRole('button', { name: '🟢 Grün', exact: true, pressed: true }).waitFor();
    await redProfile.getByRole('button', { name: 'Schließen', exact: true }).click();
    await profileReload;
    page.off('dialog', confirmBoth);
    assert.equal(openCase.status, 'recovered');
    assert.equal(openCase.resolved_on, switchingDay);
    await expectStatus(page, calf, 'green');
  });
}

async function feedingAndMat(page) {
  await navigate(page, 'Fütterung');
  const planner = page.locator('.milk-planner');
  await planner.getByRole('button', { name: 'Früh', exact: true }).waitFor();
  const box = planner.getByRole('button', { name: /Box Nord/ });
  await box.getByText('7 l', { exact: true }).waitFor();
  await box.click();
  await planner.getByRole('button', { name: calf.ear_tag, exact: true }).waitFor();
  await planner.getByRole('button', { name: 'Mittag', exact: true }).click();
  assert.equal(await planner.getByLabel(`Tränkestatus ${calf.ear_tag}`).isDisabled(), true);
  await planner.getByRole('button', { name: 'Früh', exact: true }).click();
  const healthTask = page.waitForResponse(response => response.url().includes('/calf_events') && response.request().method() === 'POST');
  await planner.getByLabel(`Tränkestatus ${calf.ear_tag}`).selectOption('yellow');
  await healthTask;
  assert.ok(state.tables.calf_events.some(event => event.details.startsWith('[AUTO-GESUNDHEIT]')));
  const feedingEvent = page.getByRole('button', { name: 'Fütterungseintrag', exact: true });
  await feedingEvent.click();
  const eventForm = page.locator('form.modal').filter({ has: page.getByRole('heading', { name: 'Neuen Eintrag erfassen' }) });
  await eventForm.getByLabel(/^Kalb/).selectOption(calf.id);
  await eventForm.getByLabel('Milchmenge (Liter, optional)').fill('3.5');
  await eventForm.getByRole('button', { name: 'Speichern', exact: true }).click();
  await page.getByText(/^Eintrag gespeichert\./).waitFor();
  assert.ok(state.tables.calf_events.some(event => event.kind === 'feeding' && event.milk_liters === 3.5));
  await page.getByRole('button', { name: /MAT-Rechner/ }).first().click();
  const mat = page.getByRole('dialog', { name: 'MAT-Rechner' });
  await mat.getByLabel('Benötigte fertige MAT-Tränke (l)', { exact: true }).fill('90');
  for (const result of ['81 l', '13,5 kg', '90 l']) await mat.getByText(result, { exact: true }).waitFor();
  await mat.getByRole('button', { name: 'Gesamtbedarf und Vollmilch', exact: true }).click();
  await mat.getByLabel('Gesamtbedarf (l)', { exact: true }).fill('150');
  await mat.getByLabel('Vorhandene Vollmilch (l)', { exact: true }).fill('60');
  for (const result of ['81 l', '13,5 kg', '90 l']) await mat.getByText(result, { exact: true }).waitFor();
  await mat.getByLabel('Vorhandene Vollmilch (l)', { exact: true }).fill('-1');
  await mat.getByText('13,5 kg', { exact: true }).waitFor({ state: 'hidden' });
  await mat.getByRole('button', { name: 'MAT-Rechner schließen', exact: true }).click();
  await planner.getByRole('button', { name: 'Früh', exact: true }).waitFor();
  await verifyFits(page);
}

async function offlineWeight(page, context) {
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  const cacheNames = await page.evaluate(() => caches.keys());
  assert.ok(cacheNames.includes('calfmanager-shell-v3-4-3'));
  assert.ok(!cacheNames.includes('calfmanager-shell-v3-2-1'));
  await dashboard(page);
  await context.setOffline(true);
  await page.getByRole('status').getByText('Offline', { exact: true }).waitFor();
  // Old clients may have queued weights; seed the exact legacy storage contract.
  const queuedId=await page.evaluate(async ({userId,farmId,calfId,eventDate})=>{
    const id=crypto.randomUUID();
    await new Promise((resolve,reject)=>{const req=indexedDB.open('calfmanager-offline-v1',1);req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result;const tx=db.transaction('weights','readwrite');tx.objectStore('weights').put({id,userId,farmId,calfId,eventDate,weightKg:42.5,details:'Altbestand',createdAt:Date.now()});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});return id;
  },{userId:owner.id,farmId:farm.id,calfId:calf.id,eventDate:state.today});
  assert.equal(state.tables.calf_events.filter(event=>event.kind==='weight').length,0);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('status').getByText('Offline',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Gewichte',exact:true}).count(),0);
  await context.setOffline(false);
  await page.getByRole('status').getByText('Online', { exact: true }).waitFor();
  await page.waitForFunction(()=>navigator.onLine);
  for(let i=0;i<50&&!state.tables.calf_events.some(e=>e.id===queuedId);i++) await new Promise(r=>setTimeout(r,100));
  const uploaded = state.tables.calf_events.filter(event => event.kind === 'weight');
  assert.equal(uploaded.length, 1);
  assert.equal(uploaded[0].weight_kg, 42.5);
  assert.equal(uploaded[0].calf_id, calf.id);
  assert.equal(uploaded[0].id,queuedId);
}

async function departedCalfHistory(page) {
  await dashboard(page);
  await assertDueCount(page, 3);
  await navigate(page, 'Kälber');
  const calfLink = page.getByRole('button', { name: calf.ear_tag, exact: true });
  await calfLink.click();
  const profile = page.getByRole('dialog', { name: `Kalb ${calf.ear_tag}` });
  await profile.getByLabel('Status', { exact: true }).selectOption('left');
  await profile.getByRole('button', { name: 'Änderungen speichern', exact: true }).click();
  await profile.getByText('Änderungen gespeichert.', { exact: true }).waitFor();
  assert.equal(await profile.getByRole('button', { name: 'Aufgabe', exact: true }).count(), 0);
  await profile.getByRole('button', { name: 'Schließen', exact: true }).click();
  await calfLink.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: /Archiv und Abgänge/ }).click();
  await page.locator(".calf-card-status").filter({hasText:"Abgegangen"}).first().waitFor();
  await calfLink.click();
  await profile.getByRole('button', { name: 'Historie', exact: true }).click();
  await profile.getByText(recurringTemplate.name, { exact: false }).first().waitFor();
  await profile.getByText(legacyTemplate.name, { exact: false }).first().waitFor();
  await profile.getByRole('button', { name: 'Schließen', exact: true }).click();
  await dashboard(page);
  await assertDueCount(page, 1);
}

async function templates(page) {
  await navigate(page, 'Einstellungen');
  await page.getByRole('button',{name:'Aufgabenvorlagen',exact:true}).click();
  const panel = page.getByRole('region', { name: 'Aufgabenvorlagen', exact: true });
  await panel.getByRole('button', { name: 'Vorlage anlegen', exact: true }).click();
  const form = panel.locator('.task-template-form');
  await form.getByLabel('Aufgabenbezeichnung').fill('Neue Prüfvorlage');
  await form.getByRole('button', { name: 'Vorlage speichern', exact: true }).click();
  await form.waitFor({ state: 'hidden' });
  let row = panel.locator('.task-template-row').filter({ hasText: 'Neue Prüfvorlage' });
  await row.getByRole('button', { name: /Bearbeiten/ }).click();
  await form.getByLabel('Aufgabenbezeichnung').fill('Überarbeitete Prüfvorlage');
  await form.getByRole('button', { name: 'Vorlage speichern', exact: true }).click();
  await form.waitFor({ state: 'hidden' });
  row = panel.locator('.task-template-row').filter({ hasText: 'Überarbeitete Prüfvorlage' });
  await row.getByRole('button', { name: /Deaktivieren/ }).click();
  await row.getByRole('button', { name: /Aktivieren/ }).waitFor();
  assert.equal(state.tables.farm_task_templates_322.find(template => template.name === 'Überarbeitete Prüfvorlage').active, false);
}

async function matSettings(page) {
  await page.getByRole('button',{name:'Zurück',exact:true}).click();
  await page.getByRole('button',{name:'MAT-Rechner',exact:true}).click();
  const settings = page.getByRole('region', { name: 'MAT-Anmischung' });
  await settings.getByLabel('Bezugsmenge der Konzentration').selectOption('water');
  await settings.getByLabel('MAT-Konzentration (g je Liter)', { exact: true }).fill('200');
  await settings.getByRole('button', { name: 'MAT-Angaben speichern', exact: true }).click();
  await settings.getByText('MAT-Angaben gespeichert.', { exact: true }).waitFor();
  assert.equal(state.tables.farm_mat_settings[0].concentration_basis, 'water');
  await dashboard(page);
  await navigate(page, 'Fütterung');
  await page.getByRole('button', { name: 'MAT-Rechner', exact: true }).click();
  const mat = page.getByRole('dialog', { name: 'MAT-Rechner' });
  await mat.getByLabel('Benötigte fertige MAT-Tränke (l)', { exact: true }).fill('90');
  for (const result of ['81 l', '16,2 kg', '90 l']) await mat.getByText(result, { exact: true }).waitFor();
  await mat.getByRole('button', { name: 'MAT-Rechner schließen', exact: true }).click();
}
