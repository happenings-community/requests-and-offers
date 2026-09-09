import { purgeCss } from 'vite-plugin-tailwind-purgecss';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, searchForWorkspaceRoot, type PluginOption } from 'vite';
import { existsSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';

// In a git worktree, `node_modules` is a symlink to the main checkout's copy.
// Vite resolves symlinks to their real path before checking `server.fs.allow`,
// so the SvelteKit client runtime is refused with "outside of Vite serving
// allow list" and the app never boots. The page then hangs on the connection
// gate with no JavaScript behind it.
// Allowing the real path of whatever `node_modules` points at fixes worktrees
// and is a no-op in a normal checkout, where the real path is already inside.
const workspaceRoot = searchForWorkspaceRoot(process.cwd());
const linkedNodeModules = ['node_modules', '../node_modules']
  .map((p) => resolve(p))
  .filter((p) => existsSync(p))
  .map((p) => realpathSync(p));

export default defineConfig({
  plugins: [sveltekit(), purgeCss()] as PluginOption[],
  build: {
    chunkSizeWarningLimit: 2000,
    target: 'es2022', // Support top-level await
    outDir: 'build'
  },
  base: './',
  envDir: '../', // Look for .env files in the parent directory (project root)
  server: {
    fs: { allow: [workspaceRoot, ...linkedNodeModules] }
  }
});
