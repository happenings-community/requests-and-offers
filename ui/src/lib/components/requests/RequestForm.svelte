<script lang="ts">
  import { getToastStore } from '@skeletonlabs/skeleton';
  import { InputChip } from '@skeletonlabs/skeleton';
  import type { ActionHash } from '@holochain/client';
  import type { UIRequest, UIOrganization } from '$lib/types/ui';
  import type { RequestInDHT, DateRange } from '$lib/types/holochain';
  import {
    ContactPreference,
    TimePreference,
    ExchangePreference,
    InteractionType
  } from '$lib/types/holochain';
  import usersStore from '$lib/stores/users.store.svelte';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import { createMockedRequests } from '$lib/utils/mocks';
  import TimeZoneSelect from '$lib/components/shared/TimeZoneSelect.svelte';

  type Props = {
    request?: UIRequest;
    organizations?: UIOrganization[];
    mode: 'create' | 'edit';
    onSubmit: (request: RequestInDHT, organizationHash?: ActionHash) => Promise<void>;
    preselectedOrganization?: ActionHash;
  };

  const { request, mode = 'create', onSubmit, preselectedOrganization }: Props = $props();

  // Toast store for notifications
  const toastStore = getToastStore();

  // Form state
  let title = $state(request?.title ?? '');
  let description = $state(request?.description ?? '');
  let requirements = $state<string[]>(request?.requirements ?? []);
  let contactPreference = $state<ContactPreference>(
    request?.contact_preference ?? ContactPreference.Email
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
  let timePreference = $state<TimePreference>(
    request?.time_preference ?? TimePreference.NoPreference
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
  let requirementsError = $state('');
  let linksError = $state('');
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
    title.trim().length > 0 &&
      description.trim().length > 0 &&
      requirements.length > 0 &&
      contactPreference !== undefined &&
      timePreference !== undefined &&
      exchangePreference !== undefined &&
      interactionType !== undefined
  );

  async function mockRequest() {
    submitting = true;

    try {
      const mockedRequest = (await createMockedRequests())[0];
      await onSubmit(mockedRequest, selectedOrganizationHash);

      toastStore.trigger({
        message: 'Mocked request created successfully',
        background: 'variant-filled-success'
      });

      // Reset form
      title = '';
      description = '';
      requirements = [];
      contactPreference = ContactPreference.Email;
      dateRangeStart = null;
      dateRangeEnd = null;
      timeEstimateHours = undefined;
      timePreference = TimePreference.NoPreference;
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
      // Validate requirements
      if (requirements.length === 0) {
        requirementsError = 'At least one requirement is required';
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

      // Prepare request data
      const requestData: RequestInDHT = {
        title,
        description,
        requirements: [...requirements],
        contact_preference: contactPreference,
        date_range: dateRange,
        time_estimate_hours: timeEstimateHours,
        time_preference: timePreference,
        time_zone: timeZone,
        exchange_preference: exchangePreference,
        interaction_type: interactionType,
        links: [...links]
      };

      console.log('Request data:', requestData);

      await onSubmit(requestData, selectedOrganizationHash);

      toastStore.trigger({
        message: `Request ${mode === 'create' ? 'created' : 'updated'} successfully`,
        background: 'variant-filled-success'
      });

      // Reset form if creating
      if (mode === 'create') {
        title = '';
        description = '';
        requirements = [];
        contactPreference = ContactPreference.Email;
        dateRangeStart = null;
        dateRangeEnd = null;
        timeEstimateHours = undefined;
        timePreference = TimePreference.NoPreference;
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

  <!-- Requirements (formerly Skills) -->
  <label class="label">
    <span
      >Requirements <span class="text-error-500">*</span> (at least one requirement is required)</span
    >
    <InputChip
      bind:value={requirements}
      name="requirements"
      placeholder="Add requirements (press Enter to add)"
      validation={(chip) => chip.trim().length > 0}
    />
    {#if requirementsError}
      <p class="text-error mt-1 text-sm">{requirementsError}</p>
    {/if}
  </label>

  <!-- Contact Preference -->
  <div class="space-y-2">
    <span class="label">Contact Preference <span class="text-error-500">*</span></span>
    <div class="grid grid-cols-1 gap-2 md:grid-cols-3">
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          name="contactPreference"
          value={ContactPreference.Email}
          checked={contactPreference === ContactPreference.Email}
          onclick={() => (contactPreference = ContactPreference.Email)}
        />
        <span>Email</span>
      </label>
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          name="contactPreference"
          value={ContactPreference.Phone}
          checked={contactPreference === ContactPreference.Phone}
          onclick={() => (contactPreference = ContactPreference.Phone)}
        />
        <span>Phone</span>
      </label>
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          name="contactPreference"
          value={ContactPreference.Other}
          checked={contactPreference === ContactPreference.Other}
          onclick={() => (contactPreference = ContactPreference.Other)}
        />
        <span>Other</span>
      </label>
    </div>
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
          value={TimePreference.Morning}
          checked={timePreference === TimePreference.Morning}
          onclick={() => (timePreference = TimePreference.Morning)}
        />
        <span>Morning</span>
      </label>
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          name="timePreference"
          value={TimePreference.Afternoon}
          checked={timePreference === TimePreference.Afternoon}
          onclick={() => (timePreference = TimePreference.Afternoon)}
        />
        <span>Afternoon</span>
      </label>
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          name="timePreference"
          value={TimePreference.Evening}
          checked={timePreference === TimePreference.Evening}
          onclick={() => (timePreference = TimePreference.Evening)}
        />
        <span>Evening</span>
      </label>
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          name="timePreference"
          value={TimePreference.NoPreference}
          checked={timePreference === TimePreference.NoPreference}
          onclick={() => (timePreference = TimePreference.NoPreference)}
        />
        <span>No Preference</span>
      </label>
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          name="timePreference"
          value={TimePreference.Other}
          checked={timePreference === TimePreference.Other}
          onclick={() => (timePreference = TimePreference.Other)}
        />
        <span>Other</span>
      </label>
    </div>
  </div>

  <!-- Time Zone -->
  <TimeZoneSelect required={true} name="timezone" id="request-timezone" />

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
        disabled={submitting}
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
