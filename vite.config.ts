import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function precacheAppAssets(): Plugin {
  return {
    name: 'calfmanager-precache-app-assets',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle)
        .filter(path => path.startsWith('assets/'))
        .sort()
        .map(path => `./${path}`);
      const worker = readFileSync(new URL('./public/sw.js', import.meta.url), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: worker.replace('const PRECACHE_ASSETS = [];', `const PRECACHE_ASSETS = ${JSON.stringify(assets)};`),
      });
    },
  };
}

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
export default defineConfig({
  plugins: [react(), precacheAppAssets()],
  build: { rollupOptions: { output: { manualChunks(id) {
    if (id.includes('/node_modules/@supabase/')) return 'supabase';
    if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-runtime';
  } } } },
  base: repository ? `/${repository}/` : '/',
});
