<script lang="ts">
  import { getToastStore, getModalStore, type ModalComponent } from '@skeletonlabs/skeleton';
  import { InputChip } from '@skeletonlabs/skeleton';
  import type { ActionHash } from '@holochain/client';
  import { Effect as E } from 'effect';
  import type { UIOrganization, UIRequest } from '$lib/types/ui';
  import type { RequestInput } from '$lib/types/holochain';
  import {
    type TimePreference,
    type ContactPreference,
    TimePreferenceHelpers,
    ContactPreferenceHelpers,
    InteractionType,
    ListingStatus
  } from '$lib/types/holochain';
  import usersStore from '$lib/stores/users.store.svelte';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import { createMockedRequests } from '$lib/utils/mocks';
  import { shouldShowMockButtons } from '$lib/services/devFeatures.service';
  import TimeZoneSelect from '$lib/components/shared/TimeZoneSelect.svelte';
  import ServiceTypeSelector from '@/lib/components/service-types/ServiceTypeSelector.svelte';
  import MediumOfExchangeSelector from '@/lib/components/mediums-of-exchange/MediumOfExchangeSelector.svelte';
  import MediumOfExchangeSuggestionForm from '@/lib/components/mediums-of-exchange/MediumOfExchangeSuggestionForm.svelte';
  import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';

  type Props = {
    request?: UIRequest;
    organizations?: UIOrganization[];
    mode: 'create' | 'edit';
    onSubmit: (request: RequestInput, organizationHash?: ActionHash) => Promise<void>;
    preselectedOrganization?: ActionHash;
  };

  const { request, mode = 'create', onSubmit, preselectedOrganization }: Props = $props();

  // Toast store for notifications
  const toastStore = getToastStore();
  const modalStore = getModalStore();

  // Form state
  let title = $state(request?.title ?? '');
  let description = $state(request?.description ?? '');
  let serviceTypeHashes = $state<ActionHash[]>(request?.service_type_hashes ?? []);

  // Time preference handling
  let timePreferenceType = $state<'Morning' | 'Afternoon' | 'Evening' | 'NoPreference' | 'Other'>(
    request?.time_preference
      ? TimePreferenceHelpers.isOther(request.time_preference)
        ? 'Other'
        : (request.time_preference as 'Morning' | 'Afternoon' | 'Evening' | 'NoPreference')
      : 'NoPreference'
  );
  let timePreferenceOther = $state<string>(
    request?.time_preference && TimePreferenceHelpers.isOther(request.time_preference)
      ? TimePreferenceHelpers.getValue(request.time_preference)
      : ''
  );

  // Contact preference handling
  let contactPreferenceType = $state<'Email' | 'Phone' | 'Other'>(
    request?.contact_preference
      ? ContactPreferenceHelpers.isOther(request.contact_preference)
        ? 'Other'
        : (request.contact_preference as 'Email' | 'Phone')
      : 'Email'
  );
  let contactPreferenceOther = $state<string>(
    request?.contact_preference && ContactPreferenceHelpers.isOther(request.contact_preference)
      ? ContactPreferenceHelpers.getValue(request.contact_preference)
      : ''
  );

  let timeZone = $state<string | undefined>(request?.time_zone ?? undefined);
  let selectedMediumOfExchange = $state<ActionHash[]>(request?.medium_of_exchange_hashes ?? []);
  let interactionType = $state<InteractionType>(
    request?.interaction_type ?? InteractionType.Virtual
  );
  let links = $state<string[]>(request?.links ?? []);
  let selectedOrganizationHash = $state<ActionHash | undefined>(
    preselectedOrganization || request?.organization
  );
  let submitting = $state(false);
  let serviceTypesError = $state('');
  let linksError = $state('');
  let userCoordinatedOrganizations = $state<UIOrganization[]>([]);
  let isLoadingOrganizations = $state(true);
  let moesInitialized = $state(false);

  // Handle timezone change
  function handleTimezoneChange(value: string | undefined) {
    timeZone = value;
  }

  // Handle medium of exchange selection change
  function handleMediumOfExchangeChange(selectedHashes: ActionHash[]) {
    selectedMediumOfExchange = selectedHashes;
  }

  // Load user's coordinated organizations and MoEs immediately
  $effect(() => {
    loadCoordinatedOrganizations();
    loadMediumsOfExchange();
  });

  // Update service types and mediums of exchange when request is loaded (for edit mode)
  $effect(() => {
    if (request && mode === 'edit') {
      // Update service types and mediums of exchange from the request
      if (request.service_type_hashes) {
        serviceTypeHashes = [...request.service_type_hashes];
      }
      if (request.medium_of_exchange_hashes) {
        selectedMediumOfExchange = [...request.medium_of_exchange_hashes];
      }
    }
  });

  // Check if there are any currency-type MoEs available
  const hasCurrencyMoEs = $derived(() => {
    if (!moesInitialized) return false;
    return mediumsOfExchangeStore.approvedMediumsOfExchange.some(
      (moe) => moe.exchange_type === 'currency'
    );
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

  async function loadMediumsOfExchange() {
    if (moesInitialized) return;

    try {
      await E.runPromise(mediumsOfExchangeStore.getApprovedMediumsOfExchange());
      moesInitialized = true;
    } catch (error) {
      console.error('Error loading mediums of exchange:', error);
      // Don't prevent form usage if MoEs fail to load
      moesInitialized = true;
    }
  }

  // Form validation
  const isValid = $derived(
    title.trim().length > 0 &&
      description.trim().length > 0 &&
      serviceTypeHashes.length > 0 &&
      timePreferenceType !== undefined &&
      (timePreferenceType !== 'Other' || timePreferenceOther.trim().length > 0) &&
      contactPreferenceType !== undefined &&
      (contactPreferenceType !== 'Other' || contactPreferenceOther.trim().length > 0) &&
      timeZone !== undefined &&
      interactionType !== undefined
  );

  async function mockRequest() {
    submitting = true;

    try {
      // For mocked data, auto-create service types if none are selected
      let finalServiceTypeHashes = [...serviceTypeHashes];
      if (finalServiceTypeHashes.length === 0) {
        toastStore.trigger({
          message: 'Auto-generating service type for mocked request',
          background: 'variant-filled-info'
        });
      }

      const mockedRequest = (await createMockedRequests())[0];
      // Convert to RequestInput and use the selected service types
      const requestInput: RequestInput = {
        ...mockedRequest,
        service_type_hashes: finalServiceTypeHashes,
        medium_of_exchange_hashes: [...selectedMediumOfExchange]
      };
      await onSubmit(requestInput, selectedOrganizationHash);

      toastStore.trigger({
        message: 'Mocked request created successfully',
        background: 'variant-filled-success'
      });

      // Reset form
      title = '';
      description = '';
      serviceTypeHashes = [];
      timePreferenceType = 'NoPreference';
      timePreferenceOther = '';
      contactPreferenceType = 'Email';
      contactPreferenceOther = '';
      timeZone = undefined;
      selectedMediumOfExchange = [];
      interactionType = InteractionType.Virtual;
      links = [];
      selectedOrganizationHash = undefined;
    } catch (error) {
      toastStore.trigger({
        message: `Error creating mocked request: ${error}`,
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

      // Prepare contact preference
      const finalContactPreference: ContactPreference =
        contactPreferenceType === 'Other'
          ? ContactPreferenceHelpers.createOther(contactPreferenceOther)
          : contactPreferenceType;

      const requestData: RequestInput = {
        title: title.trim(),
        description: description.trim(),
        contact_preference: finalContactPreference,
        time_preference: finalTimePreference,
        time_zone: timeZone,
        interaction_type: interactionType,
        links: [...links],
        service_type_hashes: [...serviceTypeHashes],
        medium_of_exchange_hashes: [...selectedMediumOfExchange],
        status: ListingStatus.Active
      };

      await onSubmit(requestData, selectedOrganizationHash);

      toastStore.trigger({
        message: `Request ${mode === 'create' ? 'created' : 'updated'} successfully`,
        background: 'variant-filled-success'
      });

      // Reset form if creating
      if (mode === 'create') {
        title = '';
        description = '';
        serviceTypeHashes = [];
        timePreferenceType = 'NoPreference';
        timePreferenceOther = '';
        contactPreferenceType = 'Email';
        contactPreferenceOther = '';
        timeZone = undefined;
        selectedMediumOfExchange = [];
        interactionType = InteractionType.Virtual;
        links = [];
        selectedOrganizationHash = undefined;
      }
    } catch (error) {
      toastStore.trigger({
        message: `Error ${mode === 'create' ? 'creating' : 'updating'} request: ${error}`,
        background: 'variant-filled-error'
      });
    } finally {
      submitting = false;
    }
  }

  // Function to open the suggest medium of exchange modal
  function openSuggestMediumModal() {
    const modalComponent: ModalComponent = {
      ref: MediumOfExchangeSuggestionForm,
      props: {
        onSubmitSuccess: () => {
          modalStore.close();
          toastStore.trigger({
            message: 'Thank you for your suggestion! It will be reviewed by administrators.',
            background: 'variant-filled-success'
          });
        },
        onCancel: () => {
          modalStore.close();
        }
      }
    };

    modalStore.trigger({
      type: 'component',
      component: modalComponent,
      title: 'Suggest New Medium of Exchange'
    });
  }
</script>

<form class="space-y-4" onsubmit={handleSubmit}>
  <!-- Title -->
  <label class="label">
    <span>Title <span class="text-error-500">*</span></span>
    <input
      type="text"
      class="input"
      placeholder="Enter request title"
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
      placeholder="Describe your request in detail"
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
      onSelectionChange={(newSelection) => {
        serviceTypeHashes = newSelection;
      }}
      label="Service Types"
      placeholder="Search and select service types..."
      required
      name="serviceTypes"
      id="request-service-types"
    />
    {#if serviceTypesError}
      <p class="text-sm text-error-500">{serviceTypesError}</p>
    {/if}
  </div>

  <!-- Medium of Exchange Section -->
  <div class="card variant-ghost-surface p-4">
    <div class="mb-2 flex items-center justify-between">
      <h3 class="h3">{hasCurrencyMoEs() ? 'Additional Currencies' : 'Medium of Exchange'}</h3>
      <button
        type="button"
        class="variant-ghost-primary btn btn-sm"
        onclick={openSuggestMediumModal}
        title="Suggest a new medium of exchange for administrator review"
      >
        💡 Suggest New
      </button>
    </div>
    <MediumOfExchangeSelector
      selectedMediums={selectedMediumOfExchange}
      onSelectionChange={handleMediumOfExchangeChange}
      label={hasCurrencyMoEs() ? 'Additional Currencies' : 'Medium of Exchange'}
      placeholder="Select how you'd like to be compensated..."
      required={false}
      name="mediumOfExchange"
      id="request-medium-of-exchange"
      mode="multiple"
    />
  </div>

  <div class="grid grid-cols-1 gap-4">
    <!-- Interaction Type -->
    <div class="card variant-ghost-surface p-4">
      <h3 class="h3 mb-2">Interaction Type <span class="text-error-500">*</span></h3>
      <div class="flex flex-col space-y-2">
        <label class="flex items-center space-x-2">
          <input
            type="radio"
            class="radio"
            name="interactionType"
            value={InteractionType.Virtual}
            bind:group={interactionType}
          />
          <span>Virtual</span>
        </label>
        <label class="flex items-center space-x-2">
          <input
            type="radio"
            class="radio"
            name="interactionType"
            value={InteractionType.InPerson}
            bind:group={interactionType}
          />
          <span>In-Person</span>
        </label>
      </div>
    </div>
  </div>

  <!-- Time and Contact Preferences -->
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <!-- Time Preference -->
    <div class="card variant-ghost-surface p-4">
      <h3 class="h3 mb-2">Time Preference <span class="text-error-500">*</span></h3>
      <div class="flex flex-col space-y-2">
        <label class="flex items-center space-x-2">
          <input
            type="radio"
            class="radio"
            name="timePreference"
            value="Morning"
            bind:group={timePreferenceType}
          />
          <span>Morning</span>
        </label>
        <label class="flex items-center space-x-2">
          <input
            type="radio"
            class="radio"
            name="timePreference"
            value="Afternoon"
            bind:group={timePreferenceType}
          />
          <span>Afternoon</span>
        </label>
        <label class="flex items-center space-x-2">
          <input
            type="radio"
            class="radio"
            name="timePreference"
            value="Evening"
            bind:group={timePreferenceType}
          />
          <span>Evening</span>
        </label>
        <label class="flex items-center space-x-2">
          <input
            type="radio"
            class="radio"
            name="timePreference"
            value="NoPreference"
            bind:group={timePreferenceType}
          />
          <span>No Preference</span>
        </label>
        <label class="flex items-center space-x-2">
          <input
            type="radio"
            class="radio"
            name="timePreference"
            value="Other"
            bind:group={timePreferenceType}
          />
          <span>Other</span>
        </label>
        {#if timePreferenceType === 'Other'}
          <input
            type="text"
            class="input mt-2"
            placeholder="Specify time preference..."
            bind:value={timePreferenceOther}
            required
          />
        {/if}
      </div>
    </div>

    <!-- Contact Preference -->
    <div class="card variant-ghost-surface p-4">
      <h3 class="h3 mb-2">Contact Preference <span class="text-error-500">*</span></h3>
      <div class="flex flex-col space-y-2">
        <label class="flex items-center space-x-2">
          <input
            type="radio"
            class="radio"
            name="contactPreference"
            value="Email"
            bind:group={contactPreferenceType}
          />
          <span>Email</span>
        </label>
        <label class="flex items-center space-x-2">
          <input
            type="radio"
            class="radio"
            name="contactPreference"
            value="Phone"
            bind:group={contactPreferenceType}
          />
          <span>Phone</span>
        </label>
        <label class="flex items-center space-x-2">
          <input
            type="radio"
            class="radio"
            name="contactPreference"
            value="Other"
            bind:group={contactPreferenceType}
          />
          <span>Other</span>
        </label>
        {#if contactPreferenceType === 'Other'}
          <input
            type="text"
            class="input mt-2"
            placeholder="Specify contact preference..."
            bind:value={contactPreferenceOther}
            required
          />
        {/if}
      </div>
    </div>
  </div>

  <!-- Time Zone -->
  <TimeZoneSelect value={timeZone} onchange={handleTimezoneChange} required />

  <!-- Links -->
  <label class="label">
    <span>Links (optional)</span>
    <InputChip bind:value={links} name="links" placeholder="Add links (press Enter to add)" />
    {#if linksError}
      <p class="text-sm text-error-500">{linksError}</p>
    {/if}
  </label>

  <!-- Organization -->
  <div class="flex flex-col">
    <label class="label">
      <span>Organization (optional)</span>
      {#if isLoadingOrganizations}
        <div class="flex items-center gap-2">
          <span class="loading loading-spinner loading-sm"></span>
          <span class="text-sm">Loading organizations...</span>
        </div>
      {:else if userCoordinatedOrganizations && userCoordinatedOrganizations.length > 0}
        <select class="select" bind:value={selectedOrganizationHash}>
          <option value={undefined}>No organization</option>
          {#each userCoordinatedOrganizations as org}
            <option value={org.original_action_hash}>
              {org.name}
            </option>
          {/each}
        </select>
      {:else}
        <p class="text-sm text-surface-500">
          No organizations available. Only organization coordinators can create requests for
          organizations.
        </p>
      {/if}
    </label>
  </div>

  <!-- Submit Button -->
  <div class="flex gap-4">
    <button type="submit" class="variant-filled-primary btn" disabled={!isValid || submitting}>
      {#if submitting}
        <span class="loading loading-spinner loading-sm"></span>
      {/if}
      {mode === 'create' ? 'Create Request' : 'Update Request'}
    </button>

    {#if mode === 'create' && shouldShowMockButtons()}
      <button
        type="button"
        class="variant-soft-secondary btn"
        onclick={mockRequest}
        disabled={submitting}
      >
        {#if submitting}
          <span class="loading loading-spinner loading-sm"></span>
        {/if}
        Create Mock Request
      </button>
    {/if}
  </div>
</form>
