import { spawn } from 'node:child_process';
import { context } from 'esbuild';

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  external: ['electron'],
  sourcemap: true,
};

const mainContext = await context({
  ...shared,
  entryPoints: ['apps/desktop/src/main.ts'],
  outfile: 'apps/desktop/dist/main.cjs',
});
const preloadContext = await context({
  ...shared,
  entryPoints: ['apps/desktop/src/preload.ts'],
  outfile: 'apps/desktop/dist/preload.cjs',
});

await mainContext.rebuild();
await preloadContext.rebuild();
await mainContext.watch();
await preloadContext.watch();

const electron = spawn('electron', ['apps/desktop/dist/main.cjs'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, OUR_STAGE_DEV_URL: 'http://127.0.0.1:5173' },
});

electron.on('exit', async (code) => {
  await mainContext.dispose();
  await preloadContext.dispose();
  process.exit(code ?? 0);
});
