<script lang="ts">
  import { page } from '$app/state';
  import type { Snippet } from 'svelte';
  import ProfileGuard from '$lib/components/common/ProfileGuard.svelte';
  import { isOpenToAll } from '$lib/utils/profile-access';

  let { children }: { children: Snippet } = $props();

  // Every public page shows members, organisations or listings, except a
  // member's own profile pages, which stay open at every status (#335).
  const openToAll = $derived(isOpenToAll(page.url.pathname));
</script>

{#if openToAll}
  {@render children()}
{:else}
  <ProfileGuard
    title="Members only"
    description="Listings, members and organisations are open to approved members."
  >
    {@render children()}
  </ProfileGuard>
{/if}
