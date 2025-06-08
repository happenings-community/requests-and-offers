<script lang="ts">
  import { Avatar, getModalStore, type ModalSettings } from '@skeletonlabs/skeleton';
  import { goto } from '$app/navigation';
  import { encodeHashToBase64 } from '@holochain/client';
  import type { UIRequest, UIOrganization } from '$lib/types/ui';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import ServiceTypeTag from '$lib/components/service-types/ServiceTypeTag.svelte';
  import { TimePreferenceHelpers } from '$lib/types/holochain';
  import { Effect as E, Option as O, Data, pipe } from 'effect';

  // Define custom error types
  class OrganizationError extends Data.TaggedError('OrganizationError')<{
    message: string;
    cause?: unknown;
  }> {}
  
  class NavigationError extends Data.TaggedError('NavigationError')<{
    message: string;
    cause?: unknown;
  }> {}
  
  class DeleteRequestError extends Data.TaggedError('DeleteRequestError')<{
    message: string;
    cause?: unknown;
  }> {}

  type Props = {
    request: UIRequest;
    mode?: 'compact' | 'expanded';
    showActions?: boolean;
  };

  const { request, mode = 'compact', showActions = false }: Props = $props();

  const creatorPictureUrl = $derived(
    request.creator
      ? '/default_avatar.webp' // For now, use default until we can fetch the actual user
      : '/default_avatar.webp'
  );

  // Organization details
  let organization = $state<O.Option<UIOrganization>>(O.none());
  let loadingOrganization = $state(false);
  let organizationError = $state<O.Option<OrganizationError>>(O.none());

  // Effect to load organization data
  const loadOrganizationEffect = (orgHash: Uint8Array) =>
    pipe(
      E.tryPromise({
        try: () => organizationsStore.getOrganizationByActionHash(orgHash),
        catch: (error) =>
          new OrganizationError({
            message: 'Failed to load organization',
            cause: error
          })
      }),
      E.tap((org) => E.sync(() => {
        organization = org ? O.some(org) : O.none();
        organizationError = O.none();
      })),
      E.catchAll((error) =>
        E.sync(() => {
          console.error('Error loading organization:', error);
          organization = O.none();
          organizationError = O.some(error);
          return null;
        })
      )
    );

  $effect(() => {
    if (request.organization) {
      loadingOrganization = true;
      pipe(
        loadOrganizationEffect(request.organization),
        E.runPromise
      ).then(() => {
        loadingOrganization = false;
      }).catch((err) => {
        console.error('Unhandled error in effect:', err);
        loadingOrganization = false;
      });
    }
  });

  // Helper function to retry loading organization
  function retryLoadOrganization() {
    if (request.organization) {
      loadingOrganization = true;
      organizationError = O.none();
      pipe(
        loadOrganizationEffect(request.organization),
        E.runPromise
      ).then(() => {
        loadingOrganization = false;
      }).catch((err) => {
        console.error('Unhandled error in retry:', err);
        loadingOrganization = false;
      });
    }
  }

  // Navigate to user profile using Effect
  const navigateToUserProfileEffect = (creatorHash: Uint8Array) =>
    pipe(
      E.sync(() => encodeHashToBase64(creatorHash)),
      E.flatMap((encodedHash) => E.sync(() => goto(`/users/${encodedHash}`))),
      E.catchAll((error) =>
        E.sync(() => {
          console.error('Error navigating to user profile:', error);
        })
      )
    );

  // Navigate to user profile
  function navigateToUserProfile() {
    if (request.creator) {
      pipe(navigateToUserProfileEffect(request.creator), E.runSync);
    }
  }

  // State for edit/delete operations
  let isDeleting = $state(false);
  let isNavigatingToEdit = $state(false);
  let deleteError = $state<O.Option<DeleteRequestError>>(O.none());
  let navigationError = $state<O.Option<NavigationError>>(O.none());
  
  const modalStore = getModalStore();
  
  // Determine if request is editable based on current user
  const isEditable = $derived(true); // TODO: Implement actual logic based on user permissions
  
  // Effect for navigating to edit page
  const navigateToEditEffect = (requestHash: Uint8Array) =>
    E.gen(function* ($) {
      try {
        // Set navigating state
        yield* $(E.sync(() => {
          isNavigatingToEdit = true;
          navigationError = O.none();
        }));
        
        // Encode hash and navigate to edit page
        const encodedHash = yield* $(E.sync(() => encodeHashToBase64(requestHash)));
        yield* $(E.tryPromise(() => goto(`/requests/edit/${encodedHash}`)));
        
        return true;
      } catch (error) {
        // Handle navigation error
        const navError = new NavigationError({
          message: 'Failed to navigate to edit page',
          cause: error
        });
        
        console.error('Navigation error:', error);
        
        yield* $(E.sync(() => {
          navigationError = O.some(navError);
        }));
        
        return false;
      } finally {
        // Reset navigating state
        yield* $(E.sync(() => {
          isNavigatingToEdit = false;
        }));
      }
    });
  
  // Effect for deleting a request
  const deleteRequestEffect = (requestHash: Uint8Array) =>
    E.gen(function* ($) {
      try {
        // Set deleting state
        yield* $(E.sync(() => {
          isDeleting = true;
          deleteError = O.none();
        }));
        
        // TODO: Replace with actual delete call when implemented
        // This is a placeholder for the actual API call
        yield* $(E.tryPromise(() => new Promise(resolve => setTimeout(resolve, 1000))));
        
        // For now, just navigate to requests list after "deletion"
        yield* $(E.tryPromise(() => goto('/requests')));
        
        return true;
      } catch (error) {
        // Handle delete error
        const delError = new DeleteRequestError({
          message: 'Failed to delete request',
          cause: error
        });
        
        console.error('Delete error:', error);
        
        yield* $(E.sync(() => {
          deleteError = O.some(delError);
        }));
        
        return false;
      } finally {
        // Reset deleting state
        yield* $(E.sync(() => {
          isDeleting = false;
        }));
      }
    });

  // Handle edit action
  function handleEdit() {
    if (!request.original_action_hash) return;
    
    pipe(
      navigateToEditEffect(request.original_action_hash),
      E.runPromise
    ).catch(err => {
      console.error('Unhandled navigation error:', err);
    });
  }

  // Handle delete action
  function handleDelete() {
    if (!request.original_action_hash) return;
    
    // Show confirmation modal
    const modalSettings: ModalSettings = {
      type: 'confirm',
      title: 'Confirm Deletion',
      body: `Are you sure you want to delete the request "${request.title}"?`,
      buttonTextConfirm: 'Delete',
      buttonTextCancel: 'Cancel',
      response: (confirmed: boolean) => {
        if (confirmed) {
          pipe(
            deleteRequestEffect(request.original_action_hash!),
            E.runPromise
          ).catch(err => {
            console.error('Unhandled delete error:', err);
          });
        }
      }
    };
    
    modalStore.trigger(modalSettings);
  }
