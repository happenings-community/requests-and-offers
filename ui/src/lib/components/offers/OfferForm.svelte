<script lang="ts">
  import { getToastStore } from '@skeletonlabs/skeleton';
  import { InputChip } from '@skeletonlabs/skeleton';
  import type { ActionHash } from '@holochain/client';
  import { Effect as E } from 'effect';
  import type { UIOrganization, UIOffer } from '$lib/types/ui';
  import type { OfferInDHT, OfferInput } from '$lib/types/holochain';
  import {
    type TimePreference,
    TimePreferenceHelpers,
    InteractionType
  } from '$lib/types/holochain';
  import usersStore from '$lib/stores/users.store.svelte';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import { createMockedOffers } from '$lib/utils/mocks';
  import TimeZoneSelect from '$lib/components/shared/TimeZoneSelect.svelte';
  import ServiceTypeSelector from '@/lib/components/service-types/ServiceTypeSelector.svelte';
  import MediumOfExchangeSelector from '@/lib/components/mediums-of-exchange/MediumOfExchangeSelector.svelte';

  type Props = {
    offer?: UIOffer;
    organizations?: UIOrganization[];
    mode: 'create' | 'edit';
    onSubmit: (offer: OfferInput, organizationHash?: ActionHash) => Promise<void>;
    preselectedOrganization?: ActionHash;
  };

  const { offer, mode = 'create', onSubmit, preselectedOrganization }: Props = $props();

  // Toast store for notifications
  const toastStore = getToastStore();

  // Form state
  let title = $state(offer?.title ?? '');
  let description = $state(offer?.description ?? '');
  let serviceTypeHashes = $state<ActionHash[]>(offer?.service_type_hashes ?? []);

  // Time preference handling
  let timePreferenceType = $state<'Morning' | 'Afternoon' | 'Evening' | 'NoPreference' | 'Other'>(
    offer?.time_preference
      ? TimePreferenceHelpers.isOther(offer.time_preference)
        ? 'Other'
        : (offer.time_preference as 'Morning' | 'Afternoon' | 'Evening' | 'NoPreference')
      : 'NoPreference'
  );
  let timePreferenceOther = $state<string>(
    offer?.time_preference && TimePreferenceHelpers.isOther(offer.time_preference)
      ? TimePreferenceHelpers.getValue(offer.time_preference)
      : ''
  );

  let timeZone = $state<string | undefined>(offer?.time_zone ?? undefined);
  let selectedMediumOfExchange = $state<ActionHash[]>(offer?.medium_of_exchange_hashes ?? []);
  let interactionType = $state<InteractionType>(offer?.interaction_type ?? InteractionType.Virtual);
  let links = $state<string[]>(offer?.links ?? []);
  let selectedOrganizationHash = $state<ActionHash | undefined>(
    preselectedOrganization || offer?.organization
  );
  let submitting = $state(false);
  let serviceTypesError = $state('');
  let linksError = $state('');
  let userCoordinatedOrganizations = $state<UIOrganization[]>([]);
  let isLoadingOrganizations = $state(true);

  // Handle timezone change
  function handleTimezoneChange(value: string | undefined) {
    timeZone = value;
  }

  // Handle medium of exchange selection change
  function handleMediumOfExchangeChange(selectedHashes: ActionHash[]) {
    selectedMediumOfExchange = selectedHashes;
  }

  // Load user's coordinated organizations immediately
  $effect(() => {
    loadCoordinatedOrganizations();
  });

  async function loadCoordinatedOrganizations() {
    try {
      if (!usersStore.currentUser?.original_action_hash) return;

      isLoadingOrganizations = true;
      userCoordinatedOrganizations = await E.runPromise(
        organizationsStore.getUserOrganizations(usersStore.currentUser.original_action_hash)
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
    title.trim().length > 0 &&
      description.trim().length > 0 &&
      serviceTypeHashes.length > 0 &&
      timePreferenceType !== undefined &&
      (timePreferenceType !== 'Other' || timePreferenceOther.trim().length > 0) &&
      timeZone !== undefined &&
      interactionType !== undefined
  );

  async function mockOffer() {
    submitting = true;

    try {
      // Validate that service types are selected
      if (serviceTypeHashes.length === 0) {
        toastStore.trigger({
          message: 'Please select at least one service type before creating a mocked offer',
          background: 'variant-filled-warning'
        });
        submitting = false;
        return;
      }

      const mockedOffer = (await createMockedOffers())[0];
      // Convert to OfferInput and use the selected service types
      const offerInput: OfferInput = {
        ...mockedOffer,
        service_type_hashes: [...serviceTypeHashes],
        medium_of_exchange_hashes: [...selectedMediumOfExchange]
      };
      await onSubmit(offerInput, selectedOrganizationHash);

      toastStore.trigger({
        message: 'Mocked offer created successfully',
        background: 'variant-filled-success'
      });

      // Reset form
      title = '';
      description = '';
      serviceTypeHashes = [];
      timePreferenceType = 'NoPreference';
      timePreferenceOther = '';
      timeZone = undefined;
      selectedMediumOfExchange = [];
      interactionType = InteractionType.Virtual;
      links = [];
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
      // Validate service types before submission
      if (serviceTypeHashes.length === 0) {
        serviceTypesError = 'At least one service type is required';
        submitting = false;
        return;
      }

      // Validate links before submission
      if (links.some((link) => !link.trim())) {
        linksError = 'Links cannot be empty';
        submitting = false;
        return;
      }

      // Prepare time preference
      const finalTimePreference: TimePreference =
        timePreferenceType === 'Other'
          ? TimePreferenceHelpers.createOther(timePreferenceOther)
          : timePreferenceType;

      const offerData: OfferInput = {
        title: title.trim(),
        description: description.trim(),
        time_preference: finalTimePreference,
        time_zone: timeZone,
        interaction_type: interactionType,
        links: [...links],
        service_type_hashes: [...serviceTypeHashes],
        medium_of_exchange_hashes: [...selectedMediumOfExchange]
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
        serviceTypeHashes = [];
        timePreferenceType = 'NoPreference';
        timePreferenceOther = '';
        timeZone = undefined;
        selectedMediumOfExchange = [];
        interactionType = InteractionType.Virtual;
        links = [];
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
    <span
      >Description <span class="text-error-500">*</span>
      <span class="text-sm">({description.length}/500 characters)</span></span
    >
    <textarea
      class="textarea"
      placeholder="Describe your offer in detail"
      rows="4"
      bind:value={description}
      maxlength="500"
      required
    ></textarea>
  </label>

  <!-- Service Types -->
  <div class="space-y-2">
    <ServiceTypeSelector
      selectedServiceTypes={serviceTypeHashes}
      onSelectionChange={(selected) => (serviceTypeHashes = selected)}
      label="Service Types"
      placeholder="Search and select service types..."
      required={true}
      name="serviceTypes"
      id="offer-service-types"
    />
    {#if serviceTypesError}
      <p class="text-error mt-1 text-sm">{serviceTypesError}</p>
    {/if}
  </div>

  <!-- Time Preference -->
  <div class="space-y-2">
    <span class="label">Time Preference <span class="text-error-500">*</span></span>
    <div class="grid grid-cols-1 gap-2 md:grid-cols-3">
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          name="timePreference"
          value="Morning"
          checked={timePreferenceType === 'Morning'}
          onclick={() => (timePreferenceType = 'Morning')}
        />
        <span>Morning</span>
      </label>
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          name="timePreference"
          value="Afternoon"
          checked={timePreferenceType === 'Afternoon'}
          onclick={() => (timePreferenceType = 'Afternoon')}
        />
        <span>Afternoon</span>
      </label>
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          name="timePreference"
          value="Evening"
          checked={timePreferenceType === 'Evening'}
          onclick={() => (timePreferenceType = 'Evening')}
        />
        <span>Evening</span>
      </label>
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          name="timePreference"
          value="NoPreference"
          checked={timePreferenceType === 'NoPreference'}
          onclick={() => (timePreferenceType = 'NoPreference')}
        />
        <span>No Preference</span>
      </label>
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          name="timePreference"
          value="Other"
          checked={timePreferenceType === 'Other'}
          onclick={() => (timePreferenceType = 'Other')}
        />
        <span>Other</span>
      </label>
    </div>
    {#if timePreferenceType === 'Other'}
      <label class="label">
        <span>Specify other time preference <span class="text-error-500">*</span></span>
        <input
          type="text"
          class="input"
          placeholder="e.g., Weekends only, Late night, etc."
          bind:value={timePreferenceOther}
          required
        />
      </label>
    {/if}
  </div>

  <!-- Time Zone -->
  <TimeZoneSelect
    bind:value={timeZone}
    required={true}
    name="timezone"
    id="offer-timezone"
    onchange={handleTimezoneChange}
  />

  <!-- Medium of Exchange -->
  <MediumOfExchangeSelector
    selectedMediums={selectedMediumOfExchange}
    onSelectionChange={handleMediumOfExchangeChange}
    label="Medium of Exchange"
    placeholder="Select how you'd like to be compensated..."
    required={false}
    name="mediumOfExchange"
    id="offer-medium-of-exchange"
    mode="single"
  />

  <!-- Interaction Type -->
  <div class="space-y-2">
    <span class="label">Interaction Type <span class="text-error-500">*</span></span>
    <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          name="interactionType"
          value={InteractionType.Virtual}
          checked={interactionType === InteractionType.Virtual}
          onclick={() => (interactionType = InteractionType.Virtual)}
        />
        <span>Virtual</span>
      </label>
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          name="interactionType"
          value={InteractionType.InPerson}
          checked={interactionType === InteractionType.InPerson}
          onclick={() => (interactionType = InteractionType.InPerson)}
        />
        <span>In-Person</span>
      </label>
    </div>
  </div>

  <!-- Links -->
  <label class="label">
    <span>Links (optional)</span>
    <InputChip
      bind:value={links}
      name="links"
      placeholder="Add links (press Enter to add)"
      validation={(link) => link.trim().length > 0}
    />
    {#if linksError}
      <p class="text-error mt-1 text-sm">{linksError}</p>
    {/if}
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
    <button type="submit" class="variant-filled-primary btn" disabled={!isValid || submitting}>
      {#if submitting}
        <span class="spinner-icon"></span>
      {/if}
      {mode === 'create' ? 'Create Offer' : 'Update Offer'}
    </button>

    {#if mode === 'create'}
      <button
        type="button"
        class="variant-filled-tertiary btn"
        onclick={mockOffer}
        disabled={submitting || serviceTypeHashes.length === 0}
        title={serviceTypeHashes.length === 0 ? 'Please select service types first' : ''}
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
