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
  import { useBackgroundAdminCheck } from '$lib/composables/connection/useBackgroundAdminCheck.svelte';
  import { HolochainClientServiceLive } from '$lib/services/HolochainClientService.svelte';
  import { AdministrationError } from '$lib/errors/administration.errors';

  // Effect-SvelteKit Integration Utilities
  import {
    useEffectOnMount,
    createGenericErrorBoundary,
    useEffectWithCallback,
    runEffectInSvelte
  } from '$lib/utils/effect-svelte-integration';
  import { Effect as E, Duration, Schedule, pipe } from 'effect';

  type Props = {
    children: Snippet;
  };

  const { children } = $props() as Props;

  const currentUser = $derived(usersStore.currentUser);

  // Background admin status checking (replaces direct store access)
  const backgroundAdminCheck = useBackgroundAdminCheck();
  const agentIsAdministrator = $derived(backgroundAdminCheck.isAdmin);

  // Initialization state tracking with detailed progress
  let initializationStatus = $state<'pending' | 'initializing' | 'complete' | 'minimal' | 'failed'>(
    'pending'
  );

  // Detailed initialization progress tracking
  type InitStep = {
    id: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    message?: string;
  };

  let initializationSteps = $state<InitStep[]>([
    { id: 'client', name: 'Connect to Holochain', status: 'pending' },
    { id: 'hrea', name: 'Initialize hREA Service', status: 'pending' },
    { id: 'users', name: 'Initialize User Store', status: 'pending' }
  ]);

  // Helper functions for step management
  function updateStep(stepId: string, status: InitStep['status'], message?: string) {
    const step = initializationSteps.find((s) => s.id === stepId);
    if (step) {
      step.status = status;
      if (message) step.message = message;
      initializationSteps = [...initializationSteps]; // Trigger reactivity
    }
  }

  function getCompletedStepsCount(): number {
    return initializationSteps.filter((s) => s.status === 'completed').length;
  }

  function getTotalStepsCount(): number {
    return initializationSteps.length;
  }

  let progressPercentage = $state(0);

  $effect(() => {
    progressPercentage = (getCompletedStepsCount() / getTotalStepsCount()) * 100;
  });

  // Connection status state management
  type ConnectionStatus = 'checking' | 'connected' | 'disconnected' | 'error';
  let connectionStatus = $state<ConnectionStatus>('checking');
  let lastPingTime = $state<Date | null>(null);
  let pingError = $state<string | null>(null);

  // Admin loading state management
  type AdminLoadingStatus = 'pending' | 'loading' | 'loaded' | 'failed';
  let adminLoadingStatus = $state<AdminLoadingStatus>('pending');

  // Check if current route is admin
  const isAdminRoute = $derived(page.url.pathname.startsWith('/admin'));

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
        yield* E.sync(() =>
          console.log('Administrators already exist, skipping registration modal')
        );
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
                // Re-initialize to refresh all admin data including status
                await E.runPromise(
                  pipe(
                    administrationStore.initialize(),
                    E.provide(HolochainClientServiceLive)
                  ) as E.Effect<void, AdministrationError, never>
                );
                console.log('✅ Administration data refreshed after registration');
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

  // Connection status context for sharing across layouts
  import { setConnectionStatusContext } from '$lib/context/connection-status.context.svelte';

  // Set connection status context for child layouts
  setConnectionStatusContext({
    connectionStatus: () => connectionStatus,
    lastPingTime: () => lastPingTime,
    pingError: () => pingError,
    adminLoadingStatus: () => adminLoadingStatus
  });

  // Reactive effect to manage dark mode based on current route
  $effect(() => {
    const htmlElement = document.getElementsByTagName('html')[0];
    if (page.url.pathname.startsWith('/admin')) {
      htmlElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
    }
  });

  // Reactive effect to load admin data when navigating to admin routes
  $effect(() => {
    if (isAdminRoute && adminLoadingStatus === 'pending' && hc.isConnected) {
      console.log('🔍 Admin route detected, starting admin initialization...');

      // Start background admin initialization only when needed
      runEffectInSvelte(backgroundAdminInitProgram, {
        onError: (error) => {
          console.warn('Admin initialization failed:', error);
          // Don't show toast for admin failures - the admin layout will handle this
        },
        timeout: Duration.seconds(15)
      });
    }
  });

  // ============================================================================
  // EFFECT-FIRST APPLICATION INITIALIZATION WITH INTEGRATION UTILITIES
  // ============================================================================

  /**
   * Effect-first application initialization program with detailed progress tracking.
   *
   * This preserves all existing functionality while adding:
   * - Detailed step-by-step progress tracking
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
    yield* E.sync(() => updateStep('client', 'running', 'Establishing connection...'));
    yield* E.tryPromise({
      try: async () => {
        await hc.connectClient();
        console.log('✅ Holochain client connected');
        updateStep('client', 'completed', 'Connected successfully');
      },
      catch: (error) => {
        updateStep('client', 'failed', `Connection failed: ${error}`);
        throw new Error(`Holochain connection failed: ${error}`);
      }
    });

    // 2. Initialize hREA service (non-critical with graceful fallback)
    yield* E.sync(() => updateStep('hrea', 'running', 'Initializing hREA GraphQL...'));
    yield* E.catchAll(
      E.tryPromise({
        try: async () => {
          await runEffect(hreaStore.initialize());
          console.log('✅ hREA initialized successfully');
          updateStep('hrea', 'completed', 'hREA service ready');
        },
        catch: (error) => {
          updateStep('hrea', 'failed', `hREA failed: ${error}`);
          throw new Error(`hREA initialization failed: ${error}`);
        }
      }),
      (error) =>
        E.sync(() => {
          console.warn('⚠️ hREA initialization failed (non-critical):', error);
          updateStep('hrea', 'skipped', 'Skipped due to error (non-critical)');
          return undefined; // Continue without hREA
        })
    );

    // 3. Initialize users store with graceful error handling
    yield* E.sync(() => updateStep('users', 'running', 'Loading user data...'));
    yield* E.catchAll(
      E.tryPromise({
        try: async () => {
          await runEffect(usersStore.refresh());
          console.log('✅ Users store refreshed');
          updateStep('users', 'completed', 'User store ready');
        },
        catch: (error) => {
          updateStep('users', 'failed', `User load failed: ${error}`);
          throw new Error(`Users store initialization failed: ${error}`);
        }
      }),
      (error) =>
        E.sync(() => {
          console.warn('⚠️ Users store initialization failed (continuing):', error);
          updateStep('users', 'skipped', 'Skipped due to error (continuing)');
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

  /**
   * Background administration initialization that runs when needed for admin routes.
   * This loads admin data on-demand when accessing admin functionality.
   */
  const backgroundAdminInitProgram = E.gen(function* () {
    yield* E.sleep(Duration.millis(100)); // Minimal delay to let main UI render

    console.log('🔍 Starting conditional admin initialization...');
    adminLoadingStatus = 'loading';

    const agentPubKey = yield* E.tryPromise({
      try: async () => (await hc.getAppInfo())?.agent_pub_key,
      catch: (error) => new Error(`Failed to get app info: ${error}`)
    });

    if (agentPubKey) {
      // Initialize administration data with graceful error handling
      yield* E.catchAll(
        E.tryPromise({
          try: async () => {
            // Use the centralized initialize method which now includes admin status check
            await E.runPromise(
              pipe(
                administrationStore.initialize(),
                E.provide(HolochainClientServiceLive)
              ) as E.Effect<void, AdministrationError, never>
            );
            console.log(
              '✅ Administration store initialized:',
              `${administrationStore.administrators.length} administrators,`,
              `agent is admin: ${administrationStore.agentIsAdministrator}`
            );
            adminLoadingStatus = 'loaded';
          },
          catch: (error) => {
            adminLoadingStatus = 'failed';
            throw new Error(`Administration initialization failed: ${error}`);
          }
        }),
        (error) =>
          E.sync(() => {
            console.warn('⚠️ Administration initialization failed (non-critical):', error);
            adminLoadingStatus = 'failed';
            return undefined;
          })
      );
    } else {
      console.log('⚠️ No agent pub key available for admin initialization');
      adminLoadingStatus = 'failed';
    }
  });

  /**
   * Background connection verification that runs after initialization.
   * This doesn't block app startup but provides connection status feedback.
   */
  const backgroundPingProgram = E.gen(function* () {
    yield* E.sleep(Duration.millis(500)); // Small delay to let UI render first

    connectionStatus = 'checking';
    console.log('🔍 Starting background connection verification...');

    yield* E.retry(
      E.tryPromise({
        try: async () => {
          const result = await hc.callZome('misc', 'ping', null);
          connectionStatus = 'connected';
          lastPingTime = new Date();
          pingError = null;
          console.log('✅ Background ping successful');
          return result;
        },
        catch: (error) => {
          throw new Error(`Ping failed: ${error}`);
        }
      }),
      // Retry schedule: 3 attempts with exponential backoff
      Schedule.exponential('1 second').pipe(
        Schedule.intersect(Schedule.recurs(2)) // Max 3 total attempts
      )
    ).pipe(
      E.timeout(Duration.seconds(15)), // Shorter timeout for background check
      E.catchAll((error) =>
        E.sync(() => {
          const isTimeout =
            error &&
            typeof error === 'object' &&
            'tag' in error &&
            error.tag === 'TimeoutException';
          connectionStatus = isTimeout ? 'disconnected' : 'error';
          pingError = isTimeout
            ? 'Connection timeout'
            : error instanceof Error
              ? error.message
              : 'Unknown error';
          console.warn('⚠️ Background ping failed:', error);
          return undefined; // Don't fail the entire program
        })
      )
    );
  });

  // Create error boundary for structured error handling
  const layoutErrorBoundary = createGenericErrorBoundary<Error>((message) => {
    handleLayoutError(`Application initialization failed: ${message}`);
  });

  // Use Effect-SvelteKit integration utility with error boundary and timeout
  useEffectOnMount(
    E.gen(function* () {
      // Run the main initialization program
      const result = yield* appInitializationProgram;

      // Start background ping verification after successful initialization
      runEffectInSvelte(backgroundPingProgram, {
        onError: (error) => {
          console.warn('Background ping program failed:', error);
          // Don't show toast for background ping failures
        },
        timeout: Duration.seconds(20)
      });

      return result;
    }),
    {
      errorBoundary: layoutErrorBoundary,
      timeout: Duration.seconds(20) // Reduced timeout since we removed blocking admin step
    }
  );

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
  <div class="flex min-h-screen flex-col items-center justify-center space-y-6 p-8">
    <div class="text-center">
      {#if initializationStatus === 'initializing'}
        <h2 class="mb-2 text-2xl font-semibold">Initializing Application Runtime</h2>
        <p class="text-surface-600 dark:text-surface-400">
          Setting up core services... Admin features will load in background.
        </p>
      {:else}
        <h2 class="mb-2 text-2xl font-semibold">Connecting to Holochain Network</h2>
        <p class="text-surface-600 dark:text-surface-400">Establishing secure connection...</p>
      {/if}
    </div>

    <!-- Progress indicator -->
    {#if initializationStatus === 'initializing'}
      <div class="w-full max-w-md">
        <!-- Progress bar -->
        <div class="mb-4">
          <div class="text-surface-500 dark:text-surface-400 mb-1 flex justify-between text-sm">
            <span>Progress</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <div class="bg-surface-300 dark:bg-surface-700 h-2 w-full rounded-full">
            <div
              class="bg-primary-500 h-2 rounded-full transition-all duration-300 ease-out"
              style="width: {progressPercentage}%"
            ></div>
          </div>
        </div>

        <!-- Initialization steps -->
        <div class="space-y-3 text-left">
          {#each initializationSteps as step}
            <div
              class="bg-surface-100 dark:bg-surface-800 flex items-center space-x-3 rounded-lg p-3"
            >
              <!-- Status icon -->
              <div class="flex-shrink-0">
                {#if step.status === 'completed'}
                  <svg class="text-success-500 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clip-rule="evenodd"
                    ></path>
                  </svg>
                {:else if step.status === 'running'}
                  <svg
                    class="text-primary-500 h-5 w-5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    ></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                {:else if step.status === 'failed'}
                  <svg class="text-error-500 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clip-rule="evenodd"
                    ></path>
                  </svg>
                {:else if step.status === 'skipped'}
                  <svg class="text-warning-500 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fill-rule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clip-rule="evenodd"
                    ></path>
                  </svg>
                {:else}
                  <div
                    class="border-surface-400 dark:border-surface-500 h-5 w-5 rounded-full border-2"
                  ></div>
                {/if}
              </div>

              <!-- Step info -->
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between">
                  <h4 class="text-surface-900 dark:text-surface-100 text-sm font-medium">
                    {step.name}
                  </h4>
                  <span class="text-surface-500 dark:text-surface-400 text-xs capitalize">
                    {step.status === 'running' ? 'In Progress' : step.status}
                  </span>
                </div>
                {#if step.message}
                  <p class="text-surface-600 dark:text-surface-400 mt-1 truncate text-xs">
                    {step.message}
                  </p>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <ConicGradient stops={conicStops} spin>Loading</ConicGradient>
    {/if}

    <div class="text-surface-500 dark:text-surface-400 max-w-md text-center text-sm">
      {#if initializationStatus === 'failed'}
        <p class="text-warning-400">⚠️ Initialization encountered issues.</p>
      {:else if initializationStatus === 'initializing'}
        <p>This usually takes 5-15 seconds.</p>
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
    <NavBar {connectionStatus} {lastPingTime} {pingError} />
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
