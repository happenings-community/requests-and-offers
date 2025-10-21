/**
 * Template for creating new Effect-TS services
 * Copy this template and replace {{DOMAIN_NAME}} with your domain name
 */

import type { ActionHash, Record } from '@holochain/client';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
import { Effect as E, Layer, Context, pipe } from 'effect';

// Import domain-specific types and schemas
// import { {{DOMAIN_NAME}}Error } from '$lib/errors/{{domain_name}}.errors';
// import { {{DOMAIN_NAME}}_CONTEXTS } from '$lib/errors/error-contexts';
// import { wrapZomeCallWithErrorFactory } from '$lib/utils/zome-helpers';
// import {
//   {{DOMAIN_NAME}}InDHT,
//   UI{{DOMAIN_NAME}},
//   // ... other schemas
// } from '$lib/schemas/{{domain_name}}.schemas';

// --- Service Interface ---
export interface {{DOMAIN_NAME}}Service {
  readonly create{{DOMAIN_NAME}}: ({{domain_name}}: {{DOMAIN_NAME}}InDHT) => E.Effect<Record, {{DOMAIN_NAME}}Error>;

  readonly get{{DOMAIN_NAME}}: (
    {{domain_name}}Hash: ActionHash
  ) => E.Effect<Record | null, {{DOMAIN_NAME}}Error>;

  readonly getLatest{{DOMAIN_NAME}}Record: (
    originalActionHash: ActionHash
  ) => E.Effect<Record | null, {{DOMAIN_NAME}}Error>;

  readonly update{{DOMAIN_NAME}}: (
    original{{DOMAIN_NAME}}Hash: ActionHash,
    previous{{DOMAIN_NAME}}Hash: ActionHash,
    updated{{DOMAIN_NAME}}: {{DOMAIN_NAME}}InDHT
  ) => E.Effect<ActionHash, {{DOMAIN_NAME}}Error>;

  readonly delete{{DOMAIN_NAME}}: (
    {{domain_name}}Hash: ActionHash
  ) => E.Effect<ActionHash, {{DOMAIN_NAME}}Error>;

  readonly getAll{{DOMAIN_NAME}}s: () => E.Effect<
    { pending: Record[]; approved: Record[]; rejected: Record[] },
    {{DOMAIN_NAME}}Error
  >;

  // Add domain-specific methods here
  // readonly get{{DOMAIN_NAME}}sForEntity: (input: Get{{DOMAIN_NAME}}ForEntityInput) => E.Effect<Record[], {{DOMAIN_NAME}}Error>;
}

// --- Service Tag ---
export const {{DOMAIN_NAME}}Service = Context.GenericTag<{{DOMAIN_NAME}}Service>("{{DOMAIN_NAME}}Service");

// --- Service Implementation ---
export const make{{DOMAIN_NAME}}Service = E.gen(function* () {
  const client = yield* HolochainClientServiceTag;

  // Apply error wrapping helper
  const withErrorHandling = wrapZomeCallWithErrorFactory(
    {{DOMAIN_NAME}}Error,
    {{DOMAIN_NAME}}_CONTEXTS
  );

  // Create methods
  const create{{DOMAIN_NAME}} = ({{domain_name}}: {{DOMAIN_NAME}}InDHT) =>
    pipe(
      withErrorHandling({
        zome_name: "{{domain_name}}",
        fn_name: "create_{{domain_name}}",
        payload: {{domain_name}},
      })
    );

  const get{{DOMAIN_NAME}} = ({{domain_name}}Hash: ActionHash) =>
    pipe(
      withErrorHandling({
        zome_name: "{{domain_name}}",
        fn_name: "get_{{domain_name}}",
        payload: { {{domain_name}}_hash: {{domain_name}}Hash },
      })
    );

  const getLatest{{DOMAIN_NAME}}Record = (originalActionHash: ActionHash) =>
    pipe(
      withErrorHandling({
        zome_name: "{{domain_name}}",
        fn_name: "get_latest_{{domain_name}}_record",
        payload: { original_action_hash: originalActionHash },
      })
    );

  const update{{DOMAIN_NAME}} = (
    original{{DOMAIN_NAME}}Hash: ActionHash,
    previous{{DOMAIN_NAME}}Hash: ActionHash,
    updated{{DOMAIN_NAME}}: {{DOMAIN_NAME}}InDHT
  ) =>
    pipe(
      withErrorHandling({
        zome_name: "{{domain_name}}",
        fn_name: "update_{{domain_name}}",
        payload: {
          original_{{domain_name}}_hash: original{{DOMAIN_NAME}}Hash,
          previous_{{domain_name}}_hash: previous{{DOMAIN_NAME}}Hash,
          updated_{{domain_name}}: updated{{DOMAIN_NAME}},
        },
      })
    );

  const delete{{DOMAIN_NAME}} = ({{domain_name}}Hash: ActionHash) =>
    pipe(
      withErrorHandling({
        zome_name: "{{domain_name}}",
        fn_name: "delete_{{domain_name}}",
        payload: { {{domain_name}}_hash: {{domain_name}}Hash },
      })
    );

  const getAll{{DOMAIN_NAME}}s = () =>
    pipe(
      withErrorHandling({
        zome_name: "{{domain_name}}",
        fn_name: "get_all_{{domain_name}}s",
        payload: {},
      })
    );

  // Return service interface
  return {
    create{{DOMAIN_NAME}},
    get{{DOMAIN_NAME}},
    getLatest{{DOMAIN_NAME}}Record,
    update{{DOMAIN_NAME}},
    delete{{DOMAIN_NAME}},
    getAll{{DOMAIN_NAME}}s,
    // Add domain-specific methods here
  };
});

// --- Live Layer ---
export const {{DOMAIN_NAME}}Live = Layer.effect(
  {{DOMAIN_NAME}}Service,
  make{{DOMAIN_NAME}}Service
);

// --- Test Layer ---
export const {{DOMAIN_NAME}}Test = Layer.effect(
  {{DOMAIN_NAME}}Service,
  E.gen(function* () {
    // Mock implementation for testing
    return {
      create{{DOMAIN_NAME}}: ({{domain_name}}: {{DOMAIN_NAME}}InDHT) =>
        E.succeed({} as Record),
      get{{DOMAIN_NAME}}: ({{domain_name}}Hash: ActionHash) =>
        E.succeed(null),
      getLatest{{DOMAIN_NAME}}Record: (originalActionHash: ActionHash) =>
        E.succeed(null),
      update{{DOMAIN_NAME}}: (original{{DOMAIN_NAME}}Hash: ActionHash, previous{{DOMAIN_NAME}}Hash: ActionHash, updated{{DOMAIN_NAME}}: {{DOMAIN_NAME}}InDHT) =>
        E.succeed({} as ActionHash),
      delete{{DOMAIN_NAME}}: ({{domain_name}}Hash: ActionHash) =>
        E.succeed({} as ActionHash),
      getAll{{DOMAIN_NAME}}s: () =>
        E.succeed({ pending: [], approved: [], rejected: [] }),
      // Add mock implementations for domain-specific methods
    };
  })
);