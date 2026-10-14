import { defineConfig, configDefaults } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import type { PluginOption } from 'vite';

export default defineConfig({
  plugins: [svelte({ hot: false })] as PluginOption[],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // Playwright e2e specs run via `playwright test`, not vitest. They import
    // @playwright/test and require a running app, so exclude them from collection.
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
    server: {
      deps: {
        inline: [/@effect\/.*/, /effect/]
      }
    }
  },
  resolve: {
    // Svelte ships two builds, and the server one has no `mount`, so a component test
    // under it fails before it renders. These tests run in jsdom, which is a browser, so
    // the browser build is the right one to resolve.
    conditions: ['browser'],
    alias: {
      $lib: '/src/lib',
      '@': '/src'
    }
  }
});
