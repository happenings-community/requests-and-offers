<script lang="ts">
  import { page } from '$app/state';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import { AdministrationEntity, type StatusType } from '$lib/types/holochain';
  import type { UIUser, UIOrganization, UIStatus } from '$lib/types/ui';
  import { queueAndReverseModal } from '$lib/utils';
  import { Effect as E } from 'effect';
  import {
    getModalStore,
    getToastStore,
    type ModalComponent,
    type ModalSettings
  } from '@skeletonlabs/skeleton';
  import type { ConfirmModalMeta, PromptModalMeta } from '$lib/types/ui';
  import PromptModal from '$lib/components/shared/dialogs/PromptModal.svelte';
  import ConfirmModal from '$lib/components/shared/dialogs/ConfirmModal.svelte';
  import StatusHistoryModal from '$lib/components/shared/status/StatusHistoryModal.svelte';
  import { storeEventBus } from '$lib/stores/storeEvents';
  import { onMount } from 'svelte';

  type Props = {
    entity: UIUser | UIOrganization;
  };
  const { entity }: Props = $props();

  const modalStore = getModalStore();
  const toastStore = getToastStore();
  const { administrators } = $derived(administrationStore);
  let isTheOnlyAdmin = $derived(administrators.length === 1);
  const entityType =
    'user_type' in entity ? AdministrationEntity.Users : AdministrationEntity.Organizations;

  let userStatus: UIStatus | null = $state(null);

  $inspect(userStatus);

  async function loadStatusRecord() {
    if (entity?.original_action_hash) {
      const statusRecord = await E.runPromise(
        administrationStore.getLatestStatusForEntity(entity.original_action_hash, entityType)
      );
      userStatus = statusRecord ?? null;
    }
  }

  $inspect(entity);
  $inspect(entityType);

  $effect(() => {
    loadStatusRecord();
  });

  onMount(() => {
    // Listen for status update events
    const unsubscribeUser = storeEventBus.on('user:status:updated', (event) => {
      console.log('Debug ActionBar - User status update event received:', event);
      if (
        entityType === AdministrationEntity.Users &&
        event.user.original_action_hash === entity.original_action_hash
      ) {
        console.log('Debug ActionBar - Refreshing status for current user');
        loadStatusRecord();
      }
    });

    const unsubscribeOrg = storeEventBus.on('organization:status:updated', (event) => {
      console.log('Debug ActionBar - Organization status update event received:', event);
      if (
        entityType === AdministrationEntity.Organizations &&
        event.organization.original_action_hash === entity.original_action_hash
      ) {
        console.log('Debug ActionBar - Refreshing status for current organization');
        loadStatusRecord();
      }
    });

    return () => {
      unsubscribeUser();
      unsubscribeOrg();
    };
  });

  const suspendTemporarilyModalMeta: PromptModalMeta = $derived({
    id: 'suspend-temporarily',
    message: `What is the reason and duration of suspension for this ${entityType === AdministrationEntity.Users ? 'user' : 'organization'}?`,
    inputs: [
      {
        name: 'reason',
        label: 'Reason',
        type: 'text',
        placeholder: 'Enter a reason',
        required: true
      },
      {
        name: 'duration',
        label: 'Number of days',
        type: 'number',
        placeholder: 'Number of days',
        value: '1',
        min: 1,
        max: 365,
        required: true
      }
    ]
  });

  const suspendIndefinitelyModalMeta: PromptModalMeta = $derived({
    id: 'suspend-indefinitely',
    message: `What is the reason of the suspension for this ${entityType === AdministrationEntity.Users ? 'user' : 'organization'}?`,
    inputs: [
      {
        name: 'reason',
        label: 'Reason',
        type: 'text',
        placeholder: 'Enter a reason',
        required: true
      }
    ]
  });

  const promptModalComponent: ModalComponent = { ref: PromptModal };
  const promptModal = (meta: PromptModalMeta): ModalSettings => {
    return {
      type: 'component',
      component: promptModalComponent,
      meta,
      response: async (response) => {
        if (!response) return;

        if (meta.id === 'suspend-temporarily') {
          await handleSuspendTemporarily(response.data);
        } else {
          await handleSuspendIndefinitely(response.data);
        }

        // Refresh the entity list after suspension
        if (entityType === AdministrationEntity.Users) {
          await E.runPromise(administrationStore.fetchAllUsers());
        } else {
          await E.runPromise(administrationStore.fetchAllOrganizations());
        }

        modalStore.close();
      }
    };
  };

  const confirmModalComponent: ModalComponent = { ref: ConfirmModal };
  const confirmModal = (meta: ConfirmModalMeta): ModalSettings => {
    return {
      type: 'component',
      component: confirmModalComponent,
      meta,
      response: async (r) => {
        if (r) {
          switch (meta.id) {
            case 'unsuspend':
              await updateStatus({ status_type: 'accepted' });
              break;
            case 'remove-administrator':
              await removeAdministrator();
              break;
            case 'accept-user':
            case 'accept-organization':
              await updateStatus({ status_type: 'accepted' });
              break;
            case 'reject-user':
            case 'reject-organization':
              await updateStatus({ status_type: 'rejected' });
              break;
          }

          // Refresh the entity list after status update
          if (entityType === AdministrationEntity.Users) {
            await E.runPromise(administrationStore.fetchAllUsers());
          } else {
            await E.runPromise(administrationStore.fetchAllOrganizations());
          }

          modalStore.close();
        }
      }
    };
  };

  function statusHistoryModal(history: UIStatus[]): ModalSettings {
    return {
      type: 'component',
      component: { ref: StatusHistoryModal },
      meta: {
        statusHistory: history,
        title: `${entityType === AdministrationEntity.Users ? 'User' : 'Organization'} Status History`
      }
    };
  }

  function handleAcceptModal() {
    queueAndReverseModal(
      confirmModal({
        id: entityType === AdministrationEntity.Users ? 'accept-user' : 'accept-organization',
        message: `Are you sure you want to accept this ${entityType === AdministrationEntity.Users ? 'user' : 'organization'}?`,
        confirmLabel: 'Yes',
        cancelLabel: 'No'
      }),
      modalStore
    );
  }

  function handleRejectModal() {
    queueAndReverseModal(
      confirmModal({
        id: entityType === AdministrationEntity.Users ? 'reject-user' : 'reject-organization',
        message: `Are you sure you want to reject this ${entityType === AdministrationEntity.Users ? 'user' : 'organization'}?`,
        confirmLabel: 'Yes',
        cancelLabel: 'No'
      }),
      modalStore
    );
  }

  function handleUnsuspendModal() {
    queueAndReverseModal(
      confirmModal({
        id: 'unsuspend',
        message: `Are you sure you want to unsuspend this ${entityType === AdministrationEntity.Users ? 'user' : 'organization'}?`,
        confirmLabel: 'Yes',
        cancelLabel: 'No'
      }),
      modalStore
    );
  }

  function handlePromptModal(type: 'indefinitely' | 'temporarily') {
    queueAndReverseModal(
      promptModal(
        type === 'indefinitely' ? suspendIndefinitelyModalMeta : suspendTemporarilyModalMeta
      ),
      modalStore
    );
  }

  async function updateStatus(newStatus: { status_type: string }) {
    const statusType = newStatus.status_type as StatusType;

    console.log('Debug ActionBar - updateStatus called:', {
      statusType,
      entity: entity.original_action_hash,
      userStatus,
      entityStatus: entity.status
    });

    if (!userStatus?.original_action_hash) {
      console.error('Debug ActionBar - No status information available');
      toastStore.trigger({
        message: 'Status information is missing. Please refresh and try again.',
        background: 'variant-filled-error'
      });
      return;
    }

    try {
      const previousActionHash = userStatus.previous_action_hash || userStatus.original_action_hash;

      if (entityType === AdministrationEntity.Users) {
        await E.runPromise(
          administrationStore.updateUserStatus(
            entity.original_action_hash!,
            userStatus.original_action_hash,
            previousActionHash,
            { status_type: statusType }
          )
        );
      } else if (entityType === AdministrationEntity.Organizations) {
        await E.runPromise(
          administrationStore.updateOrganizationStatus(
            entity.original_action_hash!,
            userStatus.original_action_hash,
            previousActionHash,
            { status_type: statusType }
          )
        );
      }

      // Refresh the status after update
      await loadStatusRecord();

      // Force refresh of the users/organizations list
      if (entityType === AdministrationEntity.Users) {
        await E.runPromise(administrationStore.fetchAllUsers());
      } else {
        await E.runPromise(administrationStore.fetchAllOrganizations());
      }

      toastStore.trigger({
        message: `${entityType === AdministrationEntity.Users ? 'User' : 'Organization'} status updated successfully.`,
        background: 'variant-filled-success'
      });
    } catch (error) {
      console.error('Debug ActionBar - Error updating status:', error);
      toastStore.trigger({
        message: 'Failed to update status. Please try again.',
        background: 'variant-filled-error'
      });
    }
  }

  function handleRemoveAdminModal() {
    queueAndReverseModal(
      confirmModal({
        id: 'remove-administrator',
        message: 'Do you really want to remove this administrator?',
        confirmLabel: 'Yes',
        cancelLabel: 'No'
      }),
      modalStore
    );
  }

  async function handleStatusHistoryModal() {
    if (!entity?.original_action_hash) return;

    const history = await E.runPromise(administrationStore.getAllRevisionsForStatus(entity));

    modalStore.trigger(statusHistoryModal(history));
    modalStore.update((modals) => modals.reverse());
  }

  async function removeAdministrator() {
    if (entityType === AdministrationEntity.Users) {
      try {
        // Get the actual agent pubkeys for this user
        const agentPubKeys = await E.runPromise(
          usersStore.getUserAgents(entity.original_action_hash!)
        );

        await E.runPromise(
          administrationStore.removeNetworkAdministrator(entity.original_action_hash!, agentPubKeys)
        );
      } catch (error) {
        console.error('Failed to remove administrator:', error);
        toastStore.trigger({
          message: 'Failed to remove administrator. Please try again.',
          background: 'variant-filled-error'
        });
      }
    }
  }

  async function handleSuspendIndefinitely(data: FormData) {
    const reason = data.get('reason') as string;

    if (!entity.original_action_hash || !userStatus?.original_action_hash) return;

    try {
      const previousActionHash = userStatus.previous_action_hash || userStatus.original_action_hash;

      if (entityType === AdministrationEntity.Users) {
        await E.runPromise(
          administrationStore.updateUserStatus(
            entity.original_action_hash!,
            userStatus.original_action_hash,
            previousActionHash,
            { status_type: 'suspended indefinitely', reason }
          )
        );
      } else {
        await E.runPromise(
          administrationStore.updateOrganizationStatus(
            entity.original_action_hash!,
            userStatus.original_action_hash,
            previousActionHash,
            { status_type: 'suspended indefinitely', reason }
          )
        );
      }

      await loadStatusRecord();
      modalStore.close();
    } catch (error) {
      console.error('Error suspending indefinitely:', error);
      toastStore.trigger({
        message: 'Failed to suspend. Please try again.',
        background: 'variant-filled-error'
      });
    }
  }

  async function handleSuspendTemporarily(data: FormData) {
    const reason = data.get('reason') as string;
    const duration = parseInt(data.get('duration') as string, 10);

    if (!entity.original_action_hash || !userStatus?.original_action_hash) return;

    try {
      const suspendedUntil = new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString();
      const previousActionHash = userStatus.previous_action_hash || userStatus.original_action_hash;

      if (entityType === AdministrationEntity.Users) {
        await E.runPromise(
          administrationStore.updateUserStatus(
            entity.original_action_hash!,
            userStatus.original_action_hash,
            previousActionHash,
            {
              status_type: 'suspended temporarily',
              reason,
              suspended_until: suspendedUntil
            }
          )
        );
      } else {
        await E.runPromise(
          administrationStore.updateOrganizationStatus(
            entity.original_action_hash!,
            userStatus.original_action_hash,
            previousActionHash,
            {
              status_type: 'suspended temporarily',
              reason,
              suspended_until: suspendedUntil
            }
          )
        );
      }

      await loadStatusRecord();
      modalStore.close();
    } catch (error) {
      console.error('Error suspending temporarily:', error);
      toastStore.trigger({
        message: 'Failed to suspend. Please try again.',
        background: 'variant-filled-error'
      });
    }
  }
