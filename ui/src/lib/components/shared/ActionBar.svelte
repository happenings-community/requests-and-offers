<script lang="ts">
  import { page } from '$app/stores';
  import administrationStore from '@stores/administration.store.svelte';
  import { AdministrationEntity, type StatusInDHT, type StatusType } from '@lib/types/holochain';
  import type { Revision, UIUser, UIOrganization } from '@lib/types/ui';
  import { decodeRecords, queueAndReverseModal } from '@utils';
  import { getModalStore, type ModalComponent, type ModalSettings } from '@skeletonlabs/skeleton';
  import type { ConfirmModalMeta, PromptModalMeta } from '@lib/types/ui';
  import PromptModal from '@components/shared/dialogs/PromptModal.svelte';
  import ConfirmModal from '@components/shared/dialogs/ConfirmModal.svelte';
  import StatusHistoryModal from '@components/shared/status/StatusHistoryModal.svelte';

  type Props = {
    entity: UIUser | UIOrganization;
  };
  const { entity }: Props = $props();

  const modalStore = getModalStore();
  const { administrators } = $derived(administrationStore);
  let isTheOnlyAdmin = $derived(administrators.length === 1);
  const entityType =
    'user_type' in entity ? AdministrationEntity.Users : AdministrationEntity.Organizations;

  let userStatus: StatusInDHT | null = $state(null);

  async function loadStatusRecord() {
    if (entity?.original_action_hash) {
      const statusRecord = await administrationStore.getLatestStatusRecordForEntity(
        entity.original_action_hash,
        entityType
      );
      userStatus = statusRecord ? decodeRecords<StatusInDHT>([statusRecord])[0] : null;
    }
  }

  $inspect(entity);
  $inspect(entityType);

  $effect(() => {
    loadStatusRecord();
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

        if (meta.id === 'suspend-temporarily') handleSuspendTemporarily(response.data);
        else handleSuspendIndefinitely(response.data);

        if (entityType === AdministrationEntity.Users) {
          await administrationStore.fetchAllUsers();
        } else {
          await administrationStore.refreshOrganizations();
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
              updateStatus({ status_type: 'accepted' });
              break;
            case 'remove-administrator':
              removeAdministrator();
              break;
            case 'accept-user':
            case 'accept-organization':
              updateStatus({ status_type: 'accepted' });
              break;
            case 'reject-user':
            case 'reject-organization':
              updateStatus({ status_type: 'rejected' });
              break;
          }

          if (entityType === AdministrationEntity.Users) {
            await administrationStore.fetchAllUsers();
          } else {
            await administrationStore.refreshOrganizations();
          }

          modalStore.close();
        }
      }
    };
  };

  const statusHistoryModalComponent: ModalComponent = { ref: StatusHistoryModal };
  const statusHistoryModal = (meta: {
    statusHistory: Revision[];
    title: string;
  }): ModalSettings => {
    return {
      type: 'component',
      component: statusHistoryModalComponent,
      meta
    };
  };

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

    if (entityType === AdministrationEntity.Users) {
      administrationStore.updateUserStatus(
        entity.original_action_hash!,
        entity.status?.original_action_hash!,
        entity.status?.previous_action_hash!,
        { status_type: statusType }
      );
    } else if (entityType === AdministrationEntity.Organizations) {
      administrationStore.updateOrganizationStatus(
        entity.original_action_hash!,
        entity.status?.original_action_hash!,
        entity.status?.previous_action_hash!,
        { status_type: statusType }
      );
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
    queueAndReverseModal(
      statusHistoryModal({
        statusHistory: await administrationStore.getAllRevisionsForStatus(entity),
        title: `${entityType === AdministrationEntity.Users ? 'User' : 'Organization'} Status History`
      }),
      modalStore
    );
  }

  async function removeAdministrator() {
    if (entityType === AdministrationEntity.Users) {
      await administrationStore.removeNetworkAdministrator(entity.original_action_hash!);
    }
  }

  async function handleSuspendIndefinitely(data: FormData) {
    const reason = data.get('reason') as string;

    if (!entity.original_action_hash || !entity.previous_action_hash) return;

    if (entityType === AdministrationEntity.Users) {
      await administrationStore.suspendUserIndefinitely(
        entity.original_action_hash!,
        entity.status?.original_action_hash!,
        entity.status?.previous_action_hash!,
        reason
      );
    } else {
      await administrationStore.suspendOrganizationIndefinitely(
        entity.original_action_hash!,
        entity.status?.original_action_hash!,
        entity.status?.previous_action_hash!,
        reason
      );
    }

    modalStore.close();
  }

  async function handleSuspendTemporarily(data: FormData) {
    const reason = data.get('reason') as string;
    const duration = parseInt(data.get('duration') as string, 10);

    if (!entity.original_action_hash || !entity.previous_action_hash) return;

    if (entityType === AdministrationEntity.Users) {
      await administrationStore.suspendUserTemporarily(
        entity.original_action_hash!,
        entity.status?.original_action_hash!,
        entity.status?.previous_action_hash!,
        reason,
        duration
      );
    } else {
      await administrationStore.suspendOrganizationTemporarily(
        entity.original_action_hash!,
        entity.status?.original_action_hash!,
        entity.status?.previous_action_hash!,
        reason,
        duration
      );
    }

    modalStore.close();
  }
</script>

<div class="flex flex-wrap items-center justify-center gap-4">
  {#if $page.url.pathname === '/admin/administrators'}
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
    {#if userStatus?.status_type === 'pending'}
      <button class="btn variant-filled-success rounded-lg" onclick={handleAcceptModal}>
        Accept
      </button>
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
