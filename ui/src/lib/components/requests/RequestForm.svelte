<script lang="ts">
  import { getToastStore } from '@skeletonlabs/skeleton';
  import { InputChip } from '@skeletonlabs/skeleton';
  import type { ActionHash } from '@holochain/client';
  import type { UIRequest, UIOrganization } from '$lib/types/ui';
  import type { RequestInDHT, RequestInput, DateRange } from '$lib/types/holochain';
  import {
    type ContactPreference,
    type TimePreference,
    ContactPreferenceHelpers,
    TimePreferenceHelpers,
    ExchangePreference,
    InteractionType
  } from '$lib/types/holochain';
  import usersStore from '$lib/stores/users.store.svelte';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import { createMockedRequests } from '$lib/utils/mocks';
  import TimeZoneSelect from '$lib/components/shared/TimeZoneSelect.svelte';
  import ServiceTypeSelector from '@/lib/components/service-types/ServiceTypeSelector.svelte';

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

  // Form state
  let title = $state(request?.title ?? '');
  let description = $state(request?.description ?? '');
  let serviceTypeHashes = $state<ActionHash[]>(request?.service_type_hashes ?? []);

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

  let dateRangeStart = $state<string | null>(
    request?.date_range?.start
      ? new Date(request?.date_range.start).toISOString().split('T')[0]
      : null
  );
  let dateRangeEnd = $state<string | null>(
    request?.date_range?.end ? new Date(request?.date_range.end).toISOString().split('T')[0] : null
  );
  let timeEstimateHours = $state<number | undefined>(request?.time_estimate_hours ?? undefined);

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

  let timeZone = $state<string | undefined>(request?.time_zone ?? undefined);
  let exchangePreference = $state<ExchangePreference>(
    request?.exchange_preference ?? ExchangePreference.Exchange
  );
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

  // Load user's coordinated organizations when currentUser changes
  $effect(() => {
    async function loadCoordinatedOrganizations() {
      try {
        if (!usersStore.currentUser?.original_action_hash) {
          userCoordinatedOrganizations = [];
          isLoadingOrganizations = false;
          return;
        }

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
        userCoordinatedOrganizations = [];
      } finally {
        isLoadingOrganizations = false;
      }
    }

    loadCoordinatedOrganizations();
  });

  // Form validation
  const isValid = $derived(
    title.trim().length > 0 &&
      description.trim().length > 0 &&
      serviceTypeHashes.length > 0 &&
      contactPreferenceType !== undefined &&
      (contactPreferenceType !== 'Other' || contactPreferenceOther.trim().length > 0) &&
      timePreferenceType !== undefined &&
      (timePreferenceType !== 'Other' || timePreferenceOther.trim().length > 0) &&
      exchangePreference !== undefined &&
      interactionType !== undefined
  );

  async function mockRequest() {
    submitting = true;

    try {
      // Validate that service types are selected
      if (serviceTypeHashes.length === 0) {
        toastStore.trigger({
          message: 'Please select at least one service type before creating a mocked request',
          background: 'variant-filled-warning'
        });
        submitting = false;
        return;
      }

      const mockedRequest = (await createMockedRequests())[0];
      // Convert to RequestInput and use the selected service types
      const requestInput: RequestInput = {
        ...mockedRequest,
        service_type_hashes: [...serviceTypeHashes]
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
      contactPreferenceType = 'Email';
      contactPreferenceOther = '';
      dateRangeStart = null;
      dateRangeEnd = null;
      timeEstimateHours = undefined;
      timePreferenceType = 'NoPreference';
      timePreferenceOther = '';
      timeZone = undefined;
      exchangePreference = ExchangePreference.Exchange;
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
      // Validate service types
      if (serviceTypeHashes.length === 0) {
        serviceTypesError = 'At least one service type is required';
        submitting = false;
        return;
      }

      // Validate links if provided
      if (links.length > 0) {
        const invalidLinks = links.filter((link) => !link.trim());
        if (invalidLinks.length > 0) {
          linksError = 'Links cannot be empty';
          submitting = false;
          return;
        }
      }

      // Prepare date range if provided
      let dateRange: DateRange | undefined = undefined;
      if (dateRangeStart || dateRangeEnd) {
        dateRange = {
          start: dateRangeStart ? new Date(dateRangeStart).getTime() : null,
          end: dateRangeEnd ? new Date(dateRangeEnd).getTime() : null
        };
      }

      // Prepare contact preference
      const finalContactPreference: ContactPreference =
        contactPreferenceType === 'Other'
          ? ContactPreferenceHelpers.createOther(contactPreferenceOther)
          : contactPreferenceType;

      // Prepare time preference
      const finalTimePreference: TimePreference =
        timePreferenceType === 'Other'
          ? TimePreferenceHelpers.createOther(timePreferenceOther)
          : timePreferenceType;

      // Prepare request data
      const requestData: RequestInput = {
        title,
        description,
        contact_preference: finalContactPreference,
        date_range: dateRange,
        time_estimate_hours: timeEstimateHours,
        time_preference: finalTimePreference,
        time_zone: timeZone,
        exchange_preference: exchangePreference,
        interaction_type: interactionType,
        links: [...links],
        service_type_hashes: [...serviceTypeHashes]
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
        contactPreferenceType = 'Email';
        contactPreferenceOther = '';
        dateRangeStart = null;
        dateRangeEnd = null;
        timeEstimateHours = undefined;
        timePreferenceType = 'NoPreference';
        timePreferenceOther = '';
        timeZone = undefined;
        exchangePreference = ExchangePreference.Exchange;
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
      onSelectionChange={(selected) => (serviceTypeHashes = selected)}
      label="Service Types"
      placeholder="Search and select service types..."
      required={true}
      name="serviceTypes"
      id="request-service-types"
    />
    {#if serviceTypesError}
      <p class="text-error mt-1 text-sm">{serviceTypesError}</p>
    {/if}
  </div>

  <!-- Contact Preference -->
  <div class="space-y-2">
    <span class="label">Contact Preference <span class="text-error-500">*</span></span>
    <div class="grid grid-cols-1 gap-2 md:grid-cols-3">
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          name="contactPreference"
          value="Email"
          checked={contactPreferenceType === 'Email'}
          onclick={() => (contactPreferenceType = 'Email')}
        />
        <span>Email</span>
      </label>
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          name="contactPreference"
          value="Phone"
          checked={contactPreferenceType === 'Phone'}
          onclick={() => (contactPreferenceType = 'Phone')}
        />
        <span>Phone</span>
      </label>
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          name="contactPreference"
          value="Other"
          checked={contactPreferenceType === 'Other'}
          onclick={() => (contactPreferenceType = 'Other')}
        />
        <span>Other</span>
      </label>
    </div>
    {#if contactPreferenceType === 'Other'}
      <label class="label">
        <span>Specify other contact preference <span class="text-error-500">*</span></span>
        <input
          type="text"
          class="input"
          placeholder="e.g., Discord, Slack, etc."
          bind:value={contactPreferenceOther}
          required
        />
      </label>
    {/if}
  </div>

  <!-- Date Range -->
  <div class="space-y-2">
    <span class="label">Date Range (optional)</span>
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <label class="label">
        <span>Start Date</span>
        <input type="date" class="input" bind:value={dateRangeStart} />
      </label>
      <label class="label">
        <span>End Date</span>
        <input type="date" class="input" bind:value={dateRangeEnd} />
      </label>
    </div>
  </div>

  <!-- Time Estimate -->
  <label class="label">
    <span>Time Estimate (hours, optional)</span>
    <input
      type="number"
      class="input"
      placeholder="Estimated hours to complete"
      bind:value={timeEstimateHours}
      min="0.5"
      step="0.5"
    />
  </label>

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
  <TimeZoneSelect bind:value={timeZone} required={true} name="timezone" id="request-timezone" />

  <!-- Exchange Preference -->
  <div class="space-y-2">
    <span class="label">Medium of Exchange <span class="text-error-500">*</span></span>
    <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          name="exchangePreference"
          value={ExchangePreference.Exchange}
          checked={exchangePreference === ExchangePreference.Exchange}
          onclick={() => (exchangePreference = ExchangePreference.Exchange)}
        />
        <span>Exchange services</span>
      </label>
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          name="exchangePreference"
          value={ExchangePreference.Arranged}
          checked={exchangePreference === ExchangePreference.Arranged}
          onclick={() => (exchangePreference = ExchangePreference.Arranged)}
        />
        <span>To be arranged</span>
      </label>
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          name="exchangePreference"
          value={ExchangePreference.PayItForward}
          checked={exchangePreference === ExchangePreference.PayItForward}
          onclick={() => (exchangePreference = ExchangePreference.PayItForward)}
        />
        <span>Pay it forward</span>
      </label>
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          name="exchangePreference"
          value={ExchangePreference.Open}
          checked={exchangePreference === ExchangePreference.Open}
          onclick={() => (exchangePreference = ExchangePreference.Open)}
        />
        <span>"Hit me up"</span>
      </label>
    </div>
  </div>

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

  <!-- Organization selection (if applicable) -->
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
    {:else}
      <p class="text-sm">No organizations found</p>
    {/if}
  </label>

  <!-- Submit buttons -->
  <div class="flex justify-around">
    <button type="submit" class="btn variant-filled-primary" disabled={!isValid || submitting}>
      {#if submitting}
        <span class="spinner-icon"></span>
      {/if}
      {mode === 'create' ? 'Create Request' : 'Update Request'}
    </button>

    {#if mode === 'create'}
      <button
        type="button"
        class="btn variant-filled-tertiary"
        onclick={mockRequest}
        disabled={submitting || serviceTypeHashes.length === 0}
        title={serviceTypeHashes.length === 0 ? 'Please select service types first' : ''}
      >
        {#if submitting}
          Creating...
        {:else}
          Create Mocked Request
        {/if}
      </button>
    {/if}
  </div>
</form>
