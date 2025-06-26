<script lang="ts">
  import '@/app.css';
  import { onMount, type Snippet } from 'svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import hc from '$lib/services/HolochainClientService.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import { Modal, Drawer, Toast, getDrawerStore, getModalStore, getToastStore, type ModalComponent, type ModalSettings } from '@skeletonlabs/skeleton';
  import { initializeStores } from '@skeletonlabs/skeleton';
  import { goto } from '$app/navigation';
  import { computePosition, autoUpdate, offset, shift, flip, arrow } from '@floating-ui/dom';
  import { storePopup } from '@skeletonlabs/skeleton';
  import { page } from '$app/state';
  import AdminMenuDrawer from '$lib/components/shared/drawers/AdminMenuDrawer.svelte';
  import MenuDrawer from '$lib/components/shared/drawers/MenuDrawer.svelte';
  import ConfirmModal from '$lib/components/shared/dialogs/ConfirmModal.svelte';
  import type { ConfirmModalMeta } from '$lib/types/ui';

  type Props = {
    children: Snippet;
  };

  const { children } = $props() as Props;

  const { currentUser } = $derived(usersStore);
  const { agentIsAdministrator, administrators } = $derived(administrationStore);

  storePopup.set({ computePosition, autoUpdate, offset, shift, flip, arrow });

  initializeStores();
  const drawerStore = getDrawerStore();
  const modalStore = getModalStore();
  const toastStore = getToastStore();

  /* This admin registration process is temporary. It simulates the Holochain Progenitor pattern by allowing only the first user to become administrator when no administrators exist. */

  const confirmModalComponent: ModalComponent = { ref: ConfirmModal };

  async function showProgenitorAdminRegistrationModal() {
    // First, check if there are already administrators
    try {
      const hasAdmins = await administrationStore.hasExistingAdministrators();
      if (hasAdmins) return;
    } catch (error) {
      console.error('Error checking administrators:', error);
      toastStore.trigger({
        message: 'Error checking administrator status. Please try again.',
        background: 'variant-filled-error',
        autohide: true,
        timeout: 5000
      });
      return;
    }

    // If no administrators exist, allow this user to become the first administrator
    const adminRegistrationModalMeta: ConfirmModalMeta = {
      id: 'progenitor-admin-registration',
      message: 'No administrators exist in this network yet.<br/><br/>As the first user, you can become the initial administrator (Progenitor).<br/><br/>Do you want to become the network administrator?',
      confirmLabel: 'Become Administrator',
      cancelLabel: 'Cancel'
    };

    const modal: ModalSettings = {
      type: 'component',
      component: confirmModalComponent,
      meta: adminRegistrationModalMeta,
      response: async (confirmed: boolean) => {
        if (!confirmed) {
          modalStore.close();
          return;
        }

        if (currentUser?.original_action_hash) {
          try {
            const agentPubKey = (await hc.getAppInfo())?.agent_pub_key;
            if (agentPubKey) {
              const result = await administrationStore.registerNetworkAdministrator(
                currentUser.original_action_hash,
                [agentPubKey]
              );
              
              if (result) {
                await administrationStore.getAllNetworkAdministrators();
                administrationStore.agentIsAdministrator = true;
                toastStore.trigger({
                  message: 'Successfully registered as the network administrator!',
                  background: 'variant-filled-success',
                  autohide: true,
                  timeout: 5000
                });
              } else {
                toastStore.trigger({
                  message: 'Failed to register as administrator. Please try again.',
                  background: 'variant-filled-error',
                  autohide: true,
                  timeout: 5000
                });
              }
            }
          } catch (error) {
            console.error('Error registering administrator:', error);
            toastStore.trigger({
              message: 'Error occurred while registering as administrator.',
              background: 'variant-filled-error',
              autohide: true,
              timeout: 5000
            });
          }
        }
        
        modalStore.close();
      }
    };

    modalStore.trigger(modal);
  }

  onMount(async () => {
    await hc.connectClient();
    const record = await hc.callZome('misc', 'ping', null);

    const agentPubKey = (await hc.getAppInfo())?.agent_pub_key;
    if (agentPubKey) {
      await administrationStore.getAllNetworkAdministrators();
      await administrationStore.checkIfAgentIsAdministrator();
    }

    await usersStore.refresh();

    console.log('Ping response:', record);
    console.log('clientInfo :', hc.client);
    console.log('appInfo :', await hc.getAppInfo());
  });

  async function handleKeyboardEvent(event: KeyboardEvent) {
    if (agentIsAdministrator && event.altKey && (event.key === 'a' || event.key === 'A')) {
      event.preventDefault();
      if (!window.location.pathname.startsWith('/admin')) goto('/admin');
      else goto('/');
    }

    if (
      currentUser &&
      !agentIsAdministrator &&
      event.ctrlKey &&
      event.shiftKey &&
      (event.key === 'a' || event.key === 'A')
    ) {
      event.preventDefault();
      showProgenitorAdminRegistrationModal();
    }
  }
</script>

<svelte:window onkeydown={handleKeyboardEvent} />

{@render children()}

<Modal />
<Toast />
<Drawer>
  {#if $drawerStore.id === 'menu-drawer'}
    {#if page.url.pathname.startsWith('/admin')}
      <AdminMenuDrawer />
    {:else}
      <MenuDrawer />
    {/if}
  {/if}
</Drawer>
