import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import type { PluginOption } from 'vite';

export default defineConfig({
  plugins: [svelte({ hot: false })] as PluginOption[],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    server: {
      deps: {
        inline: [/@effect\/.*/, /effect/]
      }
    }
  },
  resolve: {
    alias: {
      $lib: '/src/lib'
    }
  }
});
