import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Listed explicitly: 'packages/engines' is a folder of engines, not a project.
    projects: ['packages/kernel', 'packages/agent', 'packages/engines/*', 'apps/*'],
  },
});
