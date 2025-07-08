<script lang="ts">
  import { onMount } from 'svelte';
  import type { UIOrganization, UIUser } from '$lib/types/ui';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import { getToastStore } from '@skeletonlabs/skeleton';

  const toastStore = getToastStore();

  let dashboardState = $state({
    isLoading: true,
    error: null as string | null,
    data: {
      administrators: [] as UIUser[],
      pendingUsers: [] as UIUser[],
      pendingProjects: [] as any[],
      pendingOrganizations: [] as UIOrganization[]
    }
  });

  async function fetchDashboardData() {
    dashboardState.isLoading = true;
    dashboardState.error = null;

    try {
      const results = await administrationStore.initialize();

      // Process results based on operation type
      for (const result of results) {
        if (result.status === 'rejected') {
          console.error(`Error in ${result.operation}:`, result.error);
          toastStore.trigger({
            message: `Failed to load ${result.operation}. Some data may be incomplete.`,
            background: 'variant-filled-warning',
            autohide: true,
            timeout: 5000
          });
          continue;
        }

        switch (result.operation) {
          case 'fetchAllUsers':
            // Process administrators and pending users
            dashboardState.data.administrators = administrationStore.administrators;
            dashboardState.data.pendingUsers = (result.value as UIUser[]).filter(
              (user) => user.status?.status_type === 'pending'
            );
            break;

          case 'fetchAllOrganizations':
            // Process pending organizations
            dashboardState.data.pendingOrganizations = (result.value as UIOrganization[]).filter(
              (org) => org.status?.status_type === 'pending'
            );
            break;

          case 'getAllRevisionsForAllUsers':
            // We might want to do something with revisions in the future
            break;
        }
      }

      dashboardState.data.pendingProjects = [];
    } catch (e) {
      dashboardState.error = e instanceof Error ? e.message : 'Failed to load dashboard data';
      toastStore.trigger({
        message: 'Failed to load dashboard data. Please try again.',
        background: 'variant-filled-error',
        autohide: true,
        timeout: 5000
      });
    } finally {
      dashboardState.isLoading = false;
    }
  }

  onMount(fetchDashboardData);
</script>

<section class="mt-24 space-y-8">
  <div class="absolute left-10 top-24 flex flex-col items-center gap-2 sm:left-56">
    <a class="btn bg-secondary-500 text-slate-800 hover:text-black" href="/"> User front-end </a>
    <span>
      <kbd class="kbd !bg-secondary-400 text-black">Alt</kbd> +
      <kbd class="kbd !bg-secondary-400 text-black">A</kbd>
    </span>
  </div>

  <h1 class="h1">Admin Dashboard</h1>

  {#if dashboardState.isLoading}
    <div class="flex items-center justify-center space-x-2 text-center">
      <span class="loading loading-spinner"></span>
      <span>Loading dashboard data...</span>
    </div>
  {:else if dashboardState.error}
    <div class="alert alert-error shadow-lg">
      <div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6 flex-shrink-0 stroke-current"
          fill="none"
          viewBox="0 0 24 24"
          ><path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          /></svg
        >
        <span>{dashboardState.error}</span>
      </div>
      <div class="flex-none">
        <button class="btn btn-sm btn-ghost" onclick={fetchDashboardData}> Try Again </button>
      </div>
    </div>
  {:else}
    <div class="bg-surface-900 grid grid-cols-2 gap-4 border-2 border-slate-900 p-4">
      <div class="stat">
        <div class="stat-title">Administrators</div>
        <div class="stat-value">{dashboardState.data.administrators.length}</div>
      </div>
      <div class="stat">
        <div class="stat-title">Pending Users</div>
        <div class="stat-value">{dashboardState.data.pendingUsers.length}</div>
      </div>
      <div class="stat">
        <div class="stat-title">Pending Projects</div>
        <div class="stat-value">{dashboardState.data.pendingProjects.length}</div>
      </div>
      <div class="stat">
        <div class="stat-title">Pending Organizations</div>
        <div class="stat-value">{dashboardState.data.pendingOrganizations.length}</div>
      </div>
    </div>
  {/if}
</section>
