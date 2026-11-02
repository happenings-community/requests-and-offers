import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadMocks } from '$lib/utils/load-mocks';

// Vitest runs from ui/ (jsdom gives import.meta.url an http scheme, so it cannot locate files).
const SRC = join(process.cwd(), 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|js|svelte)$/.test(name) ? [path] : [];
  });
}

describe('loadMocks', () => {
  it('refuses when the mock buttons are switched off', async () => {
    expect(import.meta.env.VITE_MOCK_BUTTONS_ENABLED).not.toBe('true');
    await expect(loadMocks()).rejects.toThrow('Mock data is switched off in this build');
  });

  // A single static import of the mocks puts faker back in the production build (#363).
  it('is the only way the app reaches the mock data', () => {
    const offenders = sourceFiles(SRC).filter((file) => {
      if (file.endsWith(join('utils', 'load-mocks.ts')) || file.endsWith(join('utils', 'mocks.ts')))
        return false;
      const text = readFileSync(file, 'utf8');
      return (
        /from\s+['"](\$lib|@\/lib|\.\.?\/[^'"]*)\/?utils\/mocks['"]/.test(text) ||
        /from\s+['"]@faker-js\/faker['"]/.test(text)
      );
    });
    expect(offenders).toEqual([]);
  });
});
