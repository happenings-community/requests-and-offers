import type { Page } from '@playwright/test';
import type { UIUser, UIOrganization } from '$lib/types/ui';
import type { ActionHash } from '@holochain/client';
import { AppWebsocket } from '@holochain/client';

declare global {
  interface Window {
    __HOLOCHAIN_CLIENT__: AppWebsocket;
    __ADMIN_STORE__: {
      allUsers: UIUser[];
      allOrganizations: UIOrganization[];
      getAllUsers: () => UIUser[];
      getAllOrganizations: () => UIOrganization[];
      getAcceptedUsers: () => UIUser[];
      getAcceptedOrganizations: () => UIOrganization[];
    };
    __USERS_STORE__: {
      currentUser: UIUser | null;
      acceptedUsers: UIUser[];
      setCurrentUser: (user: UIUser | null) => Promise<void>;
      getAcceptedUsers: () => Promise<UIUser[]>;
      getUserByActionHash: (actionHash: ActionHash) => Promise<UIUser | null>;
    };
  }
}

export const setupDesktopTest = async ({ page }: { page: Page }) => {
  // Set window size
  await page.setViewportSize({ width: 1280, height: 720 });

  // Add debug logs to track store initialization
  await page.addInitScript(() => {
    window.addEventListener('error', (e) => {
      console.error('Page Error:', e.message);
    });
  });

  // Connect to Holochain
  await page.addInitScript(`
    async function connectToHolochain() {
      try {
        const client = await AppWebsocket.connect('ws://localhost:8888');
        
        // Define client as non-writable property
        Object.defineProperty(window, '__HOLOCHAIN_CLIENT__', {
          value: client,
          writable: false,
          configurable: false
        });

        console.log('Connected to Holochain');
        return client;
      } catch (error) {
        console.error('Failed to connect to Holochain:', error);
        throw error;
      }
    }

    // Initialize connection
    connectToHolochain();
  `);

  // Additional desktop-specific setup
  if (process.env.TAURI_DEV) {
    console.log('Running in development mode');
  } else {
    console.log('Running in production mode');
  }
};
