<script lang="ts">
  import { goto } from '$app/navigation';
  import AdminSideBar from '$lib/components/users/AdminSideBar.svelte';
  import NavBar from '$lib/components/shared/NavBar.svelte';
  import { isHolochainConnected } from '$lib/utils/holochain-client.utils';
  import {
    ConicGradient,
    Drawer,
    getDrawerStore,
    Modal,
    Toast,
    type ConicStop
  } from '@skeletonlabs/skeleton';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import { getConnectionStatusContext } from '$lib/context/connection-status.context.svelte';
  import { onMount, onDestroy } from 'svelte';
  import AdminMenuDrawer from '@/lib/components/shared/drawers/AdminMenuDrawer.svelte';

  const drawerStore = getDrawerStore();

  const { children } = $props();

  const { agentIsAdministrator } = $derived(administrationStore);

  // Get connection status from context
  const connectionContext = getConnectionStatusContext();
  const isAppReady = $derived(
    connectionContext?.connectionStatus() === 'connected' ||
      connectionContext?.connectionStatus() === 'checking' ||
      isHolochainConnected() // Fallback to basic connection check
  );

  // Get admin loading status from context
  const adminLoadingStatus = $derived(connectionContext?.adminLoadingStatus?.() || 'pending');

  // Determine if admin data is ready or if we should show loading
  const isAdminReady = $derived(
    adminLoadingStatus === 'loaded' || (adminLoadingStatus === 'failed' && agentIsAdministrator) // If loading failed but agent is already known as admin
  );

  // Only redirect if admin data has been loaded and user is not an administrator
  const shouldRedirect = $derived(
    adminLoadingStatus !== 'pending' && adminLoadingStatus !== 'loading' && !agentIsAdministrator
  );

  const conicStops: ConicStop[] = [
    { color: 'transparent', start: 0, end: 0 },
    { color: 'rgb(var(--color-secondary-500))', start: 75, end: 50 }
  ];

  onMount(async () => {
    const htmlElement = document.getElementsByTagName('html')[0];
    htmlElement.classList.add('dark');
  });

  // Cleanup: Remove dark theme when leaving admin section
  onDestroy(() => {
    const htmlElement = document.getElementsByTagName('html')[0];
    htmlElement.classList.remove('dark');
  });

  // Reactive effect to handle redirect logic
  $effect(() => {
    if (shouldRedirect) {
      console.log('🚫 Not an administrator, redirecting to home...');
      goto('/');
    }
  });
</script>

<div class="flex h-screen flex-col">
  <!-- Header -->
  <NavBar />

  <!-- Content Container -->
  <div class="flex flex-1 overflow-hidden">
    <!-- Sidebar -->
    <div class="hidden h-full sm:block">
      <AdminSideBar />
    </div>

    <!-- Main Content -->
    <main class="w-full flex-1 overflow-y-auto bg-surface-800 px-5 py-10">
      {#if !isAppReady}
        <div class="flex h-full flex-col items-center justify-center space-y-4">
          <p class="text-surface-200">Initializing admin panel...</p>
          <ConicGradient stops={conicStops} spin>Loading</ConicGradient>
          <p class="text-sm text-surface-400">
            Connection status is shown in the navigation bar above.
          </p>
        </div>
      {:else if adminLoadingStatus === 'loading'}
        <div class="flex h-full flex-col items-center justify-center space-y-4">
          <p class="text-surface-200">Loading administrator data...</p>
          <ConicGradient stops={conicStops} spin>Loading</ConicGradient>
          <p class="text-sm text-surface-400">Checking your administrator privileges...</p>
        </div>
      {:else if adminLoadingStatus === 'failed'}
        <div class="flex h-full flex-col items-center justify-center space-y-4">
          <p class="text-warning-400">⚠️ Admin data loading failed</p>
          <p class="text-sm text-surface-400">
            Unable to verify administrator status. Please refresh the page.
          </p>
          <button class="variant-filled-primary btn" onclick={() => window.location.reload()}>
            Refresh Page
          </button>
        </div>
      {:else if isAdminReady}
        {@render children()}
      {:else}
        <div class="flex h-full flex-col items-center justify-center space-y-4">
          <p class="text-surface-200">Preparing admin panel...</p>
          <ConicGradient stops={conicStops} spin>Loading</ConicGradient>
        </div>
      {/if}
    </main>
  </div>

  <Toast />

  <!-- Admin Modal Container -->
  <Modal />

  <Drawer>
    {#if $drawerStore.id === 'menu-drawer'}
      <AdminMenuDrawer />
    {/if}
  </Drawer>
</div>
