<script lang="ts">
  import { onMount } from 'svelte';
  import { getModalStore } from '@skeletonlabs/skeleton';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import { formatUserName } from '$lib/schemas/users.schemas';
  import type { UIUser } from '$lib/types/ui';
  import { runEffect } from '$lib/utils/effect';
  import { contactableAdmins } from '$lib/utils/admin-contacts';

  // How a pending, rejected or suspended member reaches the administrators
  // while there is no in-app messaging for them (#331): the contact details
  // each administrator gave on their own profile.

  const modalStore = getModalStore();

  let admins = $state<UIUser[]>([]);
  let loaded = $state(false);
  let failed = $state(false);

  const subject = 'My Requests & Offers membership';
  const mailto = (email: string) => `mailto:${email}?subject=${encodeURIComponent(subject)}`;
  const tel = (phone: string) => `tel:${phone.replace(/[^+\d]/g, '')}`;

  onMount(async () => {
    try {
      admins = contactableAdmins(
        await runEffect(administrationStore.getAllNetworkAdministrators())
      );
    } catch {
      failed = true;
    } finally {
      loaded = true;
    }
  });
</script>

<article class="hcron-modal z-50 !bg-surface-800">
  <div class="flex flex-col gap-6">
    <h2 class="h3 text-center">Contact the administrators</h2>

    {#if !loaded}
      <p class="text-center">Loading contact details...</p>
    {:else if failed}
      <p class="text-center">
        The administrators' details couldn't be loaded. Check your connection and try again.
      </p>
    {:else if admins.length === 0}
      <p class="text-center">No administrator has added contact details to their profile yet.</p>
    {:else}
      <ul class="space-y-4">
        {#each admins as admin (admin.original_action_hash.toString())}
          <li class="card space-y-1 p-4 text-surface-900-50-token">
            <p class="font-semibold">{formatUserName(admin.name)}</p>
            {#if admin.email}
              <a class="anchor block" href={mailto(admin.email)}>{admin.email}</a>
            {/if}
            {#if admin.phone}
              <a class="anchor block" href={tel(admin.phone)}>{admin.phone}</a>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    <button class="variant-filled-secondary btn self-center" onclick={() => modalStore.close()}>
      Close
    </button>
  </div>
</article>
