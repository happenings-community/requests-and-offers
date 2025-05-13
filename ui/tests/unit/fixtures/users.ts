import type { UIUser } from '$lib/types/ui';
import type { ActionHash, AgentPubKey } from '@holochain/client';

const mockActionHash = new Uint8Array([0, 1, 2, 3]) as ActionHash;
const mockAgentPubKey = new Uint8Array([4, 5, 6, 7]) as AgentPubKey;

export const testUsers: Record<string, UIUser> = {
  admin: {
    name: 'Admin User',
    nickname: 'admin',
    email: 'admin@test.com',
    user_type: 'creator',
    original_action_hash: mockActionHash,
    previous_action_hash: mockActionHash,
    agents: [mockAgentPubKey],
    status: {
      status_type: 'accepted',
      reason: 'Initial admin user'
    }
  },
  regular: {
    name: 'Regular User',
    nickname: 'user',
    email: 'user@test.com',
    user_type: 'advocate',
    original_action_hash: mockActionHash,
    previous_action_hash: mockActionHash,
    agents: [mockAgentPubKey],
    status: {
      status_type: 'accepted'
    }
  }
};
