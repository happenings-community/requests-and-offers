<script lang="ts">
  import hreaStore from '$lib/stores/hrea.store.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import type { Agent } from '$lib/types/hrea';
  import { runEffect } from '$lib/utils/effect';

  $effect(() => {
    runEffect(hreaStore.getAllAgents());
  });

  let agentsWithUsers = $derived.by(() => {
    const userAgentMap = hreaStore.userAgentMappings;
    const allUsers = administrationStore.allUsers;
    const allAgents = hreaStore.agents;

    // Create a reverse map from agentId to userHash
    const agentUserMap = new Map<string, string>();
    for (const [userHash, agentId] of userAgentMap.entries()) {
      agentUserMap.set(agentId, userHash);
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
                    href={`/users/${agent.user.original_action_hash}`}
                    class="anchor"
                    target="_blank"
                  >
                    {agent.user.nickname}
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

  <div class="space-y-2 pt-4">
    <h4 class="h4">User to Agent Mappings ({hreaStore.userAgentMappings.size}):</h4>
    {#if hreaStore.userAgentMappings.size > 0}
      <pre
        class="bg-surface-100-800-token max-h-48 overflow-x-auto rounded-md p-4 text-xs">{@html JSON.stringify(
          Object.fromEntries(hreaStore.userAgentMappings),
          null,
          2
        )}</pre>
    {:else}
      <p>No user-to-agent mappings have been created yet.</p>
    {/if}
  </div>
</div>
