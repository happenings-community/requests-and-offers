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
      '@': '/src',
      // SvelteKit supplies these two at build time through its own Vite plugin, which this
      // config does not load, so a route importing them cannot resolve and cannot be
      // mounted. The stand-ins are for the test run only; nothing in `src` is aliased.
      '$app/state': '/tests/mocks/app-state.ts',
      '$app/stores': '/tests/mocks/app-stores.ts',
      '$app/navigation': '/tests/mocks/app-navigation.ts'
    }
  }
});
