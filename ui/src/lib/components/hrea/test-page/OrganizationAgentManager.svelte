<script lang="ts">
  import hreaStore from '$lib/stores/hrea.store.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import type { Agent } from '$lib/types/hrea';
  import { runEffect } from '$lib/utils/effect';
  import { encodeHashToBase64 } from '@holochain/client';

  $effect(() => {
    console.log(
      'OrganizationAgentManager: Effect - mappings size changed to:',
      hreaStore.organizationAgentMappings.size
    );
    // Refresh agents when mappings change to ensure UI stays in sync
    if (hreaStore.organizationAgentMappings.size > 0) {
      runEffect(hreaStore.getAllAgents());
    }
  });

  $effect(() => {
    runEffect(hreaStore.getAllAgents());
  });

  $effect(() => {
    administrationStore.fetchAllOrganizations();
  });

  // Effect to create retroactive mappings when both organizations and agents are available
  $effect(() => {
    const allOrganizations = administrationStore.allOrganizations;
    const organizationAgentMap = hreaStore.organizationAgentMappings;

    if (allOrganizations.length > 0) {
      const unmappedOrganizations = allOrganizations.filter(
        (org) =>
          org.original_action_hash && !organizationAgentMap.has(org.original_action_hash.toString())
      );

      if (unmappedOrganizations.length > 0) {
        console.log(
          `OrganizationAgentManager: Found ${unmappedOrganizations.length} unmapped organizations. Attempting retroactive mapping.`
        );
        runEffect(hreaStore.createRetroactiveMappings([], unmappedOrganizations));
      }
    }
  });

  let agentsWithOrganizations = $derived.by(() => {
    const organizationAgentMap = hreaStore.organizationAgentMappings;
    const allOrganizations = administrationStore.allOrganizations;
    const allAgents = hreaStore.agents;

    console.log('OrganizationAgentManager: Computing agentsWithOrganizations');
    console.log(
      `OrganizationAgentManager: Found ${organizationAgentMap.size} mappings, ${allOrganizations.length} organizations, ${allAgents.length} agents`
    );

    // Create a reverse map from agentId to organizationHash
    const agentOrganizationMap = new Map<string, string>();
    for (const [organizationHash, agentId] of organizationAgentMap.entries()) {
      agentOrganizationMap.set(agentId, organizationHash);
    }

    if (organizationAgentMap.size > 0) {
      console.log(
        'OrganizationAgentManager: Active mappings found:',
        Object.fromEntries(organizationAgentMap)
      );
      console.log(
        'OrganizationAgentManager: Reverse map:',
        Object.fromEntries(agentOrganizationMap)
      );
      console.log(
        'OrganizationAgentManager: Available agent IDs:',
        allAgents.map((a) => a.id)
      );
    }

    // Filter agents to only show organization agents and enrich with organization info
    return allAgents
      .filter((agent: Agent) => agentOrganizationMap.has(agent.id))
      .map((agent: Agent) => {
        const organizationHash = agentOrganizationMap.get(agent.id);
        const organization = organizationHash
          ? allOrganizations.find(
              (o) =>
                o.original_action_hash && o.original_action_hash.toString() === organizationHash
            )
          : undefined;
        return {
          ...agent,
          organization
        };
      });
  });

  // Statistics
  const stats = $derived.by(() => {
    const totalOrgs = administrationStore.allOrganizations.length;
    const mappedOrgs = hreaStore.organizationAgentMappings.size;
    const unmappedOrgs = totalOrgs - mappedOrgs;

    return {
      total: totalOrgs,
      mapped: mappedOrgs,
      unmapped: unmappedOrgs,
      mappingPercentage: totalOrgs > 0 ? Math.round((mappedOrgs / totalOrgs) * 100) : 0
    };
  });
</script>

<div class="card space-y-4 p-4">
  <h3 class="h3">🏢 Organization Agents</h3>
  <p class="!text-sm">
    Organization agents are automatically created when organizations are created or updated.
  </p>

  <!-- Statistics -->
  <div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4">
    <div class="card variant-filled-primary p-3 text-center">
      <div class="text-lg font-bold text-white">{stats.total}</div>
      <div class="text-sm text-white opacity-75">Total Organizations</div>
    </div>
    <div class="card variant-filled-success p-3 text-center">
      <div class="text-lg font-bold text-white">{stats.mapped}</div>
      <div class="text-sm text-white opacity-75">Mapped</div>
    </div>
    <div class="card variant-filled-warning p-3 text-center">
      <div class="text-lg font-bold text-white">{stats.unmapped}</div>
      <div class="text-sm text-white opacity-75">Unmapped</div>
    </div>
    <div class="card variant-filled-secondary p-3 text-center">
      <div class="text-lg font-bold text-white">{stats.mappingPercentage}%</div>
      <div class="text-sm text-white opacity-75">Coverage</div>
    </div>
  </div>

  {#if hreaStore.loading && agentsWithOrganizations.length === 0}
    <div class="flex items-center justify-center p-4">
      <span class="loading-spinner" aria-label="Loading"></span>
    </div>
  {:else if agentsWithOrganizations.length > 0}
    <div class="table-container">
      <table class="table table-hover">
        <thead>
          <tr>
            <th>Agent ID</th>
            <th>Name</th>
            <th>Associated Organization</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {#each agentsWithOrganizations as agent (agent.id)}
            <tr>
              <td class="font-mono text-xs">...{agent.id.slice(-8)}</td>
              <td>{agent.name}</td>
              <td>
                {#if agent.organization}
                  <a
                    href={`/organizations/${encodeHashToBase64(agent.organization.original_action_hash!)}`}
                    class="text-primary-400 hover:text-primary-300 hover:underline"
                  >
                    {agent.organization.name}
                  </a>
                {:else}
                  <span class="italic text-gray-500">N/A</span>
                {/if}
              </td>
              <td class="italic">{agent.note || '-'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="text-center text-gray-500">No Organization agents found.</p>
  {/if}

  <!-- Debug Information -->
  <details class="mt-4">
    <summary class="cursor-pointer text-sm font-bold">Debug Information</summary>
    <div class="mt-2 space-y-2 text-sm">
      <p><strong>Total Organizations:</strong> {administrationStore.allOrganizations.length}</p>
      <p><strong>Total Agents:</strong> {hreaStore.agents.length}</p>
      <p><strong>Organization Mappings:</strong> {hreaStore.organizationAgentMappings.size}</p>
      <div class="mt-4">
        <h5 class="font-bold">Organization Agent Mappings:</h5>
        <pre class="bg-surface-100-800-token mt-2 max-h-32 overflow-auto rounded p-2 text-xs">
{JSON.stringify(Object.fromEntries(hreaStore.organizationAgentMappings), null, 2)}
        </pre>
      </div>
    </div>
  </details>
</div>
