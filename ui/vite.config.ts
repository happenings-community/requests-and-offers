import { purgeCss } from 'vite-plugin-tailwind-purgecss';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type PluginOption } from 'vite';

export default defineConfig({
  plugins: [sveltekit(), purgeCss()] as PluginOption[],
  build: {
    chunkSizeWarningLimit: 2000,
    target: 'es2022' // Support top-level await
  },
  envDir: '../' // Look for .env files in the parent directory (project root)
});
