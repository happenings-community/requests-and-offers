import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Effect as E, Layer, pipe } from 'effect';
import type { AppWebsocket } from '@holochain/client';
import {
  HreaServiceLive,
  HreaServiceTag,
  normalizeIntentResponse,
  normalizeProposalResponse,
  type HreaService
} from '@/lib/services/hrea.service';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
import { ApolloClient } from '@apollo/client/core';
import type {
  Agent,
  ResourceSpecification,
  Proposal,
  Intent,
  GraphQLIntentResponse,
  GraphQLProposalResponse
} from '$lib/types/hrea';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks: ApolloClient + the hREA GraphQL schema adapter.
// The service builds its Apollo client once (memoized) via SchemaLink over a
// createHolochainSchema. We stub the schema + link so the client is inert, and
// route all traffic through the mocked mutate/query fns.
// ─────────────────────────────────────────────────────────────────────────────
const mockMutate = vi.fn();
const mockQuery = vi.fn();

vi.mock('@apollo/client/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@apollo/client/core')>();
  return {
    ...actual,
    ApolloClient: vi.fn().mockImplementation(() => ({
      mutate: mockMutate,
      query: mockQuery
    }))
  };
});

vi.mock('@valueflows/vf-graphql-holochain', () => ({
  createHolochainSchema: vi.fn().mockReturnValue({})
}));

vi.mock('@apollo/client/link/schema', () => ({
  SchemaLink: vi.fn().mockImplementation(() => ({}))
}));

// ─────────────────────────────────────────────────────────────────────────────
// Test utilities
// ─────────────────────────────────────────────────────────────────────────────
const createMockHolochainClientService = () => ({
  appId: 'test-app',
  client: {} as AppWebsocket,
  isConnected: true,
  isConnecting: false,
  weaveClient: null,
  profilesClient: null,
  isWeaveContext: false,
  connectClient: vi.fn(),
  waitForConnection: vi.fn(() => Promise.resolve()),
  getAppInfo: vi.fn(),
  getPeerMetaInfo: vi.fn(() => Promise.resolve({})),
  callZome: vi.fn(),
  callZomeRawEffect: vi.fn(),
  callZomeEffect: vi.fn(),
  verifyConnection: vi.fn(),
  getNetworkSeed: vi.fn(() => Promise.resolve('test-network-seed')),
  getNetworkInfo: vi.fn(() =>
    Promise.resolve({
      networkSeed: 'test-network-seed',
      dnaHash: 'test-dna-hash',
      roleName: 'requests_and_offers'
    })
  ),
  getNetworkPeers: vi.fn(() => Promise.resolve(['peer1', 'peer2', 'peer3'])),
  isGroupProgenitor: vi.fn(() => Promise.resolve(false))
});

const createServiceTestRunner = (
  mockClient: ReturnType<typeof createMockHolochainClientService>
) => {
  const testLayer = Layer.succeed(HolochainClientServiceTag, mockClient);
  const liveLayer = Layer.provide(HreaServiceLive, testLayer);

  return <T, E>(effect: E.Effect<T, E, HreaServiceTag>) =>
    E.runPromise(pipe(effect, E.provide(liveLayer)));
};

// Shared fixtures
const mockAgent: Agent = { id: 'agent-1', name: 'Jane Doe', note: 'A person' };
const mockOrg: Agent = { id: 'org-1', name: 'Acme', note: 'An org' };
const mockResourceSpec: ResourceSpecification = {
  id: 'rspec-1',
  name: 'Bread',
  note: 'Loaf'
};
const mockProposalRaw: GraphQLProposalResponse = {
  id: 'prop-1',
  name: 'Trade',
  note: 'A trade',
  created: '2026-01-01T00:00:00Z',
  revisionId: 'rev-1',
  hasBeginning: '2026-01-02',
  hasEnd: '2026-01-09',
  unitBased: true
};
const mockProposal = normalizeProposalResponse(mockProposalRaw);
const mockIntentRaw: GraphQLIntentResponse = {
  id: 'intent-1',
  revisionId: 'rev-2',
  action: { id: 'transfer' },
  provider: { id: 'agent-1', name: 'Jane' },
  receiver: { id: 'org-1', name: 'Acme' },
  resourceConformsTo: { id: 'rspec-1', name: 'Bread' },
  resourceQuantity: { hasNumericalValue: 5, hasUnit: { id: 'unit-1', label: 'loaf', symbol: 'lf' } },
  note: 'five loaves'
};
const mockIntent = normalizeIntentResponse(mockIntentRaw);

