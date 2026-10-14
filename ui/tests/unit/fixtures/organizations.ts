import type { UIOrganization } from '$lib/types/ui';
import type { ActionHash } from '@holochain/client';
import { createMockActionHash } from '../test-helpers';

const mockActionHash = new Uint8Array([0, 1, 2, 3]) as ActionHash;

export const testOrganizations: Record<string, UIOrganization> = {
  main: {
    name: 'Test Organization',
    description: 'A test organization',
    full_legal_name: 'Test Organization Inc.',
    email: 'org@test.com',
    urls: ['https://test.org'],
    location: 'Test City',
    coordinators: [mockActionHash],
    members: [mockActionHash],
    original_action_hash: mockActionHash,
    previous_action_hash: mockActionHash,
    status: {
      status_type: 'accepted',
      original_action_hash: createMockActionHash('main-status-orig'),
      previous_action_hash: createMockActionHash('main-status-prev')
    }
  },
  sub: {
    name: 'Sub Organization',
    description: 'A sub organization',
    full_legal_name: 'Sub Organization LLC',
    email: 'sub@test.org',
    urls: ['https://sub.test.org'],
    location: 'Test City',
    coordinators: [mockActionHash],
    members: [mockActionHash],
    original_action_hash: mockActionHash,
    previous_action_hash: mockActionHash,
    status: {
      status_type: 'accepted',
      original_action_hash: createMockActionHash('sub-status-orig'),
      previous_action_hash: createMockActionHash('sub-status-prev')
    }
  }
};
