<script lang="ts">
  import { getToastStore } from '@skeletonlabs/skeleton';
  import { InputChip } from '@skeletonlabs/skeleton';
  import type { ActionHash } from '@holochain/client';
  import type { UIOrganization, UIOffer } from '@lib/types/ui';
  import type { OfferInDHT } from '@lib/types/holochain';
  import { TimePreference, ExchangePreference, InteractionType } from '@lib/types/holochain';
  import usersStore from '@stores/users.store.svelte';
  import organizationsStore from '@stores/organizations.store.svelte';
  import { createMockedOffers } from '@utils/mocks';
  import moment from 'moment-timezone';

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
  let timePreference = $state<TimePreference>(
    offer?.time_preference ?? TimePreference.NoPreference
  );
  let timeZone = $state<string | undefined>(offer?.time_zone ?? undefined);
  let exchangePreference = $state<ExchangePreference>(
    offer?.exchange_preference ?? ExchangePreference.Exchange
  );
  let interactionType = $state<InteractionType>(offer?.interaction_type ?? InteractionType.Virtual);
  let links = $state<string[]>(offer?.links ?? []);
  let selectedOrganizationHash = $state<ActionHash | undefined>(
    preselectedOrganization || offer?.organization
  );
  let submitting = $state(false);
  let capabilitiesError = $state('');
  let linksError = $state('');
  let userCoordinatedOrganizations = $state<UIOrganization[]>([]);
  let isLoadingOrganizations = $state(true);

  // Timezone handling
  let timezones = moment.tz.names();
  let filteredTimezones: string[] = $state([]);
  let formattedTimezones: FormattedTimezone[] = $state([]);
  let search = $state('');

  type FormattedTimezone = {
    name: string;
    formatted: string;
    offset: number;
  };

  function formatTimezones(timezones: string[]): FormattedTimezone[] {
    return timezones.map((timezone) => {
      const offset = moment.tz(timezone).utcOffset();
      const hours = Math.floor(Math.abs(offset) / 60);
      const minutes = Math.abs(offset) % 60;
      const sign = offset >= 0 ? '+' : '-';

      const formatted = `GMT${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${timezone}`;

      return { name: timezone, formatted, offset };
    });
  }

  function filterTimezones(event: any) {
    search = event.target.value.trim();
    filteredTimezones = timezones.filter((tz) => tz.toLowerCase().includes(search.toLowerCase()));
  }

  // Load user's coordinated organizations immediately
  $effect(() => {
    loadCoordinatedOrganizations();
  });

  // Initialize timezones
  $effect(() => {
    if (search) {
      formattedTimezones = formatTimezones(filteredTimezones);
    } else {
      formattedTimezones = formatTimezones(timezones);
    }
  });

  $effect(() => {
    if (formattedTimezones.length > 0) {
      formattedTimezones = [...formattedTimezones].sort((a, b) => a.offset - b.offset);
    }
  });

  // Handle timezone selection
  $effect(() => {
    if (timeZone) {
      const found = timezones.find((tz) => tz === timeZone);
      if (!found) {
        timeZone = undefined;
      }
    }
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
      capabilities.length > 0 &&
      timePreference !== undefined &&
      exchangePreference !== undefined &&
      interactionType !== undefined
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
      timePreference = TimePreference.NoPreference;
      timeZone = undefined;
      exchangePreference = ExchangePreference.Exchange;
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
      // Validate capabilities before submission
      if (capabilities.length === 0) {
        capabilitiesError = 'At least one capability is required';
        submitting = false;
        return;
      }

      // Validate links before submission
      if (links.some((link) => !link.trim())) {
        linksError = 'Links cannot be empty';
        submitting = false;
        return;
      }

      const offerData: OfferInDHT = {
        title: title.trim(),
        description: description.trim(),
        capabilities: [...capabilities],
        time_preference: timePreference,
        time_zone: timeZone,
        exchange_preference: exchangePreference,
        interaction_type: interactionType,
        links: [...links]
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
        timePreference = TimePreference.NoPreference;
        timeZone = undefined;
        exchangePreference = ExchangePreference.Exchange;
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
  <label class="label">
    <span>Time Zone (optional)</span>
    <div class="flex flex-col gap-2 md:flex-row">
      <input
        type="text"
        placeholder="Search timezones..."
        class="input w-full md:w-1/2"
        oninput={filterTimezones}
      />
      <select class="select w-full md:w-1/2" bind:value={timeZone}>
        <option value={undefined}>Select a timezone</option>
        {#each formattedTimezones as tz}
          <option value={tz.name}>{tz.formatted}</option>
        {/each}
      </select>
    </div>
  </label>

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
