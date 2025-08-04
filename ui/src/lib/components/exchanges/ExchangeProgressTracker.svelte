<script lang="ts">
  import { useExchangeDetails, useExchangeAgreementManagement } from '$lib/composables/domain/exchanges';
  import { formatDate } from '$lib/utils';
  import type { ActionHash } from '@holochain/client';
  import type { UIAgreement, UIExchangeEvent } from '$lib/types/ui';
  import type { AgreementStatus, ExchangeEventType } from '$lib/schemas/exchanges.schemas';
  import usersStore from '$lib/stores/users.store.svelte';

  // Props
  interface Props {
    agreementHash: ActionHash;
    agreement?: UIAgreement;
  }
  
  let { agreementHash, agreement: preloadedAgreement }: Props = $props();

  // Composables
  const exchangeDetails = useExchangeDetails();
  const agreementManagement = useExchangeAgreementManagement();
  const { currentUser } = $derived(usersStore);

  // State
  let isInitialized = $state(false);
  let showAddEventForm = $state(false);
  let eventFormData = $state({
    title: '',
    description: '',
    event_type: 'ProgressUpdate' as ExchangeEventType | 'ProgressUpdate',
    priority: 'Normal' as 'Low' | 'Normal' | 'High' | 'Critical',
    progress_percentage: 0,
    is_public: true
  });

  // Derived state
  const {
    agreement,
    events,
    loading,
    error
  } = $derived(exchangeDetails);

  const sortedEvents = $derived(() => {
    if (!events) return [];
    return [...events].sort((a, b) => 
      Number(b.created_at || 0) - Number(a.created_at || 0)
    );
  });

  // Initialize component
  $effect(() => {
    if (!isInitialized) {
      if (preloadedAgreement) {
        // Use preloaded agreement if provided
      } else {
        exchangeDetails.initialize(agreementHash, 'agreement');
      }
      isInitialized = true;
    }
  });

  // Progress calculation
  const overallProgress = $derived(() => {
    if (!events || events.length === 0) return 0;
    
    const progressEvents = events.filter(e => 
      e.progress_percentage !== undefined && e.progress_percentage !== null
    );
    
    if (progressEvents.length === 0) return 0;
    
    // Get the most recent progress event
    const latestProgress = progressEvents.reduce((latest, current) => 
      Number(current.created_at || 0) > Number(latest.created_at || 0) ? current : latest
    );
    
    return latestProgress.progress_percentage || 0;
  });

  // Timeline steps based on agreement status
  const timelineSteps = $derived(() => {
    const steps = [
      { 
        key: 'created', 
        label: 'Agreement Created', 
        completed: true, 
        date: agreement?.created_at,
        icon: 'assignment'
      },
      { 
        key: 'active', 
        label: 'Active', 
        completed: agreement?.status !== 'Active' ? true : false,
        date: agreement?.start_date || agreement?.created_at,
        icon: 'play_circle'
      },
      { 
        key: 'progress', 
        label: 'In Progress', 
        completed: ['InProgress', 'Completed'].includes(agreement?.status || ''),
        date: events?.find(e => e.event_type === 'AgreementStarted')?.created_at,
        icon: 'trending_up'
      },
      { 
        key: 'completed', 
        label: 'Completed', 
        completed: agreement?.status === 'Completed',
        date: agreement?.completion_date,
        icon: 'check_circle'
      }
    ];

    // Handle cancelled/failed states
    if (agreement?.status?.startsWith('Cancelled') || agreement?.status === 'Failed') {
      steps.push({
        key: 'cancelled',
        label: agreement.status === 'Failed' ? 'Failed' : 'Cancelled',
        completed: true,
        date: agreement.updated_at,
        icon: agreement.status === 'Failed' ? 'error' : 'cancel'
      });
    }

    return steps;
  });

  // Event type styling
  function getEventTypeClass(eventType: ExchangeEventType | string): string {
    if (typeof eventType === 'object' || eventType === 'ProgressUpdate') {
      return 'variant-soft-primary';
    }
    
    switch (eventType) {
      case 'AgreementStarted':
        return 'variant-soft-success';
      case 'MilestoneReached':
        return 'variant-soft-warning';
      case 'IssueReported':
        return 'variant-soft-error';
      case 'DeliveryCompleted':
        return 'variant-soft-success';
      case 'PaymentProcessed':
        return 'variant-soft-tertiary';
      default:
        return 'variant-soft-surface';
    }
  }

  function getEventTypeIcon(eventType: ExchangeEventType | string): string {
    if (typeof eventType === 'object' || eventType === 'ProgressUpdate') {
      return 'trending_up';
    }
    
    switch (eventType) {
      case 'AgreementStarted':
        return 'play_arrow';
      case 'MilestoneReached':
        return 'flag';
      case 'IssueReported':
        return 'warning';
      case 'DeliveryCompleted':
        return 'check_circle';
      case 'PaymentProcessed':
        return 'payment';
      default:
        return 'event';
    }
  }

  function getPriorityClass(priority: string): string {
    switch (priority) {
      case 'Critical':
        return 'text-error-500';
      case 'High':
        return 'text-warning-500';
      case 'Normal':
        return 'text-primary-500';
      case 'Low':
        return 'text-surface-500';
      default:
        return 'text-surface-500';
    }
  }

  // Form handlers
  async function handleAddEvent(event: SubmitEvent) {
    event.preventDefault();
    
    if (!agreement?.original_action_hash) return;

    try {
      await agreementManagement.addProgressUpdate(agreement.original_action_hash, {
        event_type: eventFormData.event_type === 'ProgressUpdate' ? 'ProgressUpdate' : eventFormData.event_type,
        priority: eventFormData.priority,
        title: eventFormData.title,
        description: eventFormData.description,
        progress_percentage: eventFormData.progress_percentage > 0 ? eventFormData.progress_percentage : undefined,
        is_public: eventFormData.is_public,
        attachments: [],
        metadata: {}
      });

      // Reset form
      eventFormData = {
        title: '',
        description: '',
        event_type: 'ProgressUpdate',
        priority: 'Normal',
        progress_percentage: 0,
        is_public: true
      };
      showAddEventForm = false;

      // Refresh data
      exchangeDetails.refreshExchangeData();
    } catch (error) {
      console.error('Failed to add progress update:', error);
    }
  }

  function handleCancelAddEvent() {
    eventFormData = {
      title: '',
      description: '',
      event_type: 'ProgressUpdate',
      priority: 'Normal',
      progress_percentage: 0,
      is_public: true
    };
    showAddEventForm = false;
  }

  // User role detection
  const userRole = $derived(() => {
    if (!agreement || !currentUser) return 'none';
    return agreementManagement.getUserRoleInAgreement(agreement);
  });

  const canAddEvents = $derived(() => {
    return userRole !== 'none' && 
           agreement?.status === 'InProgress' && 
           agreementManagement.canUserManageAgreement(agreement);
  });
