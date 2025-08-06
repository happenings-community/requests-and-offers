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

  // Effect-SvelteKit Integration Utilities
  import { 
    useEffectOnMount, 
    createGenericErrorBoundary,
    useEffectWithCallback,
    runEffectInSvelte
  } from '$lib/utils/effect-svelte-integration';
  import { Effect as E, Duration, Schedule } from 'effect';

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
   * Effect-first admin registration process that simulates the Holochain Progenitor pattern.
   * 
   * TODO: Remove this once the admin registration process is implemented in the Holochain Progenitor pattern.
   */
  function showProgenitorAdminRegistrationModal() {
    // Create Effect program for admin checking
    const checkAdminsProgram = E.gen(function* () {
      const admins = yield* E.tryPromise({
        try: async () => await runEffect(administrationStore.getAllNetworkAdministrators()),
        catch: (error) => new Error(`Failed to check administrators: ${error}`)
      });
      
      const hasAdmins = admins.length > 0;
      
      if (hasAdmins) {
        yield* E.sync(() => console.log('Administrators already exist, skipping registration modal'));
        return false; // Don't show modal
      }
      
      return true; // Show modal
    });

    // Execute Effect directly in event handler context using runEffectInSvelte
    runEffectInSvelte(checkAdminsProgram, {
      onSuccess: (shouldShowModal) => {
        if (shouldShowModal) {
          displayAdminRegistrationModal();
        }
      },
      onError: (error) => {
        console.error('Admin check failed:', error);
        handleLayoutError(`Error checking administrator status: ${error.message}`);
      },
      timeout: Duration.seconds(10)
    });
  }

  /**
   * Displays the admin registration modal with Effect-first registration logic
   */
  function displayAdminRegistrationModal() {

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
      response: (confirmed: boolean) => {
        if (!confirmed) {
          modalStore.close();
          return;
        }

        // Create Effect-first admin registration program
        const adminRegistrationProgram = E.gen(function* () {
          // Validate current user
          if (!currentUser?.original_action_hash) {
            yield* E.fail(new Error('No current user found'));
          }

          // Get agent public key with built-in retry
          const agentPubKey = yield* E.retry(
            E.tryPromise({
              try: async () => {
                const appInfo = await hc.getAppInfo();
                const pubKey = appInfo?.agent_pub_key;
                if (!pubKey) throw new Error('No agent public key found');
                return pubKey;
              },
              catch: (error) => new Error(`Failed to get app info: ${error}`)
            }),
            Schedule.exponential(Duration.millis(500), 2.0)
          );

          // Register as network administrator with retry
          const result = yield* E.retry(
            E.tryPromise({
              try: async () => {
                const registrationResult = await runEffect(
                  administrationStore.registerNetworkAdministrator(
                    currentUser!.original_action_hash!,
                    [agentPubKey as any]
                  )
                );
                if (!registrationResult) {
                  throw new Error('Registration returned false');
                }
                return registrationResult;
              },
              catch: (error) => new Error(`Admin registration failed: ${error}`)
            }),
            Schedule.exponential(Duration.millis(500), 2.0)
          );

          // Refresh administrator data with retry
          yield* E.retry(
            E.tryPromise({
              try: async () => {
                await runEffect(administrationStore.getAllNetworkAdministrators());
                await runEffect(administrationStore.checkIfAgentIsAdministrator());
              },
              catch: (error) => new Error(`Failed to refresh admin data: ${error}`)
            }),
            Schedule.exponential(Duration.millis(500), 2.0)
          );

          return { success: true, message: 'Successfully registered as administrator' };
        });

        // Execute with error boundary
        runEffectInSvelte(adminRegistrationProgram, {
          onSuccess: (result: { success: boolean; message: string }) => {
            toastStore.trigger({
              message: result.message,
              background: 'variant-filled-success',
              autohide: true,
              timeout: 5000
            });
          },
          onError: (error: Error) => {
            console.error('Admin registration failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            toastStore.trigger({
              message: `Failed to register as administrator: ${errorMessage}`,
              background: 'variant-filled-error',
              autohide: true,
              timeout: 5000
            });
          },
          timeout: Duration.seconds(15)
        });

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
  // EFFECT-FIRST APPLICATION INITIALIZATION WITH INTEGRATION UTILITIES
  // ============================================================================

  /**
   * Effect-first application initialization program that wraps the current
   * working logic with proper Effect error boundaries and timeout handling.
   * 
   * This preserves all existing functionality while adding:
   * - Structured error handling with Effect boundaries
   * - Timeout management for long-running operations
   * - Proper resource cleanup and fiber management
   * - Type-safe error contexts
   */
  const appInitializationProgram = E.gen(function* () {
    // Update initialization status
    yield* E.sync(() => {
      initializationStatus = 'initializing';
      console.log('🚀 Starting Effect-first application initialization...');
    });

    // 1. Connect to Holochain client first
    yield* E.tryPromise({
      try: async () => {
        await hc.connectClient();
        console.log('✅ Holochain client connected');
      },
      catch: (error) => new Error(`Holochain connection failed: ${error}`)
    });

    // 2. Initialize hREA service (non-critical with graceful fallback)
    yield* E.catchAll(
      E.tryPromise({
        try: async () => {
          await runEffect(hreaStore.initialize());
          console.log('✅ hREA initialized successfully');
        },
        catch: (error) => new Error(`hREA initialization failed: ${error}`)
      }),
      (error) => E.sync(() => {
        console.warn('⚠️ hREA initialization failed (non-critical):', error);
        return undefined; // Continue without hREA
      })
    );

    // 3. Ping to verify connection
    yield* E.tryPromise({
      try: async () => {
        const record = await hc.callZome('misc', 'ping', null);
        console.log('✅ Connection verified with ping');
        return record;
      },
      catch: (error) => new Error(`Connection verification failed: ${error}`)
    });

    // 4. Initialize administration data
    const agentPubKey = yield* E.tryPromise({
      try: async () => (await hc.getAppInfo())?.agent_pub_key,
      catch: (error) => new Error(`Failed to get app info: ${error}`)
    });

    if (agentPubKey) {
      // Initialize administration data with graceful error handling
      yield* E.catchAll(
        E.tryPromise({
          try: async () => {
            await runEffect(administrationStore.getAllNetworkAdministrators());
            console.log('✅ Network administrators loaded:', administrationStore.administrators.length);
            
            await runEffect(administrationStore.checkIfAgentIsAdministrator());
            console.log('✅ Administrator status checked');
          },
          catch: (error) => new Error(`Administration initialization failed: ${error}`)
        }),
        (error) => E.sync(() => {
          console.warn('⚠️ Administration initialization failed (continuing):', error);
          return undefined;
        })
      );
    }

    // 5. Initialize users store with graceful error handling
    yield* E.catchAll(
      E.tryPromise({
        try: async () => {
          await runEffect(usersStore.refresh());
          console.log('✅ Users store refreshed');
        },
        catch: (error) => new Error(`Users store initialization failed: ${error}`)
      }),
      (error) => E.sync(() => {
        console.warn('⚠️ Users store initialization failed (continuing):', error);
        return undefined;
      })
    );

    // Mark initialization as complete
    yield* E.sync(() => {
      initializationStatus = 'complete';
      console.log('🎉 Effect-first application initialization completed successfully!');
    });

    return { status: 'success', message: 'Application initialized successfully' };
  });

  // Create error boundary for structured error handling
  const layoutErrorBoundary = createGenericErrorBoundary<Error>((message) => {
    handleLayoutError(`Application initialization failed: ${message}`);
  });

  // Use Effect-SvelteKit integration utility with error boundary and timeout
  useEffectOnMount(appInitializationProgram, {
    errorBoundary: layoutErrorBoundary,
    timeout: Duration.seconds(30) // Reasonable timeout for initialization
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
