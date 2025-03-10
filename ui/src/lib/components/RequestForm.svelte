<script lang="ts">
  import { getToastStore } from '@skeletonlabs/skeleton';
  import { InputChip } from '@skeletonlabs/skeleton';
  import type { ActionHash } from '@holochain/client';
  import type { UIRequest, UIOrganization } from '@/types/ui';
  import type { RequestInDHT } from '@/types/holochain';

  type Props = {
    request?: UIRequest;
    organizations?: UIOrganization[];
    mode: 'create' | 'edit';
    onSubmit: (request: RequestInDHT, organizationHash?: ActionHash) => Promise<void>;
  };

  const { request, organizations = [], mode = 'create', onSubmit }: Props = $props();

  // Toast store for notifications
  const toastStore = getToastStore();

  // Form state
  let title = $state(request?.title ?? '');
  let description = $state(request?.description ?? '');
  let skills = $state<string[]>(request?.skills ?? []);
  let selectedOrganizationHash = $state<ActionHash | undefined>(request?.organization);
  let submitting = $state(false);
  let skillsError = $state('');

  // Form validation
  const isValid = $derived(
    title.trim().length > 0 && description.trim().length > 0 && skills.length > 0
  );

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
      // Validate skills before submission
      if (skills.length === 0) {
        skillsError = 'At least one skill is required';
        submitting = false;
        return;
      }

      const requestData: RequestInDHT = {
        title: title.trim(),
        description: description.trim(),
        skills: [...skills]
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
        skills = [];
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

  <!-- Skills -->
  <label class="label">
    <span>Skills <span class="text-error-500">*</span> (at least one skill is required)</span>
    <InputChip
      bind:value={skills}
      name="skills"
      placeholder="Add skills (press Enter to add)"
      validation={(chip) => chip.trim().length > 0}
    />
    {#if skillsError}
      <p class="text-error mt-1 text-sm">{skillsError}</p>
    {/if}
  </label>

  <!-- Organization selection (if applicable) -->
  {#if organizations.some((org) => org.status?.status_type === 'accepted')}
    <label class="label">
      <span>Organization (optional)</span>
      <select class="select" bind:value={selectedOrganizationHash}>
        <option value={undefined}>No organization</option>
        {#each organizations.filter((org) => org.status?.status_type === 'accepted') as org}
          <option value={org.original_action_hash}>
            {org.name}
          </option>
        {/each}
      </select>
    </label>
  {/if}

  <!-- Submit button -->
  <div class="flex justify-end gap-2">
    <button type="submit" class="btn variant-filled-primary" disabled={!isValid || submitting}>
      {#if submitting}
        <span class="spinner-icon"></span>
      {/if}
      {mode === 'create' ? 'Create Request' : 'Update Request'}
    </button>
  </div>
</form>
