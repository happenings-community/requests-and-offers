import { vi } from 'vitest';

// Mock Svelte components
vi.mock('.svelte', () => {
  return {
    default: vi.fn()
  };
});

// Mock any browser/DOM APIs that might be missing in the test environment
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// jsdom has no matchMedia, and some component libraries read it as soon as they are
// imported, which fails the whole file before a test runs. Reports no preference, which
// is what a plain browser with no accessibility setting reports.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  })) as unknown as typeof window.matchMedia;
}
