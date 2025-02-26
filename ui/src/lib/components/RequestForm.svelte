<script lang="ts">
  import { getToastStore } from '@skeletonlabs/skeleton';
  import type { ActionHash } from '@holochain/client';
  import type { UIRequest, UIOrganization } from '@/types/ui';
  import type { RequestInDHT } from '@/types/holochain';
  import { RequestProcessState } from '@/types/holochain';
  import { encodeHashToBase64 } from '@holochain/client';

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
  let title = $state(request?.title || '');
  let description = $state(request?.description || '');
  let processState = $state(request?.process_state || RequestProcessState.Proposed);
  let skills = $state<string[]>(request?.skills || []);
  let selectedOrganizationHash = $state<ActionHash | undefined>(request?.organization);
  let newSkill = $state('');
  let submitting = $state(false);

  // Form validation
  const isValid = $derived(title.trim().length > 0 && description.trim().length > 0);

  // Add a new skill
  function addSkill() {
    const trimmedSkill = newSkill.trim();
    if (trimmedSkill && !skills.includes(trimmedSkill)) {
      skills = [...skills, trimmedSkill];
      newSkill = '';
    }
  }

  // Remove a skill
  function removeSkill(skillToRemove: string) {
    skills = skills.filter((skill) => skill !== skillToRemove);
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
      const requestData: RequestInDHT = {
        title: title.trim(),
        description: description.trim(),
        process_state: processState,
        skills: skills
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
        processState = RequestProcessState.Proposed;
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

  <!-- Process State -->
  <label class="label">
    <span>Status</span>
    <select class="select" bind:value={processState}>
      {#each Object.values(RequestProcessState) as state}
        <option value={state}>{state}</option>
      {/each}
    </select>
  </label>

  <!-- Skills -->
  <div class="space-y-2">
    <label class="label">
      <span>Skills</span>
      <div class="input-group input-group-divider grid-cols-[1fr_auto]">
        <input
          type="text"
          placeholder="Add a skill"
          class="input"
          bind:value={newSkill}
          oninput={(e) => (newSkill = e.currentTarget.value)}
          onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
        />
        <button type="button" class="variant-filled-secondary" onclick={addSkill}> Add </button>
      </div>
    </label>

    <!-- Skills list -->
    {#if skills.length > 0}
      <div class="flex flex-wrap gap-2">
        {#each skills as skill}
          <span class="chip variant-soft-primary">
            {skill}
            <button
              type="button"
              class="btn-icon btn-icon-sm variant-ghost ml-1"
              onclick={() => removeSkill(skill)}
            >
              <span class="material-icons text-sm">close</span>
            </button>
          </span>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Organization selection (if applicable) -->
  {#if organizations.length > 0}
    <label class="label">
      <span>Organization (optional)</span>
      <select class="select" bind:value={selectedOrganizationHash}>
        <option value={undefined}>No organization</option>
        {#each organizations as org}
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
