// Test setup file - currently empty as mocking is handled in individual test files

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

// Set up any additional test environment configurations here
