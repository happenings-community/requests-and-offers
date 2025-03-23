<script lang="ts">
  import { getToastStore } from '@skeletonlabs/skeleton';
  import { InputChip } from '@skeletonlabs/skeleton';
  import type { ActionHash } from '@holochain/client';
  import type { UIRequest, UIOrganization } from '@/types/ui';
  import type { RequestInDHT } from '@/types/holochain';
  import usersStore from '@/stores/users.store.svelte';
  import organizationsStore from '@/stores/organizations.store.svelte';
  import { createMockedRequests } from '@mocks';

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
  let urgency = $state(request?.urgency ?? '');
  let selectedOrganizationHash = $state<ActionHash | undefined>(
    preselectedOrganization || request?.organization
  );
  let submitting = $state(false);
  let requirementsError = $state('');
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
    title.trim().length > 0 && description.trim().length > 0 && requirements.length > 0
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
      urgency = '';
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
      // Validate requirements before submission
      if (requirements.length === 0) {
        requirementsError = 'At least one requirement is required';
        submitting = false;
        return;
      }

      const requestData: RequestInDHT = {
        title: title.trim(),
        description: description.trim(),
        requirements: [...requirements],
        urgency: urgency.trim() || undefined
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
        requirements = [];
        urgency = '';
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
    <span>Description <span class="text-error-500">*</span></span>
    <textarea
      class="textarea"
      placeholder="Describe your request in detail"
      rows="4"
      bind:value={description}
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

  <!-- Urgency/Timeframe -->
  <label class="label">
    <span>Urgency/Timeframe (optional)</span>
    <input
      type="text"
      class="input"
      placeholder="e.g., 'Urgent', 'Within 2 weeks', 'By end of month'"
      bind:value={urgency}
    />
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
