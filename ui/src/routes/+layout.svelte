<script lang="ts">
  import '../app.postcss';
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import type { AgentPubKey } from '@holochain/client';
  import usersStore from '$lib/stores/users.store.svelte';
  import hc from '$lib/services/HolochainClientService.svelte';
  import { initializeHotReload } from '@theweave/api';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import {
    Modal,
    Drawer,
    Toast,
    ConicGradient,
    type ConicStop,
    type ModalComponent,
    type ModalSettings,
    getModalStore,
    getDrawerStore
  } from '@skeletonlabs/skeleton';
  import { initializeStores as skeletonInitializeStores } from '@skeletonlabs/skeleton';
  import { goto } from '$app/navigation';
  import { computePosition, autoUpdate, offset, shift, flip, arrow } from '@floating-ui/dom';
  import { storePopup } from '@skeletonlabs/skeleton';
  import { page } from '$app/state';
  import MenuDrawer from '$lib/components/shared/drawers/MenuDrawer.svelte';
  import ConfirmModal from '$lib/components/shared/dialogs/ConfirmModal.svelte';
  import type { ConfirmModalMeta } from '$lib/types/ui';
  import hreaStore from '$lib/stores/hrea.store.svelte';
  import { useBackgroundAdminCheck } from '$lib/composables/connection/useBackgroundAdminCheck.svelte';
  import NavBar from '$lib/components/shared/NavBar.svelte';
  import { setConnectionStatusContext } from '$lib/context/connection-status.context.svelte';
  import { connectToHolochain, isHolochainConnected } from '$lib/utils/simple-connection';
  import { runEffect, wrapPromise } from '$lib/utils/effect';
  import { initializeToast } from '@/lib/utils/toast';
  import { Effect as E, pipe, Schedule, Duration } from 'effect';

  type Props = {
    children: Snippet;
  };

  const { children } = $props() as Props;

  const currentUser = $derived(usersStore.currentUser);

  // Background admin status checking
  const backgroundAdminCheck = useBackgroundAdminCheck();
  const agentIsAdministrator = $derived(backgroundAdminCheck.isAdmin);

  // Simple loading state
  let connectionError = $state<string | null>(null);

  // Connection status tracking
  let connectionStatus = $state<'disconnected' | 'checking' | 'connected' | 'error'>(
    'disconnected'
  );
  let lastPingTime = $state<Date | null>(null);
  let pingError = $state<string | null>(null);
  let initializationStatus = $state<'pending' | 'initializing' | 'complete' | 'failed'>('pending');

  // Network information tracking
  let networkSeed = $state<string | null>(null);
  let networkInfo = $state<{ dnaHash: string; roleName: string } | null>(null);

  // Progress tracking
  let initializationSteps = $state([
    { name: 'Client Connection', status: 'pending', message: 'Waiting to start...' },
    { name: 'hREA Service', status: 'pending', message: 'Waiting to start...' },
    { name: 'Network Verification', status: 'pending', message: 'Waiting to start...' }
  ]);

  let progressPercentage = $derived.by(() => {
    const completedSteps = initializationSteps.filter((step) => step.status === 'completed').length;
    return Math.round((completedSteps / initializationSteps.length) * 100);
  });

  function updateStep(
    stepName: string,
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped',
    message: string
  ) {
    const step = initializationSteps.find((s) =>
      s.name.toLowerCase().includes(stepName.toLowerCase())
    );
    if (step) {
      step.status = status;
      step.message = message;
    }
  }

  // Check if current route is admin
  const isAdminRoute = $derived(page.url.pathname.startsWith('/admin'));

  storePopup.set({ computePosition, autoUpdate, offset, shift, flip, arrow });

  skeletonInitializeStores();
  const modalStore = getModalStore();
  const drawerStore = getDrawerStore();

  const confirmModalComponent: ModalComponent = { ref: ConfirmModal };

  // Conic gradient stops for loading animation
  const conicStops: ConicStop[] = [
    { color: 'transparent', start: 0, end: 0 },
    { color: 'rgb(var(--color-primary-500))', start: 75, end: 50 }
  ];

  // Initialize toast system
  initializeToast();

  function showProgenitorAdminRegistrationModal() {
    // Check if user is already an administrator before showing modal
    if (agentIsAdministrator) {
      console.log('ℹ️ User is already an administrator, navigating to admin panel');
      goto('/admin');
      return;
    }

    const adminRegistrationModalMeta: ConfirmModalMeta = {
      id: 'admin-registration',
      message: `
🌟 Become Network Administrator

You are the first user on this network! Would you like to become the network administrator?

Do you want to become the network administrator?
      `,
      confirmLabel: '✨ Become Administrator',
      cancelLabel: 'Not Now'
    };

    // Effect for admin registration with proper error handling
    const registerAsAdmin = pipe(
      E.gen(function* () {
        if (!currentUser?.original_action_hash) {
          throw new Error('No current user found');
        }

        // Check if user is already an administrator before attempting registration
        if (agentIsAdministrator) {
          yield* E.logInfo('ℹ️ User is already an administrator, skipping registration');
          return true; // Return success since user is already admin
        }

        const appInfo = yield* wrapPromise(() => hc.getAppInfo(), 'Failed to get app info');

        const pubKey = appInfo?.agent_pub_key;
        if (!pubKey) throw new Error('No agent public key found');

        yield* administrationStore.registerNetworkAdministrator(currentUser.original_action_hash, [
          pubKey as AgentPubKey
        ]);

        yield* E.logInfo('✅ Successfully registered as network administrator');
        return true;
      }),
      E.timeout(Duration.seconds(10)),
      E.tapError((error) => E.logError(`❌ Admin registration failed: ${error.message}`))
    );

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
          await runEffect(registerAsAdmin);
          modalStore.close();
          goto('/admin');
        } catch (error) {
          console.error('Admin registration failed:', error);
          modalStore.close();

          // Handle specific error cases with better user feedback
          const errorMessage = (error as any)?.message || String(error);

          if (errorMessage.includes('Already an admin')) {
            // User is already an administrator - navigate them to admin panel
            console.log('ℹ️ User is already an administrator, navigating to admin panel');
            goto('/admin');
          } else if (
            errorMessage.includes('ribosome_error') ||
            errorMessage.includes('WasmError')
          ) {
            // Handle backend validation errors
            console.warn('⚠️ Backend validation error:', errorMessage);
            // Could show a toast message here in the future
          } else {
            // Generic error handling
            console.error('❌ Unexpected admin registration error:', error);
          }
        }
      }
    };

    modalStore.trigger(modal);
  }

  // Set connection status context for child layouts (initial setup)
  setConnectionStatusContext({
    connectionStatus: () => connectionStatus,
    lastPingTime: () => lastPingTime,
    pingError: () => pingError,
    adminLoadingStatus: () => {
      // Map admin check state to loading status
      if (backgroundAdminCheck.isChecking) return 'loading';
      if (backgroundAdminCheck.hasError) return 'failed';
      if (backgroundAdminCheck.isReady) return 'loaded';
      return 'pending';
    },
    networkSeed: () => networkSeed,
    networkInfo: () => networkInfo
  });

  // Effect-first initialization function with improved logging and structure
  const initializeApp = E.gen(function* () {
    yield* E.logInfo('🚀 Starting Effect-first application initialization...');
    yield* E.logInfo(
      '📋 Initialization sequence: [1/4] Holochain Connection → [2/4] hREA Service → [3/4] Network Verification → [4/4] User Data'
    );

    // Update state through Effect with logging
    yield* E.sync(() => {
      initializationStatus = 'initializing';
      connectionStatus = 'checking';
    });
    yield* E.logInfo('🔄 Application state set to initializing');

    // Step 1: Connect to Holochain with Effect retry logic (following ConnectionService pattern)
    yield* E.sync(() => updateStep('client', 'running', 'Establishing connection...'));

    const connected = yield* pipe(
      E.tryPromise({
        try: () => connectToHolochain(),
        catch: (error) => new Error(`Holochain connection failed: ${error}`)
      }),
      E.retry(
        Schedule.exponential('500 millis').pipe(
          Schedule.intersect(Schedule.recurs(2)) // Max 3 attempts (consistent with ConnectionService)
        )
      ),
      E.timeout(Duration.seconds(10)), // Consistent timeout with ConnectionService
      E.tap((connected) =>
        connected
          ? E.logInfo('✅ Holochain connection established successfully')
          : E.logWarning('⚠️ Holochain connection returned false')
      ),
      E.tapError((error) => E.logError(`❌ Connection attempt failed: ${error.message}`))
    );

    if (connected) {
      yield* E.logInfo('✅ Holochain connected successfully');
      yield* E.sync(() => {
        updateStep('client', 'completed', 'Connected successfully');
        connectionStatus = 'connected';
        lastPingTime = new Date();
      });

      // Step 2: Initialize hREA with proper error handling
      yield* E.sync(() => {
        updateStep('hrea', 'running', 'Initializing hREA GraphQL...');
      });
      yield* E.logInfo('🔄 [2/3] Starting hREA GraphQL service initialization...');

      // Initialize hREA sequentially with timeout and recovery
      yield* pipe(
        hreaStore.initializeWithRetry(),
        E.timeout(Duration.seconds(15)),
        E.tap(() => {
          E.logInfo('✅ [2/4] hREA service initialized successfully');
          updateStep('hrea', 'completed', 'hREA service ready');
        }),
        E.tapError((error) => E.logWarning(`⚠️ [2/4] hREA initialization retry failed: ${error}`)),
        E.catchAll((error) =>
          pipe(
            E.logError(`❌ [2/4] hREA initialization failed: ${error}`),
            E.map(() => {
              updateStep('hrea', 'skipped', 'Skipped due to error (non-critical)');
              return null;
            })
          )
        )
      );

      // Step 3: Log network seed information for user verification
      yield* E.sync(() => {
        updateStep('network', 'running', 'Verifying network configuration...');
      });
      yield* pipe(
        E.logInfo('🔄 [3/4] Verifying network configuration...'),
        E.flatMap(() =>
          E.tryPromise({
            try: () => hc.getNetworkSeed(),
            catch: (error) => new Error(`Failed to get network seed: ${error}`)
          })
        ),
        E.tap((seed) =>
          E.sync(() => {
            networkSeed = seed;
          })
        ),
        E.flatMap(() =>
          E.tryPromise({
            try: () => hc.getNetworkInfo(),
            catch: (error) => new Error(`Failed to get network info: ${error}`)
          })
        ),
        E.tap((info) =>
          E.sync(() => {
            networkInfo = info;
          })
        ),
        E.tap(() => E.logInfo(`🌐 [3/4] Network Seed: ${networkSeed}`)),
        E.tap(() => console.log(`🌐 NETWORK SEED VERIFICATION: ${networkSeed}`)),
        E.tap(() => console.log(`🌐 DNA Hash: ${networkInfo?.dnaHash}`)),
        E.tap(() => console.log(`🌐 Role Name: ${networkInfo?.roleName}`)),
        E.tap(() =>
          console.log(
            `ℹ️  Users can verify they're on the same network by comparing this network seed`
          )
        ),
        E.tap(() => {
          updateStep('network', 'completed', 'Network verified');
        }),
        E.catchAll((error) => {
          E.logWarning(`⚠️ [3/4] Network seed verification failed: ${error}`);
          console.warn(`⚠️ Could not verify network seed: ${error}`);
          updateStep('network', 'skipped', 'Network verification failed (non-critical)');
          return E.void;
        })
      );

      // Step 4: Load user data sequentially (critical for reliable page initialization)
      yield* pipe(
        E.logInfo('🔄 [4/4] Loading user data...'),
        E.flatMap(() => usersStore.refreshCurrentUser()),
        E.tap((user) =>
          E.logInfo(`✅ [4/4] User data loaded successfully: ${user?.nickname || 'null'}`)
        ),
        E.catchAll((error) => {
          E.logWarning(`⚠️ [4/4] User data loading failed: ${error}`);
          // Don't fail the entire initialization, but ensure user store is in a consistent state
          return E.void;
        })
      );

      // Step 5: Auto-register Moss progenitor as admin (if applicable)
      yield* pipe(
        E.gen(function* () {
          // Only in Weave context
          if (!hc.isWeaveContext) {
            yield* E.logInfo('📋 Not in Weave context, skipping progenitor auto-admin');
            return;
          }

          // Check if current agent is progenitor
          const isProgenitor = yield* E.tryPromise({
            try: () => hc.isGroupProgenitor(),
            catch: (error) => new Error(`Failed to check progenitor status: ${error}`)
          });

          if (!isProgenitor) {
            yield* E.logInfo('📋 Not group progenitor, skipping auto-admin');
            return;
          }

          // Check if any admins exist already
          const hasAdmins = yield* administrationStore.hasAnyAdministrators();

          if (hasAdmins) {
            yield* E.logInfo('📋 Admins already exist, skipping auto-admin');
            return;
          }

          // Check if current user exists
          const user = usersStore.currentUser;
          if (!user?.original_action_hash) {
            yield* E.logInfo('📋 No current user, skipping auto-admin');
            return;
          }

          // Get agent pub key
          const appInfo = yield* E.tryPromise({
            try: () => hc.getAppInfo(),
            catch: (error) => new Error(`Failed to get app info: ${error}`)
          });

          if (!appInfo?.agent_pub_key) {
            yield* E.logWarning('⚠️ No agent pub key, cannot auto-register admin');
            return;
          }

          // Auto-register as first admin
          yield* E.logInfo('🌟 Auto-registering Moss progenitor as network administrator...');
          yield* administrationStore.registerNetworkAdministrator(
            user.original_action_hash,
            [appInfo.agent_pub_key as AgentPubKey]
          );
          yield* E.logInfo('✅ Moss progenitor auto-registered as administrator');
        }),
        E.catchAll((error) => {
          // Non-critical - log warning and continue
          console.warn(`⚠️ Progenitor auto-admin failed (non-critical): ${error}`);
          return E.void;
        })
      );

      // Set loading to false after progress display
      yield* E.sleep('500 millis');
      yield* E.sync(() => {
        initializationStatus = 'complete'; // Ensure proper completion
      });

      yield* E.logInfo('✅ Application initialization completed successfully');
    } else {
      yield* E.logError('❌ Failed to connect to Holochain');
      yield* E.sync(() => {
        updateStep('client', 'failed', 'Connection failed');
        connectionStatus = 'error';
        connectionError = 'Failed to connect to Holochain. Please refresh the page.';
        initializationStatus = 'failed';
      });
    }
  });

  // Wrapper function to run the Effect and handle top-level errors
  async function initializeAsync() {
    try {
      await runEffect(initializeApp);
    } catch (error) {
      console.error('❌ Application initialization failed:', error);
      updateStep('client', 'failed', `Initialization failed: ${error}`);
      connectionStatus = 'error';
      connectionError = 'Initialization failed. Please refresh the page.';
      initializationStatus = 'failed';
    }
  }

  // Effect-based keyboard event handling
  const handleAdminNavigation = pipe(
    E.sync(() => {
      if (!window.location.pathname.startsWith('/admin')) {
        goto('/admin');
      } else {
        goto('/');
      }
    }),
    E.catchAll((error) => E.logError(`❌ Admin navigation failed: ${error}`))
  );

  const handleAdminRegistration = pipe(
    E.sync(() => showProgenitorAdminRegistrationModal()),
    E.catchAll((error) => E.logError(`❌ Admin registration trigger failed: ${error}`))
  );

  // Network seed logging function for debugging
  const logNetworkSeed = pipe(
    E.gen(function* () {
      const networkSeed = yield* E.tryPromise({
        try: () => hc.getNetworkSeed(),
        catch: (error) => new Error(`Failed to get network seed: ${error}`)
      });

      const networkInfo = yield* E.tryPromise({
        try: () => hc.getNetworkInfo(),
        catch: (error) => new Error(`Failed to get network info: ${error}`)
      });

      console.log(`🌐 === NETWORK SEED VERIFICATION ===`);
      console.log(`🌐 Network Seed: ${networkSeed}`);
      console.log(`🌐 DNA Hash: ${networkInfo.dnaHash}`);
      console.log(`🌐 Role Name: ${networkInfo.roleName}`);
      console.log(`🌐 ====================================`);
      console.log(
        `ℹ️  Share this network seed with other users to verify you're on the same network`
      );

      yield* E.logInfo(`🌐 Network seed logged to console: ${networkSeed}`);
    }),
    E.catchAll((error) => {
      console.warn(`⚠️ Could not log network seed: ${error}`);
      return E.void;
    })
  );

  async function handleKeyboardEvent(event: KeyboardEvent) {
    // Alt+A - Toggle admin panel (for existing admins)
    if (agentIsAdministrator && event.altKey && (event.key === 'a' || event.key === 'A')) {
      event.preventDefault();
      await runEffect(handleAdminNavigation);
    }

    // Ctrl+Shift+A - First admin registration (standalone only, zero admins)
    if (
      currentUser &&
      !agentIsAdministrator &&
      event.ctrlKey &&
      event.shiftKey &&
      (event.key === 'a' || event.key === 'A')
    ) {
      event.preventDefault();

      // Block in Weave context - progenitor auto-admin handles this
      if (hc.isWeaveContext) {
        console.log('ℹ️ In Weave context - admin registration handled via progenitor auto-admin');
        return;
      }

      // Check if any admins exist
      try {
        const hasAdmins = await runEffect(administrationStore.hasAnyAdministrators());
        if (hasAdmins) {
          console.log('ℹ️ Administrators already exist - shortcut disabled');
          return;
        }
      } catch (error) {
        console.warn('Failed to check admin count:', error);
        return;
      }

      // Show registration modal
      await runEffect(handleAdminRegistration);
    }

    // If user is already admin and tries to register, just navigate to admin panel
    if (
      currentUser &&
      agentIsAdministrator &&
      event.ctrlKey &&
      event.shiftKey &&
      (event.key === 'a' || event.key === 'A')
    ) {
      event.preventDefault();
      console.log('ℹ️ User is already an administrator, navigating to admin panel');
      goto('/admin');
    }

    // Add keyboard shortcut for network seed logging (Ctrl+Alt+N)
    if (event.ctrlKey && event.altKey && (event.key === 'n' || event.key === 'N')) {
      event.preventDefault();
      await runEffect(logNetworkSeed);
    }
  }

  onMount(() => {
// Initialize Weave hot-reload for dev mode (no-op in production webhapp)
    // This allows the app to detect Weave context when running via `npx weave dev`
    initializeHotReload();

    // Log helpful information about network seed verification
    console.log(`🔍 Network Verification Tips:`);
    console.log(`• The network seed will be displayed during initialization`);
    console.log(`• Press Ctrl+Alt+N anytime to show network information`);
    console.log(`• Compare network seeds with other users to verify you're on the same network`);
    console.log(`• Network seed: ${networkSeed || 'Will be shown during initialization...'}`);

    initializeAsync();
  });

  // Set connection status for other components with reactive updates
  $effect(() => {
    const connected = isHolochainConnected();

    // Log connection status changes
    if (connectionStatus !== (connected ? 'connected' : 'disconnected')) {
      console.log(`🔗 Connection status updated: ${connected ? 'connected' : 'disconnected'}`);
    }

    // Update reactive state (context is already set with functions that return current values)
    connectionStatus = connected ? 'connected' : 'disconnected';
    lastPingTime = connected ? new Date() : lastPingTime;
  });
