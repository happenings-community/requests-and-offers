<script lang="ts">
  import hreaStore from '$lib/stores/hrea.store.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import type { Agent } from '$lib/types/hrea';
  import { runEffect } from '$lib/utils/effect';
  import { decodeHashFromBase64, encodeHashToBase64 } from '@holochain/client';

  $effect(() => {
    console.log(
      'PersonAgentManager: Effect - mappings size changed to:',
      hreaStore.userAgentMappings.size
    );
  });

  $effect(() => {
    runEffect(hreaStore.getAllAgents());
  });

  $effect(() => {
    administrationStore.fetchAllUsers();
  });

  // Effect to create retroactive mappings when both users and agents are available
  $effect(() => {
    const allUsers = administrationStore.allUsers;
    const userAgentMap = hreaStore.userAgentMappings;

    if (allUsers.length > 0) {
      const unmappedUsers = allUsers.filter(
        (user) =>
          user.original_action_hash && !userAgentMap.has(user.original_action_hash.toString())
      );

      if (unmappedUsers.length > 0) {
        console.log(
          `PersonAgentManager: Found ${unmappedUsers.length} unmapped users. Attempting retroactive mapping.`
        );
        runEffect(hreaStore.createRetroactiveMappings(unmappedUsers));
      }
    }
  });

  let agentsWithUsers = $derived.by(() => {
    const userAgentMap = hreaStore.userAgentMappings;
    const allUsers = administrationStore.allUsers;
    const allAgents = hreaStore.agents;

    console.log('PersonAgentManager: Computing agentsWithUsers');
    console.log(
      `PersonAgentManager: Found ${userAgentMap.size} mappings, ${allUsers.length} users, ${allAgents.length} agents`
    );

    // Create a reverse map from agentId to userHash
    const agentUserMap = new Map<string, string>();
    for (const [userHash, agentId] of userAgentMap.entries()) {
      agentUserMap.set(agentId, userHash);
    }

    if (userAgentMap.size > 0) {
      console.log('PersonAgentManager: Active mappings found:', Object.fromEntries(userAgentMap));
    }

    // Enrich agents with user info
    return allAgents.map((agent: Agent) => {
      const userHash = agentUserMap.get(agent.id);
      const user = userHash
        ? allUsers.find(
            (u) => u.original_action_hash && u.original_action_hash.toString() === userHash
          )
        : undefined;
      return {
        ...agent,
        user
      };
    });
  });
</script>

<div class="card space-y-4 p-4">
  <h3 class="h3">👤 Person Agents</h3>
  <p class="!text-sm">
    Person agents are automatically created when a new user profile is created.
  </p>

  {#if hreaStore.loading && agentsWithUsers.length === 0}
    <div class="flex items-center justify-center p-4">
      <span class="loading-spinner" aria-label="Loading"></span>
    </div>
  {:else if agentsWithUsers.length > 0}
    <div class="table-container">
      <table class="table-hover table">
        <thead>
          <tr>
            <th>Agent ID</th>
            <th>Name</th>
            <th>Associated User</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {#each agentsWithUsers as agent (agent.id)}
            <tr>
              <td class="font-mono text-xs">...{agent.id.slice(-8)}</td>
              <td>{agent.name}</td>
              <td>
                {#if agent.user}
                  <a
                    href={`/users/${encodeHashToBase64(agent.user.original_action_hash!)}`}
                    class="text-primary-400 hover:text-primary-300 hover:underline"
                  >
                    {agent.user.name}
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
    <p class="text-center text-gray-500">No Person agents found.</p>
  {/if}
</div>
