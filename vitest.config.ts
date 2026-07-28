import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@our-stage/project-schema': `${root}packages/project-schema/src/index.ts`,
      '@our-stage/timeline-engine': `${root}packages/timeline-engine/src/index.ts`,
      '@our-stage/mmd-runtime': `${root}packages/mmd-runtime/src/index.ts`,
      '@our-stage/motion-registry': `${root}packages/motion-registry/src/index.ts`,
      '@our-stage/validator': `${root}packages/validator/src/index.ts`,
      '@our-stage/ai-director': `${root}packages/ai-director/src/index.ts`,
      '@our-stage/video-export': `${root}packages/video-export/src/index.ts`,
      '@our-stage/platform-api': `${root}packages/platform-api/src/index.ts`,
      '@our-stage/shared': `${root}packages/shared/src/index.ts`,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts', 'apps/**/*.test.tsx'],
    coverage: { reporter: ['text', 'json', 'html'] },
  },
});