</script>

<svelte:window onkeydown={handleKeyboardEvent} />

{#if connectionStatus !== 'connected' || initializationStatus === 'initializing'}
  <div class="flex min-h-screen flex-col items-center justify-center space-y-6 p-8">
    <div class="text-center">
      {#if initializationStatus === 'initializing'}
        <h2 class="mb-2 text-2xl font-semibold">Initializing Application Runtime</h2>
        <p class="text-surface-600 dark:text-surface-400">
          Setting up core services... User data and admin features will load in background.
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
          <div class="mb-1 flex justify-between text-sm text-surface-500 dark:text-surface-400">
            <span>Progress</span>
            <span>{progressPercentage}%</span>
          </div>
          <div class="h-2 w-full rounded-full bg-surface-300 dark:bg-surface-700">
            <div
              class="h-2 rounded-full bg-primary-500 transition-all duration-300 ease-out"
              style="width: {progressPercentage}%"
            ></div>
          </div>
        </div>

        <!-- Initialization steps -->
        <div class="space-y-3 text-left">
          {#each initializationSteps as step}
            <div
              class="flex items-center space-x-3 rounded-lg bg-surface-100 p-3 dark:bg-surface-800"
            >
              <!-- Status icon -->
              <div class="flex-shrink-0">
                {#if step.status === 'completed'}
                  <svg class="h-5 w-5 text-success-500" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clip-rule="evenodd"
                    ></path>
                  </svg>
                {:else if step.status === 'running'}
                  <svg
                    class="h-5 w-5 animate-spin text-primary-500"
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
                  <svg class="h-5 w-5 text-error-500" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clip-rule="evenodd"
                    ></path>
                  </svg>
                {:else if step.status === 'skipped'}
                  <svg class="h-5 w-5 text-warning-500" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fill-rule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clip-rule="evenodd"
                    ></path>
                  </svg>
                {:else}
                  <div
                    class="h-5 w-5 rounded-full border-2 border-surface-400 dark:border-surface-500"
                  ></div>
                {/if}
              </div>

              <!-- Step info -->
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between">
                  <h4 class="text-sm font-medium text-surface-900 dark:text-surface-100">
                    {step.name}
                  </h4>
                  <span class="text-xs capitalize text-surface-500 dark:text-surface-400">
                    {step.status === 'running' ? 'In Progress' : step.status}
                  </span>
                </div>
                {#if step.message}
                  <p class="mt-1 truncate text-xs text-surface-600 dark:text-surface-400">
                    {step.message}
                  </p>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <!-- ConicGradient loading animation -->
      <ConicGradient stops={conicStops} spin>Loading</ConicGradient>
    {/if}

    {#if connectionError}
      <div class="max-w-md text-center">
        <div class="rounded-lg bg-error-100 p-4 dark:bg-error-900">
          <p class="text-error-800 dark:text-error-200">{connectionError}</p>
          <button
            onclick={() => window.location.reload()}
            class="mt-2 rounded bg-error-500 px-4 py-2 text-white hover:bg-error-600"
          >
            Refresh Page
          </button>
        </div>
      </div>
    {:else}
      <div class="max-w-md text-center text-sm text-surface-500 dark:text-surface-400">
        {#if initializationStatus === 'failed'}
          <p class="text-warning-400">⚠️ Initialization encountered issues.</p>
        {:else if initializationStatus === 'initializing'}
          <p>This usually takes 5-15 seconds.</p>
        {:else}
          <p>
            If this takes longer than usual, try restarting the application from the system tray.
          </p>
        {/if}
      </div>
    {/if}
  </div>
{:else if isAdminRoute}
  <!-- Admin routes use their own layout -->
  {@render children()}
{:else}
  <!-- Main app routes with navigation -->
  <div class="grid min-h-screen grid-rows-[auto_1fr]">
    <NavBar {connectionStatus} {lastPingTime} {pingError} {networkSeed} {networkInfo} />
    <main class="flex flex-col items-center justify-center py-10">
      {@render children()}
    </main>
  </div>

  <!-- Toast Container -->
  <Toast />

  <!-- Modal Container -->
  <Modal />

  <!-- Drawer Container -->
  <Drawer>
    {#if $drawerStore.id === 'menu-drawer'}
      <MenuDrawer />
    {/if}
  </Drawer>
{/if}
