import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Version 3.4.0 is consistent in the app and npm metadata', () => {
  assert.match(read('../src/main.tsx'), /VERSION 3\.4\.0/);
  assert.equal(JSON.parse(read('../package.json')).version, '3.4.0');
  const lock = JSON.parse(read('../package-lock.json'));
  assert.equal(lock.version, '3.4.0');
  assert.equal(lock.packages[''].version, '3.4.0');
});

test('offline records are scoped to both user and farm', () => {
  const code = read('../src/offline.ts');
  assert.match(code, /const scope=\(u:string,f:string\)=>`\$\{u\}:\$\{f\}`/);
  assert.match(code, /w\.userId===u&&w\.farmId===f/);
});

test('offline weight uploads use stable IDs and avoid duplicate events', () => {
  const code = read('../src/main.tsx');
  assert.match(code, /onConflict:'id',ignoreDuplicates:true/);
  assert.match(code, /await removeWeight\(w\.id\)/);
});

test('service worker only intercepts same-origin GET requests', () => {
  const code = read('../public/sw.js');
  assert.match(code, /req\.method!=='GET'/);
  assert.match(code, /origin!==self\.location\.origin/);
});

test('service worker cache is versioned for this release', () => {
  assert.match(read('../public/sw.js'), /calfmanager-shell-v3-4-0/);
});

test('manifest exists and provides install metadata', () => {
  const manifest = JSON.parse(read('../public/manifest.webmanifest'));
  assert.ok(manifest.name || manifest.short_name);
  assert.equal(manifest.display, 'standalone');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);
});

test('farmer menu is absent and health controls precede profile tabs', () => {
 const code = read('../src/main.tsx');
 assert.match(code, /topbar">\{isAdmin&&<button className="menu"/);
 const profile = code.slice(code.indexOf('function CalfDetails('));
 assert.ok(profile.indexOf('className="calf-health-actions"') < profile.indexOf('className="calf-profile-tabs"'));
 assert.match(profile, /aria-pressed=/);
});

test('workspace navigation hides weight page and provides birth weight and curve preview', () => {
 const code = read('../src/main.tsx');
 const tabs = code.match(/const tabs=\[.*?\] as const;/)[0];
 assert.doesNotMatch(tabs, /Gewichte/);
 assert.match(code, /<WorkspaceTiles title="Boxenübersicht"/);
 assert.match(code, /<MilkCurveChart drafts=\{pointDrafts\}/);
 assert.match(code, /name="birth_weight_kg"/);
 assert.match(read('../supabase/migration_3_2_4.sql'), /add column if not exists birth_weight_kg/);
});
