import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    globals: true,
    include: ['functions/api/__tests__/**/*.test.js'],
    exclude: ['node_modules/**/*'],
  },
}); 