</script>

<div
  class="card variant-soft flex flex-col gap-3 p-4
  {mode === 'compact' ? 'text-sm' : 'text-base'}"
>
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <button class="flex" onclick={navigateToUserProfile}>
        <Avatar src={creatorPictureUrl} width="w-10" rounded="rounded-full" />
      </button>
      <div>
        <h3 class="font-semibold">{request.title}</h3>
        {#if request.organization}
          <p class="text-xs text-primary-500">
            {#if loadingOrganization}
              <span class="flex items-center gap-1 font-medium">
                <span class="spinner-border-sm border-secondary-500"></span>
                Loading organization...
              </span>
            {:else if O.isSome(organizationError)}
              <span class="flex items-center gap-1 font-medium text-error-500">
                Error loading organization
                <button
                  class="variant-soft-secondary btn-icon btn-sm"
                  onclick={retryLoadOrganization}
                  title="Retry loading organization"
                >
                  ↻
                </button>
              </span>
            {:else if O.isSome(organization)}
              <span class="font-medium">{O.getOrNull(organization)?.name}</span>
            {:else}
              <span class="font-medium">Unknown organization</span>
            {/if}
          </p>
        {/if}
        {#if request.date_range?.start || request.date_range?.end}
          <p class="text-xs text-secondary-500">
            <span class="font-medium">
              {#if request.date_range.start && request.date_range.end}
                Timeframe: {new Date(request.date_range.start).toLocaleDateString()} - {new Date(
                  request.date_range.end
                ).toLocaleDateString()}
              {:else if request.date_range.start}
                Starting: {new Date(request.date_range.start).toLocaleDateString()}
              {:else if request.date_range.end}
                Until: {new Date(request.date_range.end).toLocaleDateString()}
              {/if}
            </span>
          </p>
        {:else if request.time_preference}
          <p class="text-xs text-secondary-500">
            <span class="font-medium">
              Time: {TimePreferenceHelpers.getDisplayValue(request.time_preference)}
            </span>
          </p>
        {/if}
        <div class="mt-1 flex flex-wrap gap-2">
          {#if request.interaction_type}
            <span class="variant-soft-primary badge"
              >{request.interaction_type === 'InPerson'
                ? 'In Person'
                : request.interaction_type}</span
            >
          {/if}
          {#if request.exchange_preference}
            <span class="variant-soft-secondary badge">
              {#if request.exchange_preference === 'Exchange'}
                Exchange Services
              {:else if request.exchange_preference === 'Arranged'}
                To Be Arranged
              {:else if request.exchange_preference === 'PayItForward'}
                Pay It Forward
              {:else if request.exchange_preference === 'Open'}
                Hit Me Up
              {:else}
                {request.exchange_preference}
              {/if}
            </span>
          {/if}
        </div>
        {#if mode === 'expanded'}
          <p class="text-surface-600-300-token opacity-80">
            {request.description}
          </p>
        {/if}
      </div>
    </div>
  </div>
  {#if request.service_type_hashes && request.service_type_hashes.length > 0}
    <div class="flex flex-wrap gap-2">
      {#each request.service_type_hashes as serviceTypeHash}
        <ServiceTypeTag serviceTypeActionHash={serviceTypeHash} />
      {/each}
    </div>
  {/if}

  {#if showActions && isEditable}
    <div class="mt-2 flex gap-2">
      {#if isNavigatingToEdit}
        <button class="variant-filled-secondary btn btn-sm" disabled>
          <span class="loading loading-spinner loading-xs"></span>
          Navigating...
        </button>
      {:else if O.isSome(navigationError)}
        <div class="flex items-center gap-2">
          <button 
            class="variant-filled-secondary btn btn-sm" 
            onclick={handleEdit}
          >
            Retry Edit
          </button>
          <span class="text-error-500 text-xs">
            {O.getOrElse(navigationError, () => ({ message: 'Navigation error' })).message}
          </span>
        </div>
      {:else}
        <button 
          class="variant-filled-secondary btn btn-sm" 
          onclick={handleEdit}
        >
          Edit
        </button>
      {/if}
      
      {#if isDeleting}
        <button class="variant-filled-error btn btn-sm" disabled>
          <span class="loading loading-spinner loading-xs"></span>
          Deleting...
        </button>
      {:else if O.isSome(deleteError)}
        <div class="flex items-center gap-2">
          <button 
            class="variant-filled-error btn btn-sm" 
            onclick={handleDelete}
          >
            Retry Delete
          </button>
          <span class="text-error-500 text-xs">
            {O.getOrElse(deleteError, () => ({ message: 'Delete error' })).message}
          </span>
        </div>
      {:else}
        <button 
          class="variant-filled-error btn btn-sm" 
          onclick={handleDelete}
        >
          Delete
        </button>
      {/if}
    </div>
  {/if}
</div>
