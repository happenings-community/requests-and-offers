<script lang="ts">
  import { InputChip } from '@skeletonlabs/skeleton';
  import type { ActionHash } from '@holochain/client';
  import type { UIOrganization } from '$lib/types/ui';
  import {
    type ContactPreference,
    type TimePreference,
    ContactPreferenceHelpers,
    TimePreferenceHelpers,
    ExchangePreference,
    InteractionType
  } from '$lib/types/holochain';
  import type {
    RequestFormManagementState,
    RequestFormManagementActions
  } from '@/lib/composables/domain/requests/useRequestFormManagement.svelte';
  import TimeZoneSelect from '$lib/components/shared/TimeZoneSelect.svelte';
  import ServiceTypeSelector from '@/lib/components/service-types/ServiceTypeSelector.svelte';

  type Props = {
    state: RequestFormManagementState;
    actions: RequestFormManagementActions;
    organizations?: UIOrganization[];
    mode: 'create' | 'edit';
    onSubmit: () => Promise<unknown>;
  };

  const { state, actions, mode = 'create', onSubmit, organizations }: Props = $props();

  async function handleSubmit(event: Event) {
    event.preventDefault();
    if (state.isValid) {
      await onSubmit();
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
      value={state.title}
      oninput={(e) => actions.setTitle((e.currentTarget as HTMLInputElement).value)}
      required
    />
  </label>

  <!-- Description -->
  <label class="label">
    <span
      >Description <span class="text-error-500">*</span>
      <span class="text-sm">({state.description.length}/500 characters)</span></span
    >
    <textarea
      class="textarea"
      placeholder="Describe your request in detail"
      rows="4"
      value={state.description}
      oninput={(e) => actions.setDescription((e.currentTarget as HTMLTextAreaElement).value)}
      maxlength="500"
      required
    ></textarea>
  </label>

  <!-- Service Types -->
  <div class="space-y-2">
    <ServiceTypeSelector
      selectedServiceTypes={state.serviceTypeHashes}
      onSelectionChange={actions.setServiceTypeHashes}
      label="Service Types"
      placeholder="Search and select service types..."
      required
      name="serviceTypes"
      id="request-service-types"
      enableTagFiltering
    />
  </div>

  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <!-- Exchange Preference -->
    <div class="card variant-ghost-surface p-4">
      <h3 class="h3 mb-2">Exchange Preference <span class="text-error-500">*</span></h3>
      <div class="flex flex-col space-y-2">
        <label class="flex items-center space-x-2">
          <input
            type="radio"
            class="radio"
            name="exchangePreference"
            value={ExchangePreference.Exchange}
            checked={state.exchangePreference === ExchangePreference.Exchange}
            onclick={() => actions.setExchangePreference(ExchangePreference.Exchange)}
          />
          <span>Exchange services</span>
        </label>
        <label class="flex items-center space-x-2">
          <input
            type="radio"
            class="radio"
            name="exchangePreference"
            value={ExchangePreference.Arranged}
            checked={state.exchangePreference === ExchangePreference.Arranged}
            onclick={() => actions.setExchangePreference(ExchangePreference.Arranged)}
          />
          <span>Currency (To be arranged)</span>
        </label>
        <label class="flex items-center space-x-2">
          <input
            type="radio"
            class="radio"
            name="exchangePreference"
            value={ExchangePreference.PayItForward}
            checked={state.exchangePreference === ExchangePreference.PayItForward}
            onclick={() => actions.setExchangePreference(ExchangePreference.PayItForward)}
          />
          <span>Pay it forward</span>
        </label>
        <label class="flex items-center space-x-2">
          <input
            type="radio"
            class="radio"
            name="exchangePreference"
            value={ExchangePreference.Open}
            checked={state.exchangePreference === ExchangePreference.Open}
            onclick={() => actions.setExchangePreference(ExchangePreference.Open)}
          />
          <span>"Hit me up"</span>
        </label>
      </div>
    </div>

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
            checked={state.interactionType === InteractionType.Virtual}
            onclick={() => actions.setInteractionType(InteractionType.Virtual)}
          />
          <span>Virtual</span>
        </label>
        <label class="flex items-center space-x-2">
          <input
            type="radio"
            class="radio"
            name="interactionType"
            value={InteractionType.InPerson}
            checked={state.interactionType === InteractionType.InPerson}
            onclick={() => actions.setInteractionType(InteractionType.InPerson)}
          />
          <span>In-Person</span>
        </label>
      </div>
    </div>
  </div>

  <!-- Links -->
  <label class="label">
    <span>Links (optional)</span>
    <InputChip
      value={state.links}
      oninput={(e: Event & { currentTarget: EventTarget & { value: string[] } }) =>
        actions.setLinks(e.currentTarget.value)}
      name="links"
      placeholder="Add links (press Enter to add)"
    />
  </label>

  <!-- Organization -->
  <div class="flex flex-col">
    <label class="label">
      <span>Organization (optional)</span>
      {#if state.isLoadingOrganizations}
        <div class="flex items-center gap-2">
          <span class="loading loading-spinner loading-sm"></span>
          <span class="text-sm">Loading organizations...</span>
        </div>
      {:else if organizations && organizations.length > 0}
        <select
          class="select"
          value={state.selectedOrganizationHash?.toString()}
          onchange={(e: Event & { currentTarget: HTMLSelectElement }) =>
            actions.setSelectedOrganization(
              (e.currentTarget as any).value
                ? (e.currentTarget as any).value
                : undefined
            )}
        >
          <option value="">No organization</option>
          {#each organizations as org}
            <option value={org.original_action_hash?.toString()}>
              {org.name}
            </option>
          {/each}
        </select>
      {:else}
        <p class="text-sm text-surface-500">
          You are not coordinating any organizations. You can create one from the organizations page.
        </p>
      {/if}
    </label>
  </div>
  <!-- Date Range -->
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <label class="label">
      <span>Start Date (optional)</span>
      <input
        type="date"
        class="input"
        value={state.dateRangeStart || ''}
        oninput={(e) => actions.setDateRangeStart((e.currentTarget as HTMLInputElement).value)}
      />
    </label>
    <label class="label">
      <span>End Date (optional)</span>
      <input
        type="date"
        class="input"
        value={state.dateRangeEnd || ''}
        oninput={(e) => actions.setDateRangeEnd((e.currentTarget as HTMLInputElement).value)}
      />
    </label>
  </div>

  <!-- Time Estimate -->
  <label class="label">
    <span>Time Estimate (hours, optional)</span>
    <input
      type="number"
      class="input"
      placeholder="e.g., 2"
      value={state.timeEstimateHours}
      oninput={(e) =>
        actions.setTimeEstimateHours((e.currentTarget as HTMLInputElement).valueAsNumber)}
      min="0"
    />
  </label>

  <!-- Time Preference and Time Zone -->
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
            checked={state.timePreferenceType === 'Morning'}
            onclick={() => actions.setTimePreferenceType('Morning')}
          />
          <span>Morning (9am - 12pm)</span>
        </label>
        <label class="flex items-center space-x-2">
          <input
            type="radio"
            class="radio"
            name="timePreference"
            value="Afternoon"
            checked={state.timePreferenceType === 'Afternoon'}
            onclick={() => actions.setTimePreferenceType('Afternoon')}
          />
          <span>Afternoon (12pm - 5pm)</span>
        </label>
        <label class="flex items-center space-x-2">
          <input
            type="radio"
            class="radio"
            name="timePreference"
            value="Evening"
            checked={state.timePreferenceType === 'Evening'}
            onclick={() => actions.setTimePreferenceType('Evening')}
          />
          <span>Evening (5pm - 9pm)</span>
        </label>
        <label class="flex items-center space-x-2">
          <input
            type="radio"
            class="radio"
            name="timePreference"
            value="NoPreference"
            checked={state.timePreferenceType === 'NoPreference'}
            onclick={() => actions.setTimePreferenceType('NoPreference')}
          />
          <span>No Preference</span>
        </label>
        <label class="flex items-center space-x-2">
          <input
            type="radio"
            class="radio"
            name="timePreference"
            value="Other"
            checked={state.timePreferenceType === 'Other'}
            onclick={() => actions.setTimePreferenceType('Other')}
          />
          <span>Other</span>
        </label>
      </div>
      {#if state.timePreferenceType === 'Other'}
        <input
          type="text"
          class="input mt-2"
          placeholder="Specify other time preference"
          value={state.timePreferenceOther}
          oninput={(e) => actions.setTimePreferenceOther((e.currentTarget as HTMLInputElement).value)}
          required
        />
      {/if}
    </div>

    <!-- Time Zone -->
    <div class="card variant-ghost-surface p-4">
      <TimeZoneSelect
        value={state.timeZone}
        onchange={(value) => actions.setTimeZone(value)}
      />
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
          checked={state.contactPreferenceType === 'Email'}
          onclick={() => actions.setContactPreferenceType('Email')}
        />
        <span>Email</span>
      </label>
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          class="radio"
          name="contactPreference"
          value="Phone"
          checked={state.contactPreferenceType === 'Phone'}
          onclick={() => actions.setContactPreferenceType('Phone')}
        />
        <span>Phone</span>
      </label>
      <label class="flex items-center space-x-2">
        <input
          type="radio"
          class="radio"
          name="contactPreference"
          value="Other"
          checked={state.contactPreferenceType === 'Other'}
          onclick={() => actions.setContactPreferenceType('Other')}
        />
        <span>Other</span>
      </label>
    </div>
    {#if state.contactPreferenceType === 'Other'}
      <input
        type="text"
        class="input mt-2"
        placeholder="Specify other contact preference"
        value={state.contactPreferenceOther}
        oninput={(e) =>
          actions.setContactPreferenceOther((e.currentTarget as HTMLInputElement).value)}
        required
      />
    {/if}
  </div>

  <!-- Action Buttons -->
  <div class="flex items-center justify-end space-x-4">
    <div class="flex items-center justify-end space-x-4">
      <button
        type="submit"
        class="btn variant-filled-primary"
        disabled={!state.isValid || state.isSubmitting}
        onclick={(e) => {
          // Prevent any potential double-submission
          if (state.isSubmitting) {
            e.preventDefault();
            return false;
          }
        }}
      >
        {#if state.isSubmitting}
          <span class="spinner-icon"></span>
        {/if}
        {mode === 'create' ? 'Create Request' : 'Update Request'}
      </button>

      {#if mode === 'create'}
        <button
          type="button"
          class="btn variant-soft-secondary"
          onclick={async () => {
            await actions.createMockRequest();
          }}
          disabled={state.isSubmitting}
          title="Fill form with random mock data and service types for testing"
        >
          {#if state.isSubmitting}
            Loading...
          {:else}
            🎲 Fill with Mock Data
          {/if}
        </button>
      {/if}
    </div>
  </div>
</form>