describe('HreaService', () => {
  let mockHolochainClient: ReturnType<typeof createMockHolochainClientService>;
  let runServiceEffect: ReturnType<typeof createServiceTestRunner>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockHolochainClient = createMockHolochainClientService();
    runServiceEffect = createServiceTestRunner(mockHolochainClient);
  });

  // Helper: run a service method inside a yielded-tag context.
  const call = <T>(fn: (s: HreaService) => E.Effect<T, unknown>) =>
    runServiceEffect(
      E.gen(function* () {
        const service = yield* HreaServiceTag;
        return yield* fn(service);
      })
    );

  // ── initialize / memoization ──────────────────────────────────────────────
  describe('initialize (memoized Apollo client)', () => {
    it('builds the Apollo client exactly once across multiple calls (same service lifetime)', async () => {
      // Acquire the service once and call initialize() repeatedly through it,
      // so all calls share the single memoized clientPromise closure.
      const client = await runServiceEffect(
        E.gen(function* () {
          const service = yield* HreaServiceTag;
          yield* service.initialize();
          yield* service.initialize();
          yield* service.initialize();
          return yield* service.initialize();
        })
      );

      // ApolloClient constructor (and thus the schema build) runs once.
      expect(ApolloClient).toHaveBeenCalledTimes(1);
      expect(mockHolochainClient.waitForConnection).toHaveBeenCalledTimes(1);
      expect(client).toEqual(expect.objectContaining({ mutate: expect.any(Function) }));
    });

    it('shares a single client across concurrent first-calls (same service lifetime)', async () => {
      await runServiceEffect(
        E.gen(function* () {
          const service = yield* HreaServiceTag;
          // Fire two initialize() calls in parallel before either resolves.
          yield* E.all([service.initialize(), service.initialize()]);
        })
      );
      expect(ApolloClient).toHaveBeenCalledTimes(1);
    });

    it('propagates connection errors as HreaError (INITIALIZE context)', async () => {
      mockHolochainClient.waitForConnection.mockRejectedValue(new Error('Connection failed'));
      await expect(call((s) => s.initialize())).rejects.toThrow('Connection failed');
    });

    it('errors when the Holochain client instance is null after connection', async () => {
      // Simulate a client that connected but never produced an AppWebsocket handle.
      (mockHolochainClient as { client: AppWebsocket | null }).client = null;
      await expect(call((s) => s.initialize())).rejects.toThrow(
        'Holochain client is not available after connection'
      );
    });
  });

  // ── Person / Organization agents ──────────────────────────────────────────
  describe('createPerson', () => {
    it('creates a person and validates the returned agent', async () => {
      mockMutate.mockResolvedValue({ data: { createPerson: { agent: mockAgent } } });
      const result = await call((s) => s.createPerson({ name: 'Jane Doe', note: 'A person' }));
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { person: { name: 'Jane Doe', note: 'A person' } }
        })
      );
      expect(result).toEqual(mockAgent);
    });

    it('throws when no agent is returned', async () => {
      mockMutate.mockResolvedValue({ data: { createPerson: { agent: null } } });
      await expect(call((s) => s.createPerson({ name: 'X' }))).rejects.toThrow('No agent returned');
    });

    it('throws on schema-decoding failure (missing required name)', async () => {
      mockMutate.mockResolvedValue({ data: { createPerson: { agent: { id: 'a1' } } } });
      await expect(call((s) => s.createPerson({ name: 'X' }))).rejects.toThrow('is missing');
    });

    it('wraps GraphQL errors in HreaError', async () => {
      mockMutate.mockRejectedValue(new Error('GraphQL bombed'));
      await expect(call((s) => s.createPerson({ name: 'X' }))).rejects.toThrow('GraphQL bombed');
    });
  });

  describe('updatePerson', () => {
    it('updates a person and returns the agent', async () => {
      mockMutate.mockResolvedValue({ data: { updatePerson: { agent: mockAgent } } });
      const result = await call((s) =>
        s.updatePerson({ id: 'agent-1', name: 'Jane Roe', note: 'updated' })
      );
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { id: 'agent-1', person: { name: 'Jane Roe', note: 'updated' } }
        })
      );
      expect(result).toEqual(mockAgent);
    });

    it('throws when no agent is returned', async () => {
      mockMutate.mockResolvedValue({ data: { updatePerson: {} } });
      await expect(
        call((s) => s.updatePerson({ id: 'agent-1', name: 'Jane' }))
      ).rejects.toThrow('No agent returned');
    });

    it('wraps mutation errors in HreaError', async () => {
      mockMutate.mockRejectedValue(new Error('update failed'));
      await expect(
        call((s) => s.updatePerson({ id: 'agent-1', name: 'Jane' }))
      ).rejects.toThrow('update failed');
    });
  });

  describe('createOrganization', () => {
    it('creates an organization and returns the agent', async () => {
      mockMutate.mockResolvedValue({ data: { createOrganization: { agent: mockOrg } } });
      const result = await call((s) => s.createOrganization({ name: 'Acme', note: 'An org' }));
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { organization: { name: 'Acme', note: 'An org' } }
        })
      );
      expect(result).toEqual(mockOrg);
    });

    it('throws when no agent is returned', async () => {
      mockMutate.mockResolvedValue({ data: { createOrganization: { agent: null } } });
      await expect(call((s) => s.createOrganization({ name: 'Acme' }))).rejects.toThrow(
        'No agent returned'
      );
    });

    it('wraps mutation errors in HreaError', async () => {
      mockMutate.mockRejectedValue(new Error('org create failed'));
      await expect(call((s) => s.createOrganization({ name: 'Acme' }))).rejects.toThrow(
        'org create failed'
      );
    });
  });

  describe('updateOrganization', () => {
    it('updates an organization and returns the agent', async () => {
      mockMutate.mockResolvedValue({ data: { updateOrganization: { agent: mockOrg } } });
      const result = await call((s) =>
        s.updateOrganization({ id: 'org-1', name: 'Acme Co', note: 'x' })
      );
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { id: 'org-1', organization: { name: 'Acme Co', note: 'x' } }
        })
      );
      expect(result).toEqual(mockOrg);
    });

    it('throws when no agent is returned', async () => {
      mockMutate.mockResolvedValue({ data: { updateOrganization: {} } });
      await expect(
        call((s) => s.updateOrganization({ id: 'org-1', name: 'Acme' }))
      ).rejects.toThrow('No agent returned');
    });
  });

  describe('getAgent', () => {
    it('returns the agent when found', async () => {
      mockQuery.mockResolvedValue({ data: { agent: mockAgent } });
      const result = await call((s) => s.getAgent('agent-1'));
      expect(result).toEqual(mockAgent);
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue({ data: { agent: null } });
      expect(await call((s) => s.getAgent('nope'))).toBeNull();
    });

    it('wraps query errors in HreaError', async () => {
      mockQuery.mockRejectedValue(new Error('query failed'));
      await expect(call((s) => s.getAgent('agent-1'))).rejects.toThrow('query failed');
    });
  });

  describe('getAgents', () => {
    it('maps connection edges to an agent array', async () => {
      mockQuery.mockResolvedValue({
        data: { agents: { edges: [{ node: mockAgent }, { node: mockOrg }] } }
      });
      const result = await call((s) => s.getAgents());
      expect(result).toEqual([mockAgent, mockOrg]);
    });

    it('returns an empty array when no edges', async () => {
      mockQuery.mockResolvedValue({ data: { agents: { edges: [] } } });
      expect(await call((s) => s.getAgents())).toEqual([]);
    });

    it('returns an empty array when data is missing', async () => {
      mockQuery.mockResolvedValue({ data: null });
      expect(await call((s) => s.getAgents())).toEqual([]);
    });

    it('wraps query errors in HreaError', async () => {
      mockQuery.mockRejectedValue(new Error('agents query failed'));
      await expect(call((s) => s.getAgents())).rejects.toThrow('agents query failed');
    });
  });

  // ── ResourceSpecification ──────────────────────────────────────────────────
  describe('createResourceSpecification', () => {
    it('creates and returns a resource specification', async () => {
      mockMutate.mockResolvedValue({
        data: { createResourceSpecification: { resourceSpecification: mockResourceSpec } }
      });
      const result = await call((s) =>
        s.createResourceSpecification({ name: 'Bread', note: 'Loaf' })
      );
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { resourceSpecification: { name: 'Bread', note: 'Loaf' } }
        })
      );
      expect(result).toEqual(mockResourceSpec);
    });

    it('throws when no resource specification is returned', async () => {
      mockMutate.mockResolvedValue({ data: { createResourceSpecification: {} } });
      await expect(
        call((s) => s.createResourceSpecification({ name: 'Bread' }))
      ).rejects.toThrow('No resource specification returned');
    });

    it('wraps mutation errors', async () => {
      mockMutate.mockRejectedValue(new Error('rspec create failed'));
      await expect(call((s) => s.createResourceSpecification({ name: 'Bread' }))).rejects.toThrow(
        'rspec create failed'
      );
    });
  });

  describe('updateResourceSpecification', () => {
    it('updates and returns a resource specification', async () => {
      mockMutate.mockResolvedValue({
        data: { updateResourceSpecification: { resourceSpecification: mockResourceSpec } }
      });
      const result = await call((s) =>
        s.updateResourceSpecification({ id: 'rspec-1', name: 'Bread', note: 'Loaf' })
      );
      expect(result).toEqual(mockResourceSpec);
    });

    it('throws when none returned', async () => {
      mockMutate.mockResolvedValue({ data: { updateResourceSpecification: {} } });
      await expect(
        call((s) => s.updateResourceSpecification({ id: 'rspec-1', name: 'Bread' }))
      ).rejects.toThrow('No resource specification returned');
    });
  });

  describe('deleteResourceSpecification', () => {
    it('returns true when deletion succeeds', async () => {
      mockMutate.mockResolvedValue({ data: { deleteResourceSpecification: true } });
      expect(await call((s) => s.deleteResourceSpecification({ id: 'rspec-1' }))).toBe(true);
    });

    it('returns false when the server reports failure', async () => {
      mockMutate.mockResolvedValue({ data: { deleteResourceSpecification: false } });
      expect(await call((s) => s.deleteResourceSpecification({ id: 'rspec-1' }))).toBe(false);
    });

    it('returns false when the field is missing', async () => {
      mockMutate.mockResolvedValue({ data: {} });
      expect(await call((s) => s.deleteResourceSpecification({ id: 'rspec-1' }))).toBe(false);
    });

    it('wraps mutation errors', async () => {
      mockMutate.mockRejectedValue(new Error('delete failed'));
      await expect(call((s) => s.deleteResourceSpecification({ id: 'rspec-1' }))).rejects.toThrow(
        'delete failed'
      );
    });
  });

  describe('getResourceSpecification', () => {
    it('returns the spec when found', async () => {
      mockQuery.mockResolvedValue({ data: { resourceSpecification: mockResourceSpec } });
      expect(await call((s) => s.getResourceSpecification('rspec-1'))).toEqual(mockResourceSpec);
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue({ data: { resourceSpecification: null } });
      expect(await call((s) => s.getResourceSpecification('nope'))).toBeNull();
    });

    it('wraps query errors', async () => {
      mockQuery.mockRejectedValue(new Error('rspec query failed'));
      await expect(call((s) => s.getResourceSpecification('rspec-1'))).rejects.toThrow(
        'rspec query failed'
      );
    });
  });

  describe('getResourceSpecifications', () => {
    it('maps edges to an array', async () => {
      mockQuery.mockResolvedValue({
        data: { resourceSpecifications: { edges: [{ node: mockResourceSpec }] } }
      });
      expect(await call((s) => s.getResourceSpecifications())).toEqual([mockResourceSpec]);
    });

    it('returns [] when missing data', async () => {
      mockQuery.mockResolvedValue({ data: null });
      expect(await call((s) => s.getResourceSpecifications())).toEqual([]);
    });
  });

  describe('getResourceSpecificationsByClass', () => {
    it('passes classifiedAs filter and maps edges', async () => {
      mockQuery.mockResolvedValue({
        data: { resourceSpecifications: { edges: [{ node: mockResourceSpec }] } }
      });
      const result = await call((s) => s.getResourceSpecificationsByClass(['urn:food']));
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({ variables: { classifiedAs: ['urn:food'] } })
      );
      expect(result).toEqual([mockResourceSpec]);
    });

    it('returns [] when no edges', async () => {
      mockQuery.mockResolvedValue({ data: { resourceSpecifications: { edges: [] } } });
      expect(await call((s) => s.getResourceSpecificationsByClass(['urn:food']))).toEqual([]);
    });

    it('wraps query errors', async () => {
      mockQuery.mockRejectedValue(new Error('by-class failed'));
      await expect(call((s) => s.getResourceSpecificationsByClass(['urn:food']))).rejects.toThrow(
        'by-class failed'
      );
    });
  });

  // ── Proposal ───────────────────────────────────────────────────────────────
  describe('createProposal', () => {
    it('creates and normalizes a proposal', async () => {
      mockMutate.mockResolvedValue({ data: { createProposal: { proposal: mockProposalRaw } } });
      const result = await call((s) => s.createProposal({ name: 'Trade', unitBased: true }));
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { proposal: { name: 'Trade', note: undefined, hasBeginning: undefined, hasEnd: undefined, unitBased: true } }
        })
      );
      expect(result).toEqual(mockProposal);
    });

    it('throws when no proposal is returned', async () => {
      mockMutate.mockResolvedValue({ data: { createProposal: {} } });
      await expect(call((s) => s.createProposal({ name: 'Trade' }))).rejects.toThrow(
        'No proposal returned'
      );
    });

    it('wraps mutation errors', async () => {
      mockMutate.mockRejectedValue(new Error('proposal create failed'));
      await expect(call((s) => s.createProposal({ name: 'Trade' }))).rejects.toThrow(
        'proposal create failed'
      );
    });
  });

  describe('updateProposal', () => {
    it('updates and normalizes a proposal', async () => {
      mockMutate.mockResolvedValue({ data: { updateProposal: { proposal: mockProposalRaw } } });
      const result = await call((s) =>
        s.updateProposal({ id: 'rev-1', name: 'Trade v2', unitBased: false })
      );
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { proposal: expect.objectContaining({ revisionId: 'rev-1', name: 'Trade v2' }) }
        })
      );
      expect(result).toEqual(mockProposal);
    });

    it('throws when no proposal returned', async () => {
      mockMutate.mockResolvedValue({ data: { updateProposal: {} } });
      await expect(
        call((s) => s.updateProposal({ id: 'rev-1', name: 'Trade' }))
      ).rejects.toThrow('No proposal returned');
    });
  });

  describe('deleteProposal', () => {
    it('returns true on success', async () => {
      mockMutate.mockResolvedValue({ data: { deleteProposal: true } });
      expect(await call((s) => s.deleteProposal({ revisionId: 'rev-1' }))).toBe(true);
    });

    it('returns false when missing', async () => {
      mockMutate.mockResolvedValue({ data: {} });
      expect(await call((s) => s.deleteProposal({ revisionId: 'rev-1' }))).toBe(false);
    });

    it('wraps errors', async () => {
      mockMutate.mockRejectedValue(new Error('del failed'));
      await expect(call((s) => s.deleteProposal({ revisionId: 'rev-1' }))).rejects.toThrow(
        'del failed'
      );
    });
  });

  describe('getProposal', () => {
    it('returns a normalized proposal when found', async () => {
      mockQuery.mockResolvedValue({ data: { proposal: mockProposalRaw } });
      expect(await call((s) => s.getProposal('prop-1'))).toEqual(mockProposal);
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue({ data: { proposal: null } });
      expect(await call((s) => s.getProposal('nope'))).toBeNull();
    });

    it('wraps query errors', async () => {
      mockQuery.mockRejectedValue(new Error('prop query failed'));
      await expect(call((s) => s.getProposal('prop-1'))).rejects.toThrow('prop query failed');
    });
  });

  describe('getProposals', () => {
    it('maps edges to normalized proposals', async () => {
      mockQuery.mockResolvedValue({
        data: { proposals: { edges: [{ node: mockProposalRaw }] } }
      });
      expect(await call((s) => s.getProposals())).toEqual([mockProposal]);
    });

    it('returns [] when no edges', async () => {
      mockQuery.mockResolvedValue({ data: { proposals: { edges: [] } } });
      expect(await call((s) => s.getProposals())).toEqual([]);
    });

    // Critical regression guard: the old implementation swallowed "missing zome
    // function" errors and returned []. That behavior was deleted as obsolete
    // against happ-0.4.0-beta. A genuine error must now propagate.
    it('propagates genuine errors instead of swallowing them as []', async () => {
      mockQuery.mockRejectedValue(new Error('real failure'));
      await expect(call((s) => s.getProposals())).rejects.toThrow('real failure');
    });
  });

  describe('getProposalsByAgent', () => {
    it('passes agentId and maps edges', async () => {
      mockQuery.mockResolvedValue({
        data: { proposals: { edges: [{ node: mockProposalRaw }] } }
      });
      const result = await call((s) => s.getProposalsByAgent('agent-1'));
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({ variables: { agentId: 'agent-1' } })
      );
      expect(result).toEqual([mockProposal]);
    });

    it('propagates genuine errors', async () => {
      mockQuery.mockRejectedValue(new Error('by-agent failed'));
      await expect(call((s) => s.getProposalsByAgent('agent-1'))).rejects.toThrow(
        'by-agent failed'
      );
    });
  });

  // ── Intent ─────────────────────────────────────────────────────────────────
  describe('createIntent', () => {
    it('creates and normalizes an intent', async () => {
      mockMutate.mockResolvedValue({ data: { createIntent: { intent: mockIntentRaw } } });
      const result = await call((s) =>
        s.createIntent({
          action: 'transfer',
          provider: 'agent-1',
          receiver: 'org-1',
          resourceSpecifiedBy: 'rspec-1',
          resourceQuantity: { hasNumericalValue: 5, hasUnit: 'unit-1' }
        })
      );
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: {
            intent: {
              action: 'transfer',
              provider: 'agent-1',
              receiver: 'org-1',
              resourceConformsTo: 'rspec-1',
              resourceQuantity: { hasNumericalValue: 5, hasUnit: 'unit-1' }
            }
          }
        })
      );
      expect(result).toEqual(mockIntent);
    });

    it('throws when no intent returned', async () => {
      mockMutate.mockResolvedValue({ data: { createIntent: {} } });
      await expect(call((s) => s.createIntent({ action: 'transfer' }))).rejects.toThrow(
        'No intent returned'
      );
    });

    it('wraps mutation errors', async () => {
      mockMutate.mockRejectedValue(new Error('intent create failed'));
      await expect(call((s) => s.createIntent({ action: 'transfer' }))).rejects.toThrow(
        'intent create failed'
      );
    });
  });

  describe('proposeIntent', () => {
    it('returns true when the link is created', async () => {
      mockMutate.mockResolvedValue({
        data: { proposeIntent: { proposedIntent: { id: 'link-1' } } }
      });
      const result = await call((s) =>
        s.proposeIntent({ intentId: 'intent-1', proposalId: 'prop-1', reciprocal: true })
      );
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { publishedIn: 'prop-1', publishes: 'intent-1', reciprocal: true }
        })
      );
      expect(result).toBe(true);
    });

    it('defaults reciprocal to false when omitted', async () => {
      mockMutate.mockResolvedValue({
        data: { proposeIntent: { proposedIntent: { id: 'link-1' } } }
      });
      await call((s) => s.proposeIntent({ intentId: 'intent-1', proposalId: 'prop-1' }));
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({ reciprocal: false })
        })
      );
    });

    it('returns false when no proposedIntent returned', async () => {
      mockMutate.mockResolvedValue({ data: { proposeIntent: {} } });
      expect(
        await call((s) => s.proposeIntent({ intentId: 'intent-1', proposalId: 'prop-1' }))
      ).toBe(false);
    });

    it('wraps errors', async () => {
      mockMutate.mockRejectedValue(new Error('link failed'));
      await expect(
        call((s) => s.proposeIntent({ intentId: 'intent-1', proposalId: 'prop-1' }))
      ).rejects.toThrow('link failed');
    });
  });

  describe('updateIntent', () => {
    it('updates and normalizes an intent', async () => {
      mockMutate.mockResolvedValue({ data: { updateIntent: { intent: mockIntentRaw } } });
      const result = await call((s) =>
        s.updateIntent({ id: 'rev-2', action: 'transfer', provider: 'agent-1' })
      );
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: {
            intent: expect.objectContaining({ revisionId: 'rev-2', action: 'transfer', provider: 'agent-1' })
          }
        })
      );
      expect(result).toEqual(mockIntent);
    });

    it('throws when no intent returned', async () => {
      mockMutate.mockResolvedValue({ data: { updateIntent: {} } });
      await expect(
        call((s) => s.updateIntent({ id: 'rev-2', action: 'transfer' }))
      ).rejects.toThrow('No intent returned');
    });
  });

  describe('deleteIntent', () => {
    it('returns true on success', async () => {
      mockMutate.mockResolvedValue({ data: { deleteIntent: true } });
      expect(await call((s) => s.deleteIntent({ revisionId: 'rev-2' }))).toBe(true);
    });

    it('returns false when missing', async () => {
      mockMutate.mockResolvedValue({ data: {} });
      expect(await call((s) => s.deleteIntent({ revisionId: 'rev-2' }))).toBe(false);
    });
  });

  describe('getIntent', () => {
    it('returns a normalized intent when found', async () => {
      mockQuery.mockResolvedValue({ data: { intent: mockIntentRaw } });
      expect(await call((s) => s.getIntent('intent-1'))).toEqual(mockIntent);
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue({ data: { intent: null } });
      expect(await call((s) => s.getIntent('nope'))).toBeNull();
    });

    it('wraps query errors', async () => {
      mockQuery.mockRejectedValue(new Error('intent query failed'));
      await expect(call((s) => s.getIntent('intent-1'))).rejects.toThrow('intent query failed');
    });
  });

  describe('getIntents', () => {
    it('maps edges to normalized intents', async () => {
      mockQuery.mockResolvedValue({ data: { intents: { edges: [{ node: mockIntentRaw }] } } });
      expect(await call((s) => s.getIntents())).toEqual([mockIntent]);
    });

    it('returns [] when no edges', async () => {
      mockQuery.mockResolvedValue({ data: { intents: { edges: [] } } });
      expect(await call((s) => s.getIntents())).toEqual([]);
    });

    // Regression guard for the removed defensive catchAll (same rationale as
    // getProposals above).
    it('propagates genuine errors instead of swallowing them as []', async () => {
      mockQuery.mockRejectedValue(new Error('intents real failure'));
      await expect(call((s) => s.getIntents())).rejects.toThrow('intents real failure');
    });
  });

  describe('getIntentsByProposal', () => {
    it('passes proposalId and maps edges', async () => {
      mockQuery.mockResolvedValue({ data: { intents: { edges: [{ node: mockIntentRaw }] } } });
      const result = await call((s) => s.getIntentsByProposal('prop-1'));
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({ variables: { proposalId: 'prop-1' } })
      );
      expect(result).toEqual([mockIntent]);
    });

    it('propagates genuine errors', async () => {
      mockQuery.mockRejectedValue(new Error('by-proposal failed'));
      await expect(call((s) => s.getIntentsByProposal('prop-1'))).rejects.toThrow(
        'by-proposal failed'
      );
    });
  });
});
