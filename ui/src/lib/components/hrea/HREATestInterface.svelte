<script lang="ts">
  import PersonAgentManager from '$lib/components/hrea/test-page/PersonAgentManager.svelte';
  import OrganizationAgentManager from '$lib/components/hrea/test-page/OrganizationAgentManager.svelte';
  import ResourceSpecManager from '$lib/components/hrea/test-page/ResourceSpecManager.svelte';
  import MediumOfExchangeResourceSpecManager from '$lib/components/hrea/test-page/MediumOfExchangeResourceSpecManager.svelte';
  import ProposalManager from '$lib/components/hrea/test-page/ProposalManager.svelte';
  import IntentManager from '$lib/components/hrea/test-page/IntentManager.svelte';
  import hreaStore from '$lib/stores/hrea.store.svelte';
  import { TabGroup, Tab } from '@skeletonlabs/skeleton';

  let tabSet: number = 0;
  let agentSubTab: number = 0;
  let resourceSpecSubTab: number = 0;
</script>

<div class="card mt-4 space-y-4 p-6">
  <div class="space-y-2">
    <h2 class="h2">🌐 hREA Entity Explorer</h2>
    <p class="text-surface-600-300-token">
      Explore and manage different types of hREA entities in the system.
    </p>
  </div>

  {#if hreaStore.error}
    <div class="alert variant-filled-error">
      <div class="alert-message">
        <h3 class="h4">Error</h3>
        <p>{hreaStore.error.message}</p>
      </div>
    </div>
  {/if}

  <TabGroup>
    <Tab bind:group={tabSet} name="agents" value={0}>
      <svelte:fragment slot="lead">
        <i class="fa-solid fa-users text-lg"></i>
      </svelte:fragment>
      Agents
    </Tab>
    <Tab bind:group={tabSet} name="resource-specs" value={1}>
      <svelte:fragment slot="lead">
        <i class="fa-solid fa-list-check text-lg"></i>
      </svelte:fragment>
      Resource Specifications
    </Tab>
    <Tab bind:group={tabSet} name="proposals" value={2}>
      <svelte:fragment slot="lead">
        <i class="fa-solid fa-handshake text-lg"></i>
      </svelte:fragment>
      Proposals
    </Tab>
    <Tab bind:group={tabSet} name="intents" value={3}>
      <svelte:fragment slot="lead">
        <i class="fa-solid fa-bullseye text-lg"></i>
      </svelte:fragment>
      Intents
    </Tab>

    <!-- Tab Panels -->
    <svelte:fragment slot="panel">
      {#if tabSet === 0}
        <!-- Agents Section with Sub-tabs -->
        <div class="space-y-4">
          <div class="mb-4 flex items-center gap-2">
            <i class="fa-solid fa-users text-primary-500"></i>
            <h3 class="h3">Agent Management</h3>
          </div>

          <TabGroup>
            <Tab bind:group={agentSubTab} name="person-agents" value={0}>
              <svelte:fragment slot="lead">
                <i class="fa-solid fa-user text-base"></i>
              </svelte:fragment>
              Person Agents
            </Tab>
            <Tab bind:group={agentSubTab} name="org-agents" value={1}>
              <svelte:fragment slot="lead">
                <i class="fa-solid fa-building text-base"></i>
              </svelte:fragment>
              Organization Agents
            </Tab>

            <!-- Agent Sub-tab Panels -->
            <svelte:fragment slot="panel">
              {#if agentSubTab === 0}
                <div class="space-y-4">
                  <PersonAgentManager />
                </div>
              {:else if agentSubTab === 1}
                <div class="space-y-4">
                  <OrganizationAgentManager />
                </div>
              {/if}
            </svelte:fragment>
          </TabGroup>
        </div>
      {:else if tabSet === 1}
        <!-- Resource Specifications Section with Sub-tabs -->
        <div class="space-y-4">
          <div class="mb-4 flex items-center gap-2">
            <i class="fa-solid fa-list-check text-primary-500"></i>
            <h3 class="h3">Resource Specification Management</h3>
          </div>
          <p class="text-surface-600-300-token mb-4 !text-sm">
            Resource specifications define the types of resources (skills, materials, currencies,
            etc.) that can be exchanged. They are automatically created from approved Service Types
            and Mediums of Exchange.
          </p>

          <TabGroup>
            <Tab bind:group={resourceSpecSubTab} name="service-type-specs" value={0}>
              <svelte:fragment slot="lead">
                <i class="fa-solid fa-tags text-base"></i>
              </svelte:fragment>
              Service Types
            </Tab>
            <Tab bind:group={resourceSpecSubTab} name="moe-specs" value={1}>
              <svelte:fragment slot="lead">
                <i class="fa-solid fa-coins text-base"></i>
              </svelte:fragment>
              Mediums of Exchange
            </Tab>

            <!-- Resource Spec Sub-tab Panels -->
            <svelte:fragment slot="panel">
              {#if resourceSpecSubTab === 0}
                <div class="space-y-4">
                  <div class="mb-4">
                    <h4 class="h4 mb-2">Service Type → Resource Specifications</h4>
                    <p class="text-surface-600-300-token !text-sm">
                      Service types (skills) are mapped to hREA Resource Specifications to enable
                      economic modeling.
                    </p>
                  </div>
                  <ResourceSpecManager />
                </div>
              {:else if resourceSpecSubTab === 1}
                <div class="space-y-4">
                  <div class="mb-4">
                    <h4 class="h4 mb-2">Medium of Exchange → Resource Specifications</h4>
                    <p class="text-surface-600-300-token !text-sm">
                      Mediums of exchange (currencies) are mapped to hREA Resource Specifications to
                      enable value exchange modeling.
                    </p>
                  </div>
                  <MediumOfExchangeResourceSpecManager />
                </div>
              {/if}
            </svelte:fragment>
          </TabGroup>
        </div>
      {:else if tabSet === 2}
        <!-- Proposals Section -->
        <div class="space-y-4">
          <div class="mb-4 flex items-center gap-2">
            <i class="fa-solid fa-handshake text-primary-500"></i>
            <h3 class="h3">Proposal Management</h3>
          </div>
          <p class="text-surface-600-300-token mb-4 !text-sm">
            Proposals are economic offers created automatically from requests and offers. Each
            proposal contains multiple intents following the two-intent reciprocal pattern for
            complete value exchange.
          </p>
          <ProposalManager />
        </div>
      {:else if tabSet === 3}
        <!-- Intents Section -->
        <div class="space-y-4">
          <div class="mb-4 flex items-center gap-2">
            <i class="fa-solid fa-bullseye text-primary-500"></i>
            <h3 class="h3">Intent Management</h3>
          </div>
          <p class="text-surface-600-300-token mb-4 !text-sm">
            Intents represent individual economic actions within proposals. They define who provides
            what to whom, forming the building blocks of the economic network.
          </p>
          <IntentManager />
        </div>
      {/if}
    </svelte:fragment>
  </TabGroup>
</div>
