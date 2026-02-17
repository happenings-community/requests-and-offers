/**
 * Service Layer Template — aligned with serviceTypes.service.ts
 * Replace {{DomainName}} (PascalCase) and {{domain_name}} (snake_case) with your domain.
 */

import type { ActionHash, Record } from '@holochain/client';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
import { Effect as E, Layer, Context, pipe } from 'effect';
import { {{DomainName}}Error } from '$lib/errors/{{domain_name}}.errors';
import { {{DOMAIN_NAME}}_CONTEXTS } from '$lib/errors/error-contexts';
import { wrapZomeCallWithErrorFactory } from '$lib/utils/zome-helpers';

// Import domain-specific schemas
// import { {{DomainName}}InDHT, UI{{DomainName}} } from '$lib/schemas/{{domain_name}}.schemas';

// --- Service Interface ---

export interface {{DomainName}}Service {
  readonly create{{DomainName}}: (input: {{DomainName}}InDHT) => E.Effect<Record, {{DomainName}}Error>;
  readonly get{{DomainName}}: (hash: ActionHash) => E.Effect<Record | null, {{DomainName}}Error>;
  readonly update{{DomainName}}: (
    originalHash: ActionHash,
    previousHash: ActionHash,
    updated: {{DomainName}}InDHT
  ) => E.Effect<ActionHash, {{DomainName}}Error>;
  readonly delete{{DomainName}}: (hash: ActionHash) => E.Effect<ActionHash, {{DomainName}}Error>;
  readonly getAll{{DomainName}}s: () => E.Effect<
    { pending: Record[]; approved: Record[]; rejected: Record[] },
    {{DomainName}}Error
  >;
}

// --- Service Tag ---

export class {{DomainName}}ServiceTag extends Context.Tag('{{DomainName}}Service')<
  {{DomainName}}ServiceTag,
  {{DomainName}}Service
>() {}

// --- Service Implementation (Live Layer) ---

export const {{DomainName}}ServiceLive: Layer.Layer<
  {{DomainName}}ServiceTag,
  never,
  HolochainClientServiceTag
> = Layer.effect(
  {{DomainName}}ServiceTag,
  E.gen(function* () {
    const holochainClient = yield* HolochainClientServiceTag;

    // Helper: wrap Promise-based zome calls into Effect with domain errors
    const wrapZomeCall = <T>(
      zomeName: string,
      fnName: string,
      payload: unknown,
      context: string = {{DOMAIN_NAME}}_CONTEXTS.GET_{{DOMAIN_NAME}}
    ): E.Effect<T, {{DomainName}}Error> =>
      wrapZomeCallWithErrorFactory(
        holochainClient,
        zomeName,
        fnName,
        payload,
        context,
        {{DomainName}}Error.fromError
      );

    const create{{DomainName}} = (input: {{DomainName}}InDHT): E.Effect<Record, {{DomainName}}Error> =>
      wrapZomeCall('{{domain_name}}s', 'create_{{domain_name}}', {
        {{domain_name}}: input
      });

    const get{{DomainName}} = (hash: ActionHash): E.Effect<Record | null, {{DomainName}}Error> =>
      wrapZomeCall('{{domain_name}}s', 'get_{{domain_name}}', hash);

    const update{{DomainName}} = (
      originalHash: ActionHash,
      previousHash: ActionHash,
      updated: {{DomainName}}InDHT
    ): E.Effect<ActionHash, {{DomainName}}Error> =>
      wrapZomeCall('{{domain_name}}s', 'update_{{domain_name}}', {
        original_{{domain_name}}_hash: originalHash,
        previous_{{domain_name}}_hash: previousHash,
        updated_{{domain_name}}: updated
      });

    const delete{{DomainName}} = (hash: ActionHash): E.Effect<ActionHash, {{DomainName}}Error> =>
      wrapZomeCall('{{domain_name}}s', 'delete_{{domain_name}}', hash);

    const getAll{{DomainName}}s = (): E.Effect<
      { pending: Record[]; approved: Record[]; rejected: Record[] },
      {{DomainName}}Error
    > =>
      pipe(
        E.all({
          pending: wrapZomeCall<Record[]>('{{domain_name}}s', 'get_pending_{{domain_name}}s', null),
          approved: wrapZomeCall<Record[]>('{{domain_name}}s', 'get_approved_{{domain_name}}s', null),
          rejected: wrapZomeCall<Record[]>('{{domain_name}}s', 'get_rejected_{{domain_name}}s', null)
        }, { concurrency: 'inherit' }),
        E.catchAll((error) =>
          E.fail({{DomainName}}Error.fromError(error, {{DOMAIN_NAME}}_CONTEXTS.GET_ALL_{{DOMAIN_NAME}}S))
        )
      );

    return {{DomainName}}ServiceTag.of({
      create{{DomainName}},
      get{{DomainName}},
      update{{DomainName}},
      delete{{DomainName}},
      getAll{{DomainName}}s
    });
  })
);
