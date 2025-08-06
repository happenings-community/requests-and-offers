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
  import { Effect as E } from 'effect';

  // Import Effect-SvelteKit integration utilities
  import {
    useEffectOnMount,
    createGenericErrorBoundary,
    runEffectInSvelte,
    createStoreInitializer
  } from '$lib/utils/effect-svelte-integration';

  // Import application runtime
  import {
    initializeApplication,
    defaultAppRuntimeConfig,
    withAppServices
  } from '$lib/runtime/app-runtime';

  // Import error types
  import { AppRuntimeError } from '$lib/errors';

  type Props = {
    children: Snippet;
  };

  const { children } = $props() as Props;

  const currentUser = $derived(usersStore.currentUser);
  const agentIsAdministrator = $derived(administrationStore.agentIsAdministrator);

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
    // Check administrators using Effect-first approach with error boundary
    const checkAdminsProgram = E.gen(function* () {
      const admins = yield* E.tryPromise({
        try: async () => await runEffect(administrationStore.getAllNetworkAdministrators()),
        catch: (error) =>
          new AppRuntimeError({
            component: 'admin-check',
            originalError: error,
            message: 'Error checking administrators'
          })
      });

      return admins.length > 0;
    });

    try {
      const hasAdmins = await E.runPromise(checkAdminsProgram);

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

        // Admin registration program using Effect-first approach
        const adminRegistrationProgram = E.gen(function* () {
          if (!currentUser?.original_action_hash) {
            yield* E.fail(
              new AppRuntimeError({
                component: 'admin-registration',
                originalError: new Error('No current user found'),
                message: 'No current user found'
              })
            );
          }

          // Get agent public key
          const agentPubKey = yield* E.tryPromise({
            try: async () => {
              const appInfo = await hc.getAppInfo();
              return appInfo?.agent_pub_key;
            },
            catch: (error) =>
              new AppRuntimeError({
                component: 'app-info',
                originalError: error,
                message: 'Error getting app info'
              })
          });

          if (!agentPubKey) {
            yield* E.fail(
              new AppRuntimeError({
                component: 'admin-registration',
                originalError: new Error('Could not get agent public key'),
                message: 'Could not get agent public key'
              })
            );
          }

          // Register as network administrator
          const validAgentPubKey = agentPubKey as any; // Type assertion for HoloHash compatibility
          const result = yield* E.tryPromise({
            try: async () =>
              await runEffect(
                administrationStore.registerNetworkAdministrator(
                  currentUser!.original_action_hash!,
                  [validAgentPubKey]
                )
              ),
            catch: (error) =>
              new AppRuntimeError({
                component: 'admin-registration',
                originalError: error,
                message: 'Error registering as administrator'
              })
          });

          if (!result) {
            yield* E.fail(
              new AppRuntimeError({
                component: 'admin-registration',
                originalError: new Error('Registration returned false'),
                message: 'Registration returned false'
              })
            );
          }

          // Refresh administrator data
          yield* E.tryPromise({
            try: async () => {
              await runEffect(administrationStore.getAllNetworkAdministrators());
              await runEffect(administrationStore.checkIfAgentIsAdministrator());
            },
            catch: (error) =>
              new AppRuntimeError({
                component: 'admin-refresh',
                originalError: error,
                message: 'Error refreshing administrators'
              })
          });

          return result;
        });

        // Execute admin registration with error boundary
        try {
          await E.runPromise(adminRegistrationProgram);

          toastStore.trigger({
            message: 'Successfully registered as the network administrator!',
            background: 'variant-filled-success',
            autohide: true,
            timeout: 5000
          });
        } catch (error) {
          console.error('Error registering administrator:', error);

          let errorMessage: string;
          if (error instanceof AppRuntimeError) {
            errorMessage = error.message;
          } else if (error instanceof Error) {
            errorMessage = error.message;
          } else {
            errorMessage = 'Unknown error occurred';
          }

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
    toastStore.trigger({
      message: `Application Error: ${errorMessage}`,
      background: 'variant-filled-error',
      autohide: false
    });
  };

  // Create unified error boundary for layout initialization
  const layoutErrorBoundary = createGenericErrorBoundary<AppRuntimeError | Error>(
    handleLayoutError
  );

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
  // EFFECT-FIRST APPLICATION INITIALIZATION
  // ============================================================================

  // Main application initialization program
  const appInitializationProgram = E.gen(function* () {
    console.log('🚀 Starting Effect-first application initialization...');

    // 1. Connect to Holochain
    yield* E.tryPromise({
      try: async () => {
        await hc.connectClient();
        console.log('✅ Holochain client connected');
      },
      catch: (error) =>
        new AppRuntimeError({
          component: 'holochain-connection',
          originalError: error,
          message: 'Error connecting to Holochain'
        })
    });

    // 2. Test connection with ping
    yield* E.tryPromise({
      try: async () => {
        const record = await hc.callZome('misc', 'ping', null);
        console.log('✅ Ping response:', record);
        return record;
      },
      catch: (error) =>
        new AppRuntimeError({
          component: 'holochain-ping',
          originalError: error,
          message: 'Error pinging Holochain'
        })
    });

    // 3. Get agent public key for admin operations
    const agentPubKey = yield* E.tryPromise({
      try: async () => {
        const appInfo = await hc.getAppInfo();
        console.log('✅ App info:', appInfo);
        return appInfo?.agent_pub_key;
      },
      catch: (error) =>
        new AppRuntimeError({
          component: 'app-info',
          originalError: error,
          message: 'Error getting app info'
        })
    });

    // 4. Initialize hREA service (non-critical)
    yield* E.tryPromise({
      try: async () => {
        await runEffect(hreaStore.initialize());
        console.log('✅ hREA initialized successfully');
      },
      catch: (error) => {
        console.warn('⚠️  hREA initialization failed (non-critical):', error);
        // Return void for non-critical failure
        return undefined;
      }
    }).pipe(
      E.catchAll(() => E.void) // Make hREA initialization non-blocking
    );

    // 5. Initialize administration store
    if (agentPubKey) {
      yield* E.tryPromise({
        try: async () => {
          await runEffect(administrationStore.getAllNetworkAdministrators());
          console.log(
            '✅ Network administrators loaded:',
            administrationStore.administrators.length
          );
        },
        catch: (error) =>
          new AppRuntimeError({
            component: 'admin-load',
            originalError: error,
            message: 'Error loading network administrators'
          })
      });

      yield* E.tryPromise({
        try: async () => {
          await runEffect(administrationStore.checkIfAgentIsAdministrator());
          console.log('✅ Administrator status checked');
        },
        catch: (error) =>
          new AppRuntimeError({
            component: 'admin-check',
            originalError: error,
            message: 'Error checking administrator status'
          })
      });
    }

    // 6. Initialize users store
    yield* E.tryPromise({
      try: async () => {
        await runEffect(usersStore.refresh());
        console.log('✅ Users store refreshed');
      },
      catch: (error) =>
        new AppRuntimeError({
          component: 'users-refresh',
          originalError: error,
          message: 'Error refreshing users store'
        })
    });

    console.log('🎉 Effect-first application initialization completed successfully');
    return {
      holochainConnected: true,
      agentPubKey,
      hreaInitialized: true
    };
  });

  // Use Effect-first initialization with error boundary and timeout
  useEffectOnMount(appInitializationProgram, {
    errorBoundary: layoutErrorBoundary,
    timeout: '30 seconds'
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

{#if !hc.isConnected}
  <div class="flex min-h-screen flex-col items-center justify-center space-y-4">
    <div class="text-center">
      <h2 class="mb-2 text-xl font-semibold">Connecting to Holochain Network</h2>
      <p class="text-surface-600 dark:text-surface-400">Establishing secure connection...</p>
    </div>
    <ConicGradient stops={conicStops} spin>Loading</ConicGradient>
    <div class="text-surface-500 dark:text-surface-400 max-w-md text-center text-sm">
      <p>If this takes longer than usual, try restarting the application from the system tray.</p>
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
