<script lang="ts">
  import { InputChip } from '@skeletonlabs/skeleton';
  import type { ActionHash } from '@holochain/client';
  import type { UIRequest, UIOrganization } from '$lib/types/ui';
  import type { RequestInput, DateRange } from '$lib/types/holochain';
  import {
    type ContactPreference,
    type TimePreference,
    ContactPreferenceHelpers,
    TimePreferenceHelpers,
    ExchangePreference,
    InteractionType
  } from '$lib/types/holochain';
  import { useRequestFormManagement } from '$lib/composables/domain/useRequestFormManagement.svelte';
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

  // Initialize the request form management composable
  const requestManagement = useRequestFormManagement({
    initialValues: request
      ? {
          title: request.title,
          description: request.description,
          service_type_hashes: request.service_type_hashes,
          contact_preference: request.contact_preference,
          exchange_preference: request.exchange_preference,
          interaction_type: request.interaction_type,
          links: request.links
        }
      : {},
    autoLoadOrganizations: true,
    onSubmitSuccess: (createdRequest) => {
      console.log('Request created successfully:', createdRequest);
    },
    onSubmitError: (error) => {
      console.error('Request submission error:', error);
    }
  });

  // Set preselected organization if provided
  $effect(() => {
    if (preselectedOrganization) {
      requestManagement.setSelectedOrganization(preselectedOrganization);
    } else if (request?.organization) {
      requestManagement.setSelectedOrganization(request.organization);
    }
  });

  // Extended form state for fields not covered by the basic composable
  let dateRangeStart = $state<string | null>(
    request?.date_range?.start
      ? new Date(request?.date_range.start).toISOString().split('T')[0]
      : null
  );
  let dateRangeEnd = $state<string | null>(
    request?.date_range?.end ? new Date(request?.date_range.end).toISOString().split('T')[0] : null
  );
  let timeEstimateHours = $state<number | undefined>(request?.time_estimate_hours ?? undefined);

  // Contact preference UI state
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

  // Time preference UI state
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
  let serviceTypesError = $state('');
  let linksError = $state('');

  // Update composable when UI form fields change
  $effect(() => {
    const contactPref: ContactPreference =
      contactPreferenceType === 'Other'
        ? ContactPreferenceHelpers.createOther(contactPreferenceOther)
        : contactPreferenceType;
    requestManagement.setContactPreference(contactPref);
  });

  // Form validation that includes the extended fields
  const isValid = $derived(
    requestManagement.title.trim().length > 0 &&
      requestManagement.description.trim().length > 0 &&
      requestManagement.serviceTypeHashes.length > 0 &&
      contactPreferenceType !== undefined &&
      (contactPreferenceType !== 'Other' || contactPreferenceOther.trim().length > 0) &&
      timePreferenceType !== undefined &&
      (timePreferenceType !== 'Other' || timePreferenceOther.trim().length > 0) &&
      requestManagement.exchangePreference !== undefined &&
      requestManagement.interactionType !== undefined
  );

  async function mockRequest() {
    // Use the composable's mock request functionality
    const result = await requestManagement.createMockRequest();

    if (result) {
      // Reset extended form fields
      dateRangeStart = null;
      dateRangeEnd = null;
      timeEstimateHours = undefined;
      contactPreferenceType = 'Email';
      contactPreferenceOther = '';
      timePreferenceType = 'NoPreference';
      timePreferenceOther = '';
      timeZone = undefined;
    }
  }

  // Handle form submission
  async function handleSubmit(event: Event) {
    event.preventDefault();

    if (!isValid) {
      return;
    }

    // Validate links if provided
    if (requestManagement.links.length > 0) {
      const invalidLinks = requestManagement.links.filter((link) => !link.trim());
      if (invalidLinks.length > 0) {
        linksError = 'Links cannot be empty';
        return;
      }
    } else {
      linksError = '';
    }

    // Prepare date range if provided
    let dateRange: DateRange | undefined = undefined;
    if (dateRangeStart || dateRangeEnd) {
      dateRange = {
        start: dateRangeStart ? new Date(dateRangeStart).getTime() : null,
        end: dateRangeEnd ? new Date(dateRangeEnd).getTime() : null
      };
    }

    // Prepare time preference
    const finalTimePreference: TimePreference =
      timePreferenceType === 'Other'
        ? TimePreferenceHelpers.createOther(timePreferenceOther)
        : timePreferenceType;

    // Prepare request data with all fields including extended ones not in composable
    const requestData: RequestInput = {
      title: requestManagement.title,
      description: requestManagement.description,
      contact_preference: requestManagement.contactPreference,
      date_range: dateRange,
      time_estimate_hours: timeEstimateHours,
      time_preference: finalTimePreference,
      time_zone: timeZone,
      exchange_preference: requestManagement.exchangePreference,
      interaction_type: requestManagement.interactionType,
      links: [...requestManagement.links],
      service_type_hashes: [...requestManagement.serviceTypeHashes]
    };

    try {
      await onSubmit(requestData, requestManagement.selectedOrganizationHash);

      // Reset extended form fields if creating
      if (mode === 'create') {
        requestManagement.resetForm();
        dateRangeStart = null;
        dateRangeEnd = null;
        timeEstimateHours = undefined;
        contactPreferenceType = 'Email';
        contactPreferenceOther = '';
        timePreferenceType = 'NoPreference';
        timePreferenceOther = '';
        timeZone = undefined;
      }
    } catch (error) {
      // Error handling is done through the composable and onSubmit callback
      console.error('Form submission error:', error);
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
      bind:value={requestManagement.title}
      required
    />
  </label>

  <!-- Description -->
  <label class="label">
    <span
      >Description <span class="text-error-500">*</span>
      <span class="text-sm">({requestManagement.description.length}/500 characters)</span></span
    >
    <textarea
      class="textarea"
      placeholder="Describe your request in detail"
      rows="4"
      bind:value={requestManagement.description}
      maxlength="500"
      required
    ></textarea>
  </label>

  <!-- Service Types -->
  <div class="space-y-2">
    <ServiceTypeSelector
      selectedServiceTypes={requestManagement.serviceTypeHashes}
      onSelectionChange={requestManagement.setServiceTypeHashes}
      label="Service Types"
      placeholder="Search and select service types..."
      required
      name="serviceTypes"
      id="request-service-types"
      enableTagFiltering
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
          checked={requestManagement.exchangePreference === ExchangePreference.Exchange}
          onclick={() => requestManagement.setExchangePreference(ExchangePreference.Exchange)}
        />
        <span>Exchange services</span>
      </label>
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          name="exchangePreference"
          value={ExchangePreference.Arranged}
          checked={requestManagement.exchangePreference === ExchangePreference.Arranged}
          onclick={() => requestManagement.setExchangePreference(ExchangePreference.Arranged)}
        />
        <span>Currency (To be arranged)</span>
      </label>
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          name="exchangePreference"
          value={ExchangePreference.PayItForward}
          checked={requestManagement.exchangePreference === ExchangePreference.PayItForward}
          onclick={() => requestManagement.setExchangePreference(ExchangePreference.PayItForward)}
        />
        <span>Pay it forward</span>
      </label>
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          name="exchangePreference"
          value={ExchangePreference.Open}
          checked={requestManagement.exchangePreference === ExchangePreference.Open}
          onclick={() => requestManagement.setExchangePreference(ExchangePreference.Open)}
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
          checked={requestManagement.interactionType === InteractionType.Virtual}
          onclick={() => requestManagement.setInteractionType(InteractionType.Virtual)}
        />
        <span>Virtual</span>
      </label>
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          name="interactionType"
          value={InteractionType.InPerson}
          checked={requestManagement.interactionType === InteractionType.InPerson}
          onclick={() => requestManagement.setInteractionType(InteractionType.InPerson)}
        />
        <span>In-Person</span>
      </label>
    </div>
  </div>

  <!-- Links -->
  <label class="label">
    <span>Links (optional)</span>
    <InputChip
      bind:value={requestManagement.links}
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
    {#if requestManagement.isLoadingOrganizations}
      <div class="flex items-center gap-2">
        <span class="loading loading-spinner loading-sm"></span>
        <span class="text-sm">Loading organizations...</span>
      </div>
    {:else if requestManagement.userCoordinatedOrganizations.length > 0}
      <select class="select" bind:value={requestManagement.selectedOrganizationHash}>
        <option value={undefined}>No organization</option>
        {#each requestManagement.userCoordinatedOrganizations as org}
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
    <button
      type="submit"
      class="btn variant-filled-primary"
      disabled={!isValid || requestManagement.isSubmitting}
    >
      {#if requestManagement.isSubmitting}
        <span class="spinner-icon"></span>
      {/if}
      {mode === 'create' ? 'Create Request' : 'Update Request'}
    </button>

    {#if mode === 'create'}
      <button
        type="button"
        class="btn variant-filled-tertiary"
        onclick={mockRequest}
        disabled={requestManagement.isSubmitting ||
          requestManagement.serviceTypeHashes.length === 0}
        title={requestManagement.serviceTypeHashes.length === 0
          ? 'Please select service types first'
          : ''}
      >
        {#if requestManagement.isSubmitting}
          Creating...
        {:else}
          Create Mocked Request
        {/if}
      </button>
    {/if}
  </div>
</form>
