<script lang="ts">
  import { getToastStore } from '@skeletonlabs/skeleton';
  import { InputChip } from '@skeletonlabs/skeleton';
  import type { ActionHash } from '@holochain/client';
  import type { UIOrganization, UIOffer } from '@lib/types/ui';
  import type { OfferInDHT } from '@lib/types/holochain';
  import usersStore from '@stores/users.store.svelte';
  import organizationsStore from '@stores/organizations.store.svelte';
  import { createMockedOffers } from '@utils/mocks';

  type Props = {
    offer?: UIOffer;
    organizations?: UIOrganization[];
    mode: 'create' | 'edit';
    onSubmit: (offer: OfferInDHT, organizationHash?: ActionHash) => Promise<void>;
    preselectedOrganization?: ActionHash;
  };

  const { offer, mode = 'create', onSubmit, preselectedOrganization }: Props = $props();

  // Toast store for notifications
  const toastStore = getToastStore();

  // Form state
  let title = $state(offer?.title ?? '');
  let description = $state(offer?.description ?? '');
  let capabilities = $state<string[]>(offer?.capabilities ?? []);
  let availability = $state(offer?.availability ?? '');
  let selectedOrganizationHash = $state<ActionHash | undefined>(
    preselectedOrganization || offer?.organization
  );
  let submitting = $state(false);
  let capabilitiesError = $state('');
  let userCoordinatedOrganizations = $state<UIOrganization[]>([]);
  let isLoadingOrganizations = $state(true);

  // Load user's coordinated organizations immediately
  $effect(() => {
    loadCoordinatedOrganizations();
  });

  async function loadCoordinatedOrganizations() {
    try {
      if (!usersStore.currentUser?.original_action_hash) return;

      isLoadingOrganizations = true;
      userCoordinatedOrganizations = await organizationsStore.getUserCoordinatedOrganizations(
        usersStore.currentUser.original_action_hash
      );
      // Filter to only keep accepted organizations
      userCoordinatedOrganizations = userCoordinatedOrganizations.filter(
        (org) => org.status?.status_type === 'accepted'
      );
    } catch (error) {
      console.error('Error loading coordinated organizations:', error);
    } finally {
      isLoadingOrganizations = false;
    }
  }

  // Form validation
  const isValid = $derived(
    title.trim().length > 0 && description.trim().length > 0 && capabilities.length > 0
  );

  async function mockOffer() {
    submitting = true;

    try {
      const mockedOffer = (await createMockedOffers())[0];
      await onSubmit(mockedOffer, selectedOrganizationHash);

      toastStore.trigger({
        message: 'Mocked offer created successfully',
        background: 'variant-filled-success'
      });

      // Reset form
      title = '';
      description = '';
      capabilities = [];
      availability = '';
      selectedOrganizationHash = undefined;
    } catch (error) {
      toastStore.trigger({
        message: `Error creating mocked offer: ${error}`,
        background: 'variant-filled-error'
      });
    } finally {
      submitting = false;
    }
  }

  // Handle form submission
  async function handleSubmit(event: Event) {
    event.preventDefault();

    if (!isValid) {
      toastStore.trigger({
        message: 'Please fill in all required fields',
        background: 'variant-filled-error'
      });
      return;
    }

    submitting = true;

    try {
      // Validate capabilities before submission
      if (capabilities.length === 0) {
        capabilitiesError = 'At least one capability is required';
        submitting = false;
        return;
      }

      const offerData: OfferInDHT = {
        title: title.trim(),
        description: description.trim(),
        capabilities: [...capabilities],
        availability: availability.trim() || undefined
      };

      await onSubmit(offerData, selectedOrganizationHash);

      toastStore.trigger({
        message: `Offer ${mode === 'create' ? 'created' : 'updated'} successfully`,
        background: 'variant-filled-success'
      });

      // Reset form if creating
      if (mode === 'create') {
        title = '';
        description = '';
        capabilities = [];
        availability = '';
        selectedOrganizationHash = undefined;
      }
    } catch (error) {
      toastStore.trigger({
        message: `Error ${mode === 'create' ? 'creating' : 'updating'} offer: ${error}`,
        background: 'variant-filled-error'
      });
    } finally {
      submitting = false;
    }
  }
</script>

<form class="space-y-4" onsubmit={handleSubmit}>
  <!-- Title -->
  <label class="label">
    <span>Title <span class="text-error-500">*</span></span>
    <input
      type="text"
      class="input"
      placeholder="What are you offering?"
      bind:value={title}
      required
    />
  </label>

  <!-- Description -->
  <label class="label">
    <span>Description <span class="text-error-500">*</span></span>
    <textarea
      class="textarea"
      placeholder="Describe your offer in detail"
      rows="4"
      bind:value={description}
      required
    ></textarea>
  </label>

  <!-- Capabilities -->
  <label class="label">
    <span
      >Capabilities <span class="text-error-500">*</span> (at least one capability is required)</span
    >
    <InputChip
      bind:value={capabilities}
      name="capabilities"
      placeholder="Add capabilities (press Enter to add)"
      validation={(chip) => chip.trim().length > 0}
    />
    {#if capabilitiesError}
      <p class="text-error mt-1 text-sm">{capabilitiesError}</p>
    {/if}
  </label>

  <!-- Availability -->
  <label class="label">
    <span>Availability (optional)</span>
    <input
      type="text"
      class="input"
      placeholder="When are you available?"
      bind:value={availability}
    />
  </label>

  <!-- Organization selection -->
  <label class="label">
    <span>Organization (optional)</span>
    {#if isLoadingOrganizations}
      <div class="flex items-center gap-2">
        <span class="loading loading-spinner loading-sm"></span>
        <span class="text-sm">Loading organizations...</span>
      </div>
    {:else if userCoordinatedOrganizations.length > 0}
      <select class="select" bind:value={selectedOrganizationHash}>
        <option value={undefined}>No organization</option>
        {#each userCoordinatedOrganizations as org}
          <option value={org.original_action_hash}>
            {org.name}
          </option>
        {/each}
      </select>
    {/if}
  </label>

  <!-- Submit buttons -->
  <div class="flex justify-around">
    <button type="submit" class="btn variant-filled-primary" disabled={!isValid || submitting}>
      {#if submitting}
        <span class="spinner-icon"></span>
      {/if}
      {mode === 'create' ? 'Create Offer' : 'Update Offer'}
    </button>

    {#if mode === 'create'}
      <button
        type="button"
        class="btn variant-filled-tertiary"
        onclick={mockOffer}
        disabled={submitting}
      >
        {#if submitting}
          Creating...
        {:else}
          Create Mocked Offer
        {/if}
      </button>
    {/if}
  </div>
</form>
