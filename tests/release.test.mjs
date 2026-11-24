import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Version 3.2.0 is displayed in app source', () => {
  assert.match(read('../src/main.tsx'), /3\.2\.0/);
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
  assert.match(read('../public/sw.js'), /calfmanager-shell-v3-2-0/);
});

test('manifest exists and provides install metadata', () => {
  const manifest = JSON.parse(read('../public/manifest.webmanifest'));
  assert.ok(manifest.name || manifest.short_name);
  assert.equal(manifest.display, 'standalone');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);
});
