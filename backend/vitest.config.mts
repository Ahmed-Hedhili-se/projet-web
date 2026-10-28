import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],                        // tous les tests sont dans backend/tests
    fileParallelism: false,                                 // un fichier à la fois : ils partagent la même base
    testTimeout: 15000,
  },
});
