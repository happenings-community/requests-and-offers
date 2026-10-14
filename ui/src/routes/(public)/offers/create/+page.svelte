<script lang="ts">
  import { page } from '$app/state';
  import { paths, readCreateListingParams } from '$lib/paths';
  import { goto } from '$app/navigation';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import offersStore from '$lib/stores/offers.store.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import OfferForm from '$lib/components/offers/OfferForm.svelte';
  import PrerequisitesGuard from '@/lib/components/common/PrerequisitesGuard.svelte';
  import type { OfferInput } from '$lib/types/holochain';
  import type { ActionHash } from '@holochain/client';
  import { decodeHashFromBase64, encodeHashToBase64 } from '@holochain/client';
  import type { UIOrganization } from '$lib/types/ui';
  import { runEffect } from '$lib/utils/effect';
  import ProfileGuard from '@/lib/components/common/ProfileGuard.svelte';
  import AfterPublish from '$lib/components/messaging/AfterPublish.svelte';

  // State
  let isLoading = $state(true);
  let error: string | null = $state(null);
  let preselectedOrganization: UIOrganization | null = $state(null);

  // Toast store for notifications
  const toastStore = getToastStore();

  // Derived values
  const { currentUser } = $derived(usersStore);
  const { acceptedOrganizations } = $derived(organizationsStore);

  // The organisation this listing is being published for, if any.
  const createParams = $derived(readCreateListingParams(page.url));
  const organizationId = $derived(
    createParams.organization ? encodeHashToBase64(createParams.organization) : null
  );

  // Handle form submission
  /** Set once a listing published from a conversation has been created. */
  let published = $state(false);
  /** The listing just created, which is what "Share it with ..." sends. */
  let publishedHash = $state<ActionHash | null>(null);

  async function handleSubmit(offer: OfferInput, organizationHash?: ActionHash) {
    try {
      const record = await runEffect(offersStore.createOffer(offer, organizationHash));
      publishedHash =
        (record as { signed_action?: { hashed?: { hash?: ActionHash } } })?.signed_action?.hashed
          ?.hash ?? null;

      toastStore.trigger({
        message: 'Offer created successfully!',
        background: 'variant-filled-success'
      });

      // Invalidate cache to ensure fresh data on the list page
      offersStore.invalidateCache();

      // Published from a conversation: stay, and offer the way back. Jumping to the
      // offers list would strand a member who came here mid-conversation, and they may
      // want to look at what they just posted first.
      if (createParams.from) {
        published = true;
        return;
      }

      goto(paths.offers());
    } catch (err) {
      console.error('Failed to create offer:', err);
      toastStore.trigger({
        message: `Failed to create offer: ${err instanceof Error ? err.message : String(err)}`,
        background: 'variant-filled-error'
      });
    }
  }

  // Load user organizations and preselected organization on component mount
  async function loadData() {
    try {
      isLoading = true;
      error = null;

      if (currentUser?.original_action_hash) {
        await runEffect(organizationsStore.getUserOrganizations(currentUser.original_action_hash));
      }

      // If there's an organization ID in the URL, try to load it
      if (organizationId) {
        try {
          const orgHash = decodeHashFromBase64(organizationId);
          preselectedOrganization = await runEffect(
            organizationsStore.getLatestOrganization(orgHash)
          );

          // Verify that the user is a member or coordinator of this organization
          if (preselectedOrganization && currentUser?.original_action_hash) {
            const isMember = preselectedOrganization.members.some(
              (member) => member.toString() === currentUser.original_action_hash?.toString()
            );

            const isCoordinator = preselectedOrganization.coordinators.some(
              (coord) => coord.toString() === currentUser.original_action_hash?.toString()
            );

            if (!isMember && !isCoordinator) {
              preselectedOrganization = null;
              console.warn('User is not a member or coordinator of the specified organization');
            }
          }
        } catch (err) {
          console.error('Failed to load preselected organization:', err);
          preselectedOrganization = null;
        }
      }
    } catch (err) {
      console.error('Failed to load organizations:', err);
      error = err instanceof Error ? err.message : 'Failed to load organizations';
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    loadData();
  });
</script>

<ProfileGuard
  allowBrowsing={false}
  allowCreating={true}
  title="Profile Required to Create Offers"
  description="You need an approved profile to create offers to help others in the community."
  redirectToProfile={true}
>
  <PrerequisitesGuard
    title="Service Types Required for Offers"
    description="Offers must be categorized with service types. Administrators need to create service types before users can create offers."
  >
    <section class="container mx-auto p-4">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="h1">Create Offer</h1>
        <button class="variant-soft btn" onclick={() => goto(paths.offers())}>
          Back to Offers
        </button>
      </div>

      {#if error}
        <div class="alert variant-filled-error mb-4">
          <p>{error}</p>
        </div>
      {/if}

      {#if isLoading}
        <div class="flex h-64 items-center justify-center">
          <span class="loading loading-spinner text-primary"></span>
          <p class="ml-4">Loading...</p>
        </div>
      {:else if published}
        <!--
            Published from a conversation, so the member stays here with a way back
            rather than being dropped onto the listings page mid-conversation.
          -->
        <div class="card variant-soft-success flex flex-col items-start gap-3 p-6">
          <p class="font-semibold">Your offer is published.</p>
          <!-- Which ending this is depends on how the member got here; the component
               reads that from the URL rather than being told. -->
          <AfterPublish listing={publishedHash} />
        </div>
      {:else}
        <div class="card variant-soft p-6">
          <OfferForm
            mode="create"
            organizations={acceptedOrganizations}
            onSubmit={handleSubmit}
            preselectedOrganization={preselectedOrganization?.original_action_hash}
          />
        </div>
      {/if}
    </section>
  </PrerequisitesGuard>
</ProfileGuard>
