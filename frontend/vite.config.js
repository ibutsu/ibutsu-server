import { defineConfig } from 'vitest/config';
import { transformWithOxc } from 'vite';
import react from '@vitejs/plugin-react';

const jsxInJs = () => ({
  name: 'jsx-in-js',
  enforce: 'pre',
  async transform(code, id) {
    const normalized = id.replace(/\\/g, '/');
    if (!normalized.endsWith('.js') || !normalized.includes('/src/'))
      return null;
    return transformWithOxc(code, id, { lang: 'jsx' });
  },
});

export default defineConfig({
  plugins: [react(), jsxInJs()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    open: false,
  },
  build: {
    outDir: 'build',
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.js'],
    css: true,
    fakeTimers: {
      toFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'Date',
      ],
    },
    deps: {
      inline: [/@patternfly/, /@testing-library/],
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/index.js',
        'src/setupTests.js',
        'src/**/*.test.js',
        'src/**/*.spec.js',
        'src/views/accessibility-*.js',
        'src/test-utils/**',
      ],
      thresholds: {
        branches: 28,
        functions: 25,
        lines: 31,
        statements: 31,
      },
      reporter: ['text-summary', 'html', 'lcov', 'json-summary'],
    },
  },
});