</script>

<div class="flex flex-wrap items-center justify-center gap-4">
  {#if page.url.pathname === '/admin/administrators'}
    <button
      class="btn variant-filled-error rounded-lg"
      onclick={() => handleRemoveAdminModal()}
      disabled={isTheOnlyAdmin}
    >
      Remove as Administrator
    </button>
  {:else}
    <button class="btn variant-filled-tertiary rounded-lg" onclick={handleStatusHistoryModal}>
      Status History
    </button>
    {#if userStatus?.status_type === 'pending' || userStatus?.status_type === 'rejected'}
      <button class="btn variant-filled-success rounded-lg" onclick={handleAcceptModal}>
        Accept
      </button>
    {/if}

    {#if userStatus?.status_type === 'pending'}
      <button class="btn variant-filled-error rounded-lg" onclick={handleRejectModal}>
        Reject
      </button>
    {/if}

    {#if userStatus?.status_type === 'accepted'}
      <button
        class="btn variant-filled-warning rounded-lg"
        onclick={() => handlePromptModal('temporarily')}
      >
        Suspend Temporarily
      </button>
      <button
        class="btn variant-filled-error rounded-lg"
        onclick={() => handlePromptModal('indefinitely')}
      >
        Suspend Indefinitely
      </button>
    {/if}

    {#if userStatus?.status_type?.startsWith('suspended')}
      <button class="btn variant-filled-success rounded-lg" onclick={handleUnsuspendModal}>
        Unsuspend
      </button>
    {/if}
  {/if}
</div>
