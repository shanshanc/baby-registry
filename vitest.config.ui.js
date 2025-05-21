import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Look for test files in the public/js directory
    include: ['public/js/test/**/*.test.js'],
    // Exclude node_modules
    exclude: ['node_modules/**'],
    // Environment settings, if needed (e.g., for DOM testing)
    environment: 'jsdom', // Or 'happy-dom' for a lighter alternative
    // Coverage reporting, if desired
    coverage: {
      provider: 'v8', // or 'istanbul'
      reporter: ['text', 'json', 'html'],
    },
  },
});
