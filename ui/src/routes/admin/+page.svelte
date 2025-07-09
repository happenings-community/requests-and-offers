<script lang="ts">
  import { onMount } from 'svelte';
  import type { UIOrganization, UIUser } from '$lib/types/ui';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import { getToastStore, Tab, TabGroup } from '@skeletonlabs/skeleton';
  import { Icon, ExclamationTriangle } from 'svelte-hero-icons';
  import { Effect as E } from 'effect';
  import type { AnyHolochainClientError } from '$lib/errors/holochain-client.errors';
  import { getUserPictureUrl } from '$lib/utils';

  const toastStore = getToastStore();

  let dashboardState = $state({
    isLoading: true,
    tabSet: 0,
    error: null as string | null,
    data: {
      administrators: [] as UIUser[],
      allUsers: [] as UIUser[],
      allOrganizations: [] as UIOrganization[],
      pendingUsers: [] as UIUser[],
      pendingProjects: [] as any[], // TODO: Add project types
      pendingOrganizations: [] as UIOrganization[]
    }
  });

  async function approveUser(user: UIUser) {
    await E.runPromise(E.tryPromise(() => administrationStore.approveUser(user)));
    toastStore.trigger({ message: 'User approved.', background: 'variant-filled-success' });
    await fetchDashboardData();
  }

  async function rejectUser(user: UIUser) {
    await E.runPromise(E.tryPromise(() => administrationStore.rejectUser(user)));
    toastStore.trigger({ message: 'User rejected.', background: 'variant-filled-warning' });
    await fetchDashboardData();
  }

  async function approveOrganization(org: UIOrganization) {
    await E.runPromise(E.tryPromise(() => administrationStore.approveOrganization(org)));
    toastStore.trigger({ message: 'Organization approved.', background: 'variant-filled-success' });
    await fetchDashboardData();
  }

  async function rejectOrganization(org: UIOrganization) {
    await E.runPromise(E.tryPromise(() => administrationStore.rejectOrganization(org)));
    toastStore.trigger({ message: 'Organization rejected.', background: 'variant-filled-warning' });
    await fetchDashboardData();
  }

  async function fetchDashboardData() {
    dashboardState.isLoading = true;
    dashboardState.error = null;

    try {
      const results = await E.runPromise(
        E.all(
          [
            E.tryPromise(() => administrationStore.getAllNetworkAdministrators()),
            E.tryPromise(() => administrationStore.fetchAllUsers()),
            E.tryPromise(() => administrationStore.fetchAllOrganizations())
            // TODO: Fetch projects
          ],
          { concurrency: 'inherit' }
        )
      );

      const [admins, users, orgs] = results as [UIUser[], UIUser[], UIOrganization[]];
      dashboardState.data.administrators = admins;
      dashboardState.data.allUsers = users;
      dashboardState.data.allOrganizations = orgs;

      dashboardState.data.pendingUsers = users.filter(
        (user: UIUser) => user.status?.status_type === 'pending'
      );
      dashboardState.data.pendingOrganizations = orgs.filter(
        (org: UIOrganization) => org.status?.status_type === 'pending'
      );
      dashboardState.data.pendingProjects = []; // Placeholder
    } catch (e) {
      const error = e as AnyHolochainClientError;
      dashboardState.error = error.message;
      toastStore.trigger({
        message: 'Failed to load dashboard data. Please try again.',
        background: 'variant-filled-error'
      });
    } finally {
      dashboardState.isLoading = false;
    }
  }

  onMount(fetchDashboardData);
</script>

<section class="space-y-8">
  <h1 class="h1">Admin Dashboard</h1>

  <!-- System At a Glance -->
  <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
    <div class="card variant-filled-surface p-4">
      <h3 class="h3">{dashboardState.data.administrators.length}</h3>
      <p class="text-sm text-gray-400">Administrators</p>
    </div>
    <div class="card variant-filled-surface p-4">
      <h3 class="h3">{dashboardState.data.allUsers.length}</h3>
      <p class="text-sm text-gray-400">Total Users</p>
    </div>
    <div class="card variant-filled-surface p-4">
      <h3 class="h3">{dashboardState.data.allOrganizations.length}</h3>
      <p class="text-sm text-gray-400">Total Organizations</p>
    </div>
  </div>

  <!-- Moderation Queue -->
  <div class="card variant-filled-surface p-4">
    <h2 class="h2 mb-4">Moderation Queue</h2>
    {#if dashboardState.isLoading}
      <div class="flex items-center justify-center space-x-2 text-center">
        <span class="loading loading-spinner"></span>
        <span>Loading queue...</span>
      </div>
    {:else if dashboardState.error}
      <div class="alert variant-filled-error">
        <Icon src={ExclamationTriangle} class="h-6 w-6" />
        <span>{dashboardState.error}</span>
        <div class="flex-none">
          <button class="btn btn-sm btn-ghost" onclick={fetchDashboardData}>Try Again</button>
        </div>
      </div>
    {:else}
      <TabGroup justify="justify-start" class="mb-4">
        <Tab bind:group={dashboardState.tabSet} name="pendingUsers" value={0}>
          Pending Users ({dashboardState.data.pendingUsers.length})
        </Tab>
        <Tab bind:group={dashboardState.tabSet} name="pendingOrgs" value={1}>
          Pending Orgs ({dashboardState.data.pendingOrganizations.length})
        </Tab>
        <Tab bind:group={dashboardState.tabSet} name="pendingProjects" value={2}>
          Pending Projects ({dashboardState.data.pendingProjects.length})
        </Tab>
      </TabGroup>

      <!-- Tab Panels -->
      <div class="p-4">
        {#if dashboardState.tabSet === 0}
          <!-- Pending Users Panel -->
          <div class="space-y-4">
            {#each dashboardState.data.pendingUsers as user (user.original_action_hash)}
              <div class="bg-surface-800 flex items-center justify-between rounded-lg p-4">
                <div class="flex items-center gap-4">
                  <img
                    src={getUserPictureUrl(user)}
                    alt="user avatar"
                    class="avatar h-10 w-10 rounded-full"
                  />
                  <span>{user.name}</span>
                </div>
                <div class="flex gap-2">
                  <button
                    class="btn btn-sm variant-filled-success"
                    onclick={() => approveUser(user)}>Approve</button
                  >
                  <button class="btn btn-sm variant-filled-warning" onclick={() => rejectUser(user)}
                    >Reject</button
                  >
                </div>
              </div>
            {:else}
              <p>No pending users.</p>
            {/each}
          </div>
        {:else if dashboardState.tabSet === 1}
          <!-- Pending Orgs Panel -->
          <div class="space-y-4">
            {#each dashboardState.data.pendingOrganizations as org (org.original_action_hash)}
              <div class="bg-surface-800 flex items-center justify-between rounded-lg p-4">
                <div class="flex items-center gap-4">
                  <span>{org.name}</span>
                </div>
                <div class="flex gap-2">
                  <button
                    class="btn btn-sm variant-filled-success"
                    onclick={() => approveOrganization(org)}>Approve</button
                  >
                  <button
                    class="btn btn-sm variant-filled-warning"
                    onclick={() => rejectOrganization(org)}>Reject</button
                  >
                </div>
              </div>
            {:else}
              <p>No pending organizations.</p>
            {/each}
          </div>
        {:else if dashboardState.tabSet === 2}
          <!-- Pending Projects Panel -->
          <p>Pending projects view is not implemented yet.</p>
        {/if}
      </div>
    {/if}
  </div>
</section>