</script>

<div class="space-y-6">
  <!-- Progress Header -->
  <div class="card p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="h3 font-semibold">Exchange Progress</h2>
      {#if canAddEvents}
        <button 
          class="variant-filled-primary btn-sm btn"
          onclick={() => showAddEventForm = !showAddEventForm}
        >
          <span class="material-symbols-outlined">add</span>
          <span>Add Update</span>
        </button>
      {/if}
    </div>

    <!-- Overall Progress Bar -->
    <div class="space-y-2">
      <div class="flex justify-between text-sm">
        <span>Overall Progress</span>
        <span>{overallProgress}%</span>
      </div>
      <div class="bg-surface-300 h-3 rounded-full dark:bg-surface-600">
        <div 
          class="bg-primary-500 h-full rounded-full transition-all duration-300"
          style="width: {overallProgress}%"
        ></div>
      </div>
    </div>

    <!-- Agreement Status -->
    {#if agreement}
      <div class="mt-4 flex items-center gap-2">
        <span class="text-sm font-medium">Status:</span>
        <span class="chip variant-soft-primary">
          {agreement.status}
        </span>
        {#if userRole !== 'none'}
          <span class="chip variant-soft-surface">
            You are the {userRole}
          </span>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Timeline -->
  <div class="card p-6">
    <h3 class="h4 mb-4 font-semibold">Timeline</h3>
    
    <div class="space-y-4">
      {#each timelineSteps as step, index (step.key)}
        <div class="flex items-start gap-4">
          <!-- Timeline Icon -->
          <div class="flex-shrink-0">
            <div class="flex h-10 w-10 items-center justify-center rounded-full {step.completed ? 'bg-success-500' : 'bg-surface-300 dark:bg-surface-600'}">
              <span class="material-symbols-outlined text-sm {step.completed ? 'text-white' : 'text-surface-500'}">
                {step.icon}
              </span>
            </div>
            {#if index < timelineSteps.length - 1}
              <div class="ml-5 mt-2 h-8 w-0.5 {step.completed ? 'bg-success-500' : 'bg-surface-300 dark:bg-surface-600'}"></div>
            {/if}
          </div>
          
          <!-- Timeline Content -->
          <div class="flex-grow pb-4">
            <h4 class="font-medium {step.completed ? 'text-success-700 dark:text-success-300' : 'text-surface-600 dark:text-surface-400'}">
              {step.label}
            </h4>
            {#if step.date}
              <p class="text-sm text-surface-500">
                {formatDate(new Date(Number(step.date)))}
              </p>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Add Event Form -->
  {#if showAddEventForm}
    <div class="card p-6">
      <h3 class="h4 mb-4 font-semibold">Add Progress Update</h3>
      
      <form class="space-y-4" onsubmit={handleAddEvent}>
        <!-- Title -->
        <div>
          <label class="label" for="event_title">
            <span>Title *</span>
          </label>
          <input
            id="event_title"
            class="input"
            type="text"
            placeholder="Brief title for this update..."
            bind:value={eventFormData.title}
            required
          />
        </div>

        <!-- Description -->
        <div>
          <label class="label" for="event_description">
            <span>Description *</span>
          </label>
          <textarea
            id="event_description"
            class="textarea"
            placeholder="Detailed description of the progress or milestone..."
            bind:value={eventFormData.description}
            rows="3"
            required
          ></textarea>
        </div>

        <!-- Event Type and Priority -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label class="label" for="event_type">
              <span>Event Type</span>
            </label>
            <select
              id="event_type"
              class="select"
              bind:value={eventFormData.event_type}
            >
              <option value="ProgressUpdate">Progress Update</option>
              <option value="MilestoneReached">Milestone Reached</option>
              <option value="IssueReported">Issue Reported</option>
              <option value="DeliveryCompleted">Delivery Completed</option>
              <option value="PaymentProcessed">Payment Processed</option>
            </select>
          </div>

          <div>
            <label class="label" for="event_priority">
              <span>Priority</span>
            </label>
            <select
              id="event_priority"
              class="select"
              bind:value={eventFormData.priority}
            >
              <option value="Low">Low</option>
              <option value="Normal">Normal</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
        </div>

        <!-- Progress Percentage -->
        <div>
          <label class="label" for="progress_percentage">
            <span>Progress Percentage (Optional)</span>
          </label>
          <div class="flex items-center gap-2">
            <input
              id="progress_percentage"
              class="input flex-grow"
              type="range"
              min="0"
              max="100"
              bind:value={eventFormData.progress_percentage}
            />
            <span class="text-sm w-12">{eventFormData.progress_percentage}%</span>
          </div>
        </div>

        <!-- Public Event -->
        <div class="flex items-center gap-2">
          <input
            id="is_public"
            type="checkbox"
            class="checkbox"
            bind:checked={eventFormData.is_public}
          />
          <label class="label" for="is_public">
            <span>Make this update public</span>
          </label>
        </div>

        <!-- Form Actions -->
        <div class="flex justify-end gap-2">
          <button 
            type="button"
            class="variant-ghost-surface btn"
            onclick={handleCancelAddEvent}
          >
            Cancel
          </button>
          <button 
            type="submit"
            class="variant-filled-primary btn"
            disabled={!eventFormData.title.trim() || !eventFormData.description.trim()}
          >
            <span class="material-symbols-outlined">add</span>
            <span>Add Update</span>
          </button>
        </div>
      </form>
    </div>
  {/if}

  <!-- Events List -->
  {#if loading}
    <div class="flex items-center justify-center p-8">
      <span class="material-symbols-outlined animate-spin">hourglass_empty</span>
      <span class="ml-2">Loading events...</span>
    </div>
  {:else if error}
    <div class="variant-filled-error alert">
      <span class="material-symbols-outlined">error</span>
      <span>Error loading events: {error}</span>
    </div>
  {:else if sortedEvents.length > 0}
    <div class="card p-6">
      <h3 class="h4 mb-4 font-semibold">Event History</h3>
      
      <div class="space-y-4">
        {#each sortedEvents as event (event.original_action_hash || event.created_at)}
          <div class="border-surface-300 flex items-start gap-4 border-l-2 pl-4 dark:border-surface-600">
            <!-- Event Icon -->
            <div class="chip {getEventTypeClass(event.event_type)}">
              <span class="material-symbols-outlined">
                {getEventTypeIcon(event.event_type)}
              </span>
            </div>
            
            <!-- Event Content -->
            <div class="flex-grow">
              <div class="flex items-start justify-between">
                <div>
                  <h4 class="font-medium">{event.title}</h4>
                  <p class="text-sm text-surface-600 dark:text-surface-300">
                    {event.description}
                  </p>
                </div>
                <div class="text-right">
                  <div class="text-sm text-surface-500">
                    {formatDate(new Date(Number(event.created_at || 0)))}
                  </div>
                  <div class="text-xs {getPriorityClass(event.priority)}">
                    {event.priority}
                  </div>
                </div>
              </div>
              
              <!-- Progress Bar for events with progress -->
              {#if event.progress_percentage !== undefined && event.progress_percentage !== null}
                <div class="mt-2">
                  <div class="bg-surface-200 h-2 rounded-full dark:bg-surface-600">
                    <div 
                      class="bg-primary-400 h-full rounded-full"
                      style="width: {event.progress_percentage}%"
                    ></div>
                  </div>
                  <div class="text-xs text-surface-500 mt-1">
                    Progress: {event.progress_percentage}%
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>