<script lang="ts">
  import '@/app.css';
  import { onMount, type Snippet } from 'svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import hc from '$lib/services/HolochainClientService.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import {
    Modal,
    Drawer,
    Toast,
    getDrawerStore,
    getModalStore,
    getToastStore,
    type ModalComponent,
    type ModalSettings,
    ConicGradient,
    type ConicStop
  } from '@skeletonlabs/skeleton';
  import { initializeStores as skeletonInitializeStores } from '@skeletonlabs/skeleton';
  import { goto } from '$app/navigation';
  import { computePosition, autoUpdate, offset, shift, flip, arrow } from '@floating-ui/dom';
  import { storePopup } from '@skeletonlabs/skeleton';
  import { page } from '$app/state';
  import AdminMenuDrawer from '$lib/components/shared/drawers/AdminMenuDrawer.svelte';
  import MenuDrawer from '$lib/components/shared/drawers/MenuDrawer.svelte';
  import ConfirmModal from '$lib/components/shared/dialogs/ConfirmModal.svelte';
  import type { ConfirmModalMeta } from '$lib/types/ui';
  import hreaStore from '$lib/stores/hrea.store.svelte';
  import { runEffect } from '$lib/utils/effect';

  type Props = {
    children: Snippet;
  };

  const { children } = $props() as Props;

  const currentUser = $derived(usersStore.currentUser);
  const agentIsAdministrator = $derived(administrationStore.agentIsAdministrator);
  
  // Initialization state tracking
  let initializationStatus = $state<'pending' | 'initializing' | 'complete' | 'minimal' | 'failed'>('pending');

  storePopup.set({ computePosition, autoUpdate, offset, shift, flip, arrow });

  skeletonInitializeStores();
  const drawerStore = getDrawerStore();
  const modalStore = getModalStore();
  const toastStore = getToastStore();

  /* This admin registration process is temporary. It simulates the Holochain Progenitor pattern by allowing only the first user to become administrator when no administrators exist. */
  const conicStops: ConicStop[] = [
    { color: 'transparent', start: 0, end: 0 },
    { color: 'rgb(var(--color-primary-500))', start: 75, end: 50 }
  ];

  const confirmModalComponent: ModalComponent = { ref: ConfirmModal };

  /**
   * This admin registration process is temporary. It simulates the Holochain Progenitor pattern by allowing only the first user to become administrator when no administrators exist.
   *
   * TODO: Remove this once the admin registration process is implemented in the Holochain Progenitor pattern.
   */
  async function showProgenitorAdminRegistrationModal() {
    try {
      // Simplified admin check using direct async/await
      const admins = await runEffect(administrationStore.getAllNetworkAdministrators());
      const hasAdmins = admins.length > 0;

      if (hasAdmins) return;
    } catch (error) {
      console.error('Error checking administrators:', error);
      handleLayoutError('Error checking administrator status. Please try again.');
      return;
    }

    // If no administrators exist, allow this user to become the first administrator
    const adminRegistrationModalMeta: ConfirmModalMeta = {
      id: 'progenitor-admin-registration',
      message: `
        <div class="text-center space-y-4">
          <div class="text-warning-500">
            <svg class="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
            </svg>
          </div>
          <div class="space-y-3">
            <h3 class="text-lg font-semibold text-surface-100">Network Initialization</h3>
            <p class="text-surface-300">No administrators exist in this network yet.</p>
            <div class="bg-primary-500/10 border border-primary-500/20 rounded-lg p-3">
              <p class="text-primary-300 text-sm font-medium">🌟 Progenitor Opportunity</p>
              <p class="text-surface-200 text-sm mt-1">As the first user, you can become the initial administrator and help establish this community.</p>
            </div>
            <p class="text-surface-100 font-medium">Do you want to become the network administrator?</p>
          </div>
        </div>
      `,
      confirmLabel: '✨ Become Administrator',
      cancelLabel: 'Not Now'
    };

    const modal: ModalSettings = {
      type: 'component',
      component: confirmModalComponent,
      meta: adminRegistrationModalMeta,
      response: async (confirmed: boolean) => {
        if (!confirmed) {
          modalStore.close();
          return;
        }

        try {
          // Simplified admin registration using direct async/await
          if (!currentUser?.original_action_hash) {
            throw new Error('No current user found');
          }

          // Get agent public key with retry logic
          let agentPubKey;
          let retries = 2;
          
          while (retries >= 0) {
            try {
              const appInfo = await hc.getAppInfo();
              agentPubKey = appInfo?.agent_pub_key;
              break;
            } catch (error) {
              if (retries === 0) {
                throw new Error('Error getting app info after retries');
              }
              retries--;
              console.warn(`Failed to get app info, retrying... (${retries} left)`);
            }
          }

          if (!agentPubKey) {
            throw new Error('Could not get agent public key');
          }

          // Register as network administrator with retry logic
          const validAgentPubKey = agentPubKey as any;
          let result;
          retries = 2;

          while (retries >= 0) {
            try {
              result = await runEffect(
                administrationStore.registerNetworkAdministrator(
                  currentUser!.original_action_hash!,
                  [validAgentPubKey]
                )
              );
              break;
            } catch (error) {
              if (retries === 0) {
                throw new Error('Error registering as administrator after retries');
              }
              retries--;
              console.warn(`Failed to register admin, retrying... (${retries} left)`);
            }
          }

          if (!result) {
            throw new Error('Registration returned false');
          }

          // Refresh administrator data with retry logic
          retries = 2;
          while (retries >= 0) {
            try {
              await runEffect(administrationStore.getAllNetworkAdministrators());
              await runEffect(administrationStore.checkIfAgentIsAdministrator());
              break;
            } catch (error) {
              if (retries === 0) {
                throw new Error('Error refreshing administrators after retries');
              }
              retries--;
              console.warn(`Failed to refresh admin data, retrying... (${retries} left)`);
            }
          }

          toastStore.trigger({
            message: 'Successfully registered as the network administrator!',
            background: 'variant-filled-success',
            autohide: true,
            timeout: 5000
          });
        } catch (error) {
          console.error('Error registering administrator:', error);

          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

          toastStore.trigger({
            message: `Failed to register as administrator: ${errorMessage}`,
            background: 'variant-filled-error',
            autohide: true,
            timeout: 5000
          });
        }

        modalStore.close();
      }
    };

    modalStore.trigger(modal);
  }

  // Initialize toast for main app routes
  import { initializeToast } from '$lib/utils/toast';
  import NavBar from '$lib/components/shared/NavBar.svelte';

  initializeToast();

  // ============================================================================
  // EFFECT-FIRST ERROR HANDLING
  // ============================================================================

  // Create unified error handler for layout initialization
  const handleLayoutError = (errorMessage: string) => {
    console.error('Layout initialization error:', errorMessage);
    toastStore.trigger({
      message: `Initialization Issue: ${errorMessage}. The app will continue in minimal mode.`,
      background: 'variant-filled-warning',
      autohide: false
    });
  };

  // Keep the error boundary concept but simplified

  // Reactive effect to manage dark mode based on current route
  $effect(() => {
    const htmlElement = document.getElementsByTagName('html')[0];
    if (page.url.pathname.startsWith('/admin')) {
      htmlElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
    }
  });

  // ============================================================================
  // PRODUCTION-READY APPLICATION INITIALIZATION WITH FULL RUNTIME INTEGRATION
  // ============================================================================

  // Simplified initialization that follows the working pattern
  onMount(async () => {
    try {
      initializationStatus = 'initializing';
      console.log('🚀 Starting application initialization...');

      // 1. Connect to Holochain client first
      await hc.connectClient();
      console.log('✅ Holochain client connected');

      // 2. Initialize hREA service (non-critical)
      try {
        await runEffect(hreaStore.initialize());
        console.log('✅ hREA initialized successfully');
      } catch (error) {
        console.warn('⚠️ hREA initialization failed (non-critical):', error);
      }

      // 3. Ping to verify connection
      const record = await hc.callZome('misc', 'ping', null);
      console.log('✅ Connection verified with ping');

      // 4. Initialize administration data
      const agentPubKey = (await hc.getAppInfo())?.agent_pub_key;
      if (agentPubKey) {
        try {
          await runEffect(administrationStore.getAllNetworkAdministrators());
          console.log('✅ Network administrators loaded:', administrationStore.administrators.length);
          
          await runEffect(administrationStore.checkIfAgentIsAdministrator());
          console.log('✅ Administrator status checked');
        } catch (error) {
          console.warn('⚠️ Administration initialization failed (continuing):', error);
        }
      }

      // 5. Initialize users store
      try {
        await runEffect(usersStore.refresh());
        console.log('✅ Users store refreshed');
      } catch (error) {
        console.warn('⚠️ Users store initialization failed (continuing):', error);
      }

      initializationStatus = 'complete';
      console.log('🎉 Application initialization completed successfully!');

    } catch (error) {
      console.error('❌ Application initialization failed:', error);
      initializationStatus = 'failed';
      handleLayoutError(`Application initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  async function handleKeyboardEvent(event: KeyboardEvent) {
    if (agentIsAdministrator && event.altKey && (event.key === 'a' || event.key === 'A')) {
      event.preventDefault();
      if (!window.location.pathname.startsWith('/admin')) goto('/admin');
      else goto('/');
    }

    if (
      currentUser &&
      !agentIsAdministrator &&
      event.ctrlKey &&
      event.shiftKey &&
      (event.key === 'a' || event.key === 'A')
    ) {
      event.preventDefault();
      showProgenitorAdminRegistrationModal();
    }
  }
</script>

<svelte:window onkeydown={handleKeyboardEvent} />

{#if !hc.isConnected || initializationStatus === 'initializing'}
  <div class="flex min-h-screen flex-col items-center justify-center space-y-4">
    <div class="text-center">
      {#if initializationStatus === 'initializing'}
        <h2 class="mb-2 text-xl font-semibold">Initializing Application Runtime</h2>
        <p class="text-surface-600 dark:text-surface-400">Setting up Effect-TS services and hREA integration...</p>
      {:else}
        <h2 class="mb-2 text-xl font-semibold">Connecting to Holochain Network</h2>
        <p class="text-surface-600 dark:text-surface-400">Establishing secure connection...</p>
      {/if}
    </div>
    <ConicGradient stops={conicStops} spin>Loading</ConicGradient>
    <div class="text-surface-500 dark:text-surface-400 max-w-md text-center text-sm">
      {#if initializationStatus === 'failed'}
        <p class="text-warning-400">⚠️ Initialization encountered issues. The app will continue with basic functionality.</p>
      {:else if initializationStatus === 'initializing'}
        <p>Configuring application services and checking for dependencies...</p>
      {:else}
        <p>If this takes longer than usual, try restarting the application from the system tray.</p>
      {/if}
    </div>
  </div>
{:else if page.url.pathname.startsWith('/admin')}
  <!-- Admin routes use their own layout -->
  {@render children()}
{:else}
  <!-- Main app routes with navigation -->
  <div class="grid min-h-screen grid-rows-[auto_1fr]">
    <NavBar />
    <main class="flex flex-col items-center justify-center py-10">
      {@render children()}
    </main>
  </div>
{/if}

<Modal />
<Toast />
<Drawer>
  {#if $drawerStore.id === 'menu-drawer'}
    {#if page.url.pathname.startsWith('/admin')}
      <AdminMenuDrawer />
    {:else}
      <MenuDrawer />
    {/if}
  {/if}
</Drawer>
