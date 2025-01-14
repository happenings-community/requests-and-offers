import type { Page } from '@playwright/test';

export const setupDesktopTest = async ({ page }: { page: Page }) => {
  // Set window size
  await page.setViewportSize({ width: 1280, height: 720 });

  // Additional desktop-specific setup
  if (process.env.TAURI_DEV) {
    console.log('Running in development mode');
  } else {
    console.log('Running in production mode');
  }
};
