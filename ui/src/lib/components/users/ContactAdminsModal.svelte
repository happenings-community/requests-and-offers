<script lang="ts">
  import { onMount } from 'svelte';
  import { getModalStore } from '@skeletonlabs/skeleton';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import { formatUserName } from '$lib/schemas/users.schemas';
  import type { UIUser } from '$lib/types/ui';
  import { runEffect } from '$lib/utils/effect';
  import {
    adminMailto,
    contactableAdmins,
    contactNotice,
    type ContactContext
  } from '$lib/utils/admin-contacts';

  // How a member reaches the administrators outside the app: the contact
  // details each administrator gave on their own profile. Opened through
  // `openContact`, whose context fills in the email's subject and opening.

  type Props = {
    context?: ContactContext;
  };

  const { context = { kind: 'membership' } }: Props = $props();

  const modalStore = getModalStore();

  let admins = $state<UIUser[]>([]);
  let loaded = $state(false);
  let failed = $state(false);

  const mailto = (email: string) => adminMailto(email, context);
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
      <p class="text-center text-sm">{contactNotice(context)}</p>
    {/if}

    <button class="variant-filled-secondary btn self-center" onclick={() => modalStore.close()}>
      Close
    </button>
  </div>
</article>
