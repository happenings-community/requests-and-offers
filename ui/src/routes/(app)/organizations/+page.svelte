<script lang="ts">
  import { goto } from '$app/navigation';
  import OrganizationsTable from '@components/OrganizationsTable.svelte';
  import usersStore from '@stores/users.store.svelte';
  import type { UIOrganization } from '@types/ui';
  import { Avatar, ConicGradient, type ConicStop } from '@skeletonlabs/skeleton';
  import organizationsStore from '@stores/organizations.store.svelte';
  import { onMount } from 'svelte';

  let isLoading = $state(true);
  let error = $state<string | null>(null);

  const { acceptedOrganizations } = $derived(organizationsStore);
  const { currentUser } = $derived(usersStore);

  const conicStops: ConicStop[] = [
    { color: 'transparent', start: 0, end: 0 },
    { color: 'rgb(var(--color-primary-500))', start: 75, end: 50 }
  ];

  async function fetchOrganizationsData() {
    try {
      isLoading = true;
      error = null;

      await Promise.allSettled([
        organizationsStore.getAcceptedOrganizations(),
        usersStore.refreshCurrentUser()
      ]);

      if (!acceptedOrganizations.length) {
        error = 'No organizations found.';
      }
    } catch (err) {
      console.error('Failed to fetch organizations:', err);
      error = 'Failed to load organizations. Please try again later.';
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    fetchOrganizationsData();
  });

  function handleCreateOrganization() {
    if (!currentUser) {
      error = 'You must be logged in to create an organization.';
      return;
    }
    goto('/organizations/create');
  }

  function getOrganizationLogo(organization: UIOrganization) {
    return organization.logo
      ? URL.createObjectURL(new Blob([new Uint8Array(organization.logo)]))
      : '/default_avatar.webp';
  }
</script>

<section class="flex flex-col gap-8">
  <h1 class="h1 text-center">Organizations</h1>

  {#if error}
    <div class="alert variant-filled-error">
      <p>{error}</p>
      <button class="btn btn-sm variant-soft" onclick={fetchOrganizationsData}> Try Again </button>
    </div>
  {/if}

  {#if currentUser}
    <button onclick={handleCreateOrganization} class="btn variant-filled-primary w-fit self-center">
      Create Organization
    </button>
  {/if}

  {#if isLoading}
    <ConicGradient stops={conicStops} spin>Loading</ConicGradient>
  {:else if !error && acceptedOrganizations.length}
    <OrganizationsTable organizations={acceptedOrganizations} />
  {/if}
</section>
