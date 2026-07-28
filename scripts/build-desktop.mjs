import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';

await mkdir('apps/desktop/dist', { recursive: true });

await build({
  entryPoints: ['apps/desktop/src/entry.ts'],
  outfile: 'apps/desktop/dist/main.cjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  external: ['electron'],
  sourcemap: true,
});

await build({
  entryPoints: ['apps/desktop/src/preload.ts'],
  outfile: 'apps/desktop/dist/preload.cjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  external: ['electron'],
  sourcemap: true,
});
