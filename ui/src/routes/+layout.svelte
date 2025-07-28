<script lang="ts">
  import '@/app.css';
  import { onMount, type Snippet } from 'svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import hc from '$lib/services/HolochainClientService.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import {
    Modal,
    Drawer,
    Toast,
    getDrawerStore,
    getModalStore,
    getToastStore,
    type ModalComponent,
    type ModalSettings,
    ConicGradient,
    type ConicStop
  } from '@skeletonlabs/skeleton';
  import { initializeStores } from '@skeletonlabs/skeleton';
  import { goto } from '$app/navigation';
  import { computePosition, autoUpdate, offset, shift, flip, arrow } from '@floating-ui/dom';
  import { storePopup } from '@skeletonlabs/skeleton';
  import { page } from '$app/state';
  import AdminMenuDrawer from '$lib/components/shared/drawers/AdminMenuDrawer.svelte';
  import MenuDrawer from '$lib/components/shared/drawers/MenuDrawer.svelte';
  import ConfirmModal from '$lib/components/shared/dialogs/ConfirmModal.svelte';
  import type { ConfirmModalMeta } from '$lib/types/ui';
  import hreaStore from '$lib/stores/hrea.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { Effect as E } from 'effect';

  type Props = {
    children: Snippet;
  };

  const { children } = $props() as Props;

  const currentUser = $derived(usersStore.currentUser);
  const agentIsAdministrator = $derived(administrationStore.agentIsAdministrator);

  storePopup.set({ computePosition, autoUpdate, offset, shift, flip, arrow });

  initializeStores();
  const drawerStore = getDrawerStore();
  const modalStore = getModalStore();
  const toastStore = getToastStore();

  /* This admin registration process is temporary. It simulates the Holochain Progenitor pattern by allowing only the first user to become administrator when no administrators exist. */
  const conicStops: ConicStop[] = [
    { color: 'transparent', start: 0, end: 0 },
    { color: 'rgb(var(--color-primary-500))', start: 75, end: 50 }
  ];

  const confirmModalComponent: ModalComponent = { ref: ConfirmModal };

  async function showProgenitorAdminRegistrationModal() {
    // First, check if there are already administrators
    try {
      const admins = await runEffect(administrationStore.getAllNetworkAdministrators());
      const hasAdmins = admins.length > 0;
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
      message: `
        <div class="text-center space-y-4">
          <div class="text-warning-500">
            <svg class="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
            </svg>
          </div>
          <div class="space-y-3">
            <h3 class="text-lg font-semibold text-surface-100">Network Initialization</h3>
            <p class="text-surface-300">No administrators exist in this network yet.</p>
            <div class="bg-primary-500/10 border border-primary-500/20 rounded-lg p-3">
              <p class="text-primary-300 text-sm font-medium">🌟 Progenitor Opportunity</p>
              <p class="text-surface-200 text-sm mt-1">As the first user, you can become the initial administrator and help establish this community.</p>
            </div>
            <p class="text-surface-100 font-medium">Do you want to become the network administrator?</p>
          </div>
        </div>
      `,
      confirmLabel: '✨ Become Administrator',
      cancelLabel: 'Not Now'
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
              const result = await runEffect(
                administrationStore.registerNetworkAdministrator(currentUser.original_action_hash, [
                  agentPubKey
                ])
              );

              if (result) {
                await runEffect(administrationStore.getAllNetworkAdministrators());
                // Refresh administrator status after successful registration
                await runEffect(administrationStore.checkIfAgentIsAdministrator());
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

    // Initialize hREA service
    try {
      await runEffect(hreaStore.initialize());
      console.log('hREA initialized successfully');
    } catch (error) {
      console.warn('hREA initialization failed (non-critical):', error);
    }

    const record = await hc.callZome('misc', 'ping', null);

    const agentPubKey = (await hc.getAppInfo())?.agent_pub_key;
    if (agentPubKey) {
      await runEffect(administrationStore.getAllNetworkAdministrators());
      console.log('network administrators :', administrationStore.administrators.length);
      await runEffect(administrationStore.checkIfAgentIsAdministrator());
    }

    await runEffect(usersStore.refresh());

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

{#if !hc.isConnected}
  <div class="flex min-h-screen flex-col items-center justify-center">
    <p>Connecting to Holochain...</p>
    <ConicGradient stops={conicStops} spin>Loading</ConicGradient>
  </div>
{:else}
  {@render children()}
{/if}

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
