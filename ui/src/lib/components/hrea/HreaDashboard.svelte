<script lang="ts">
  import { onMount } from 'svelte';
  import { useHreaDashboard } from '$lib/composables/domain/hrea/useHreaDashboard.svelte';
  import { KNOWN_MAPPING_GAPS, type FlowNode, type FlowState } from '$lib/utils/hrea-dashboard';

  // Admin view of the hREA mirror, after the design-system prototype
  // (requests-offers-design-system, prototypes/vision/admin/hrea). Unlike the
  // prototype, every hREA number is read from hREA, so the page is also the
  // mapping audit: what R&O has, what hREA holds, and where they differ.
  const dash = useHreaDashboard();
  onMount(() => dash.load());

  let hover = $state<string | null>(null);

  const COUNT_CARDS = [
    { k: 'agent', label: 'Agents', key: 'agents' },
    { k: 'spec', label: 'Resource Specs', key: 'specs' },
    { k: 'proposal', label: 'Proposals', key: 'proposals' },
    { k: 'intent', label: 'Intents', key: 'intents' },
    { k: 'agreement', label: 'Agreements', key: 'agreements' },
    { k: 'commitment', label: 'Commitments', key: 'commitments' },
    { k: 'event', label: 'Economic Events', key: 'events' },
    { k: 'fulfillment', label: 'Fulfillments', key: 'fulfillments' }
  ] as const;

  const VF_VOCAB = [
    {
      kind: 'agent',
      term: 'Agent',
      def: 'A person or organization that can act in the economic network.'
    },
    {
      kind: 'spec',
      term: 'ResourceSpecification',
      def: 'The kind of resource being exchanged (a service type or medium).'
    },
    {
      kind: 'proposal',
      term: 'Proposal',
      def: 'A published offer or request bundling reciprocal intents.'
    },
    {
      kind: 'intent',
      term: 'Intent',
      def: 'A desired economic flow: what someone wants to give or receive.'
    },
    {
      kind: 'agreement',
      term: 'Agreement',
      def: 'A mutual commitment formed when a proposal is accepted.'
    },
    {
      kind: 'commitment',
      term: 'Commitment',
      def: 'A promise to fulfil a specific economic flow (clause of an agreement).'
    },
    { kind: 'event', term: 'EconomicEvent', def: 'A record of a flow that actually happened.' },
    {
      kind: 'fulfillment',
      term: 'Fulfillment',
      def: 'Links an economic event to the commitment it satisfies.'
    }
  ];

  const STATE_LABEL: Record<FlowState, string> = {
    present: 'in hREA',
    missing: 'missing',
    'not-yet': 'not yet',
    'not-mapped': 'not mapped'
  };

  const CANVAS = { w: 900, h: 500 };
  const LAYOUT: Record<string, { x: number; y: number; w: number; h: number }> = {
    agentA: { x: 24, y: 14, w: 200, h: 56 },
    agentB: { x: 250, y: 14, w: 200, h: 56 },
    proposal: { x: 24, y: 150, w: 200, h: 62 },
    intentP: { x: 350, y: 120, w: 210, h: 62 },
    intentR: { x: 350, y: 214, w: 210, h: 62 },
    specS: { x: 686, y: 120, w: 190, h: 62 },
    specM: { x: 686, y: 214, w: 190, h: 62 },
    agreement: { x: 24, y: 334, w: 200, h: 62 },
    commitP: { x: 350, y: 326, w: 210, h: 64 },
    commitR: { x: 350, y: 416, w: 210, h: 64 },
    eventP: { x: 686, y: 326, w: 190, h: 64 },
    eventR: { x: 686, y: 416, w: 190, h: 64 }
  };
  type Side = 'l' | 'r' | 't' | 'b';
  function anchor(id: string, side: Side): [number, number] {
    const n = LAYOUT[id];
    if (side === 'l') return [n.x, n.y + n.h / 2];
    if (side === 'r') return [n.x + n.w, n.y + n.h / 2];
    if (side === 't') return [n.x + n.w / 2, n.y];
    return [n.x + n.w / 2, n.y + n.h];
  }

  // Each event fulfills its Commitment (the fulfills link on the event) and
  // realizes the Agreement through realizationOf.
  const EDGES: { from: string; fs: Side; to: string; ts: Side; label: string; dashed?: boolean }[] =
    [
      { from: 'agentA', fs: 'b', to: 'proposal', ts: 't', label: 'provider' },
      { from: 'agentB', fs: 'b', to: 'proposal', ts: 't', label: 'receiver' },
      { from: 'proposal', fs: 'r', to: 'intentP', ts: 'l', label: 'publishes' },
      { from: 'proposal', fs: 'r', to: 'intentR', ts: 'l', label: 'reciprocal', dashed: true },
      { from: 'intentP', fs: 'r', to: 'specS', ts: 'l', label: 'conformsTo', dashed: true },
      { from: 'intentR', fs: 'r', to: 'specM', ts: 'l', label: 'conformsTo', dashed: true },
      { from: 'proposal', fs: 'b', to: 'agreement', ts: 't', label: 'accepted' },
      { from: 'agreement', fs: 'r', to: 'commitP', ts: 'l', label: 'clauseOf' },
      { from: 'agreement', fs: 'r', to: 'commitR', ts: 'l', label: 'clauseOf' },
      {
        from: 'commitP',
        fs: 'r',
        to: 'eventP',
        ts: 'l',
        label: 'fulfills'
      },
      {
        from: 'commitR',
        fs: 'r',
        to: 'eventR',
        ts: 'l',
        label: 'fulfills'
      }
    ];

  const nodeById = $derived(new Map(dash.flow.map((n) => [n.id, n])));
  const present = (id: string) => nodeById.get(id)?.state === 'present';
  const hovered = $derived<FlowNode | undefined>(hover ? nodeById.get(hover) : undefined);
  const missingCount = $derived(dash.flow.filter((n) => n.state === 'missing').length);
  const mismatches = $derived(dash.ledger.filter((r) => !r.match).length);
</script>

<div class="hrea-dashboard space-y-6">
  <p class="hrea-intro">
    Every R&amp;O record is mirrored onto the <strong>ValueFlows</strong> economic ontology through hREA.
    The numbers on this page are read from hREA itself, so it is also the audit of that mirror.
  </p>

  {#if dash.error}
    <div class="alert variant-filled-error" role="alert">
      <div class="alert-message"><p>Could not read hREA: {dash.error}</p></div>
    </div>
  {/if}

  <div class="flex items-center justify-between gap-4">
    <h2 class="h3">Entity counts</h2>
    <button
      class="variant-ghost-surface btn btn-sm"
      onclick={() => dash.load()}
      disabled={dash.loading}
    >
      {dash.loading ? 'Reading hREA…' : 'Refresh'}
    </button>
  </div>

  <div class="hrea-counts" aria-busy={dash.loading}>
    {#each COUNT_CARDS as c (c.key)}
      {@const v = dash.counts?.[c.key]}
      <div class="hrea-count-card card hrea-k--{c.k}">
        <span class="hrea-count-dot"></span>
        <div class="hrea-count-v">{v ?? '…'}</div>
        <div class="hrea-count-l">{c.label}</div>
      </div>
    {/each}
  </div>

  <section class="card space-y-3 p-4">
    <h2 class="h3">Mapping ledger</h2>
    <p class="hrea-sub">
      What R&amp;O holds beside what hREA holds, and what ties each pair together.
      {#if dash.ledger.length}
        {mismatches === 0
          ? 'Every row matches.'
          : `${mismatches} row${mismatches === 1 ? '' : 's'} differ.`}
      {/if}
    </p>
    <div class="table-container">
      <table class="table table-compact">
        <thead>
          <tr
            ><th>R&amp;O</th><th></th><th>hREA / ValueFlows</th><th>Linked by</th><th>R&amp;O</th
            ><th>hREA</th><th>Audit</th></tr
          >
        </thead>
        <tbody>
          {#each dash.ledger as r (r.ro)}
            <tr class:hrea-row--mismatch={!r.match}>
              <td>{r.ro}</td>
              <td class="hrea-map-arrow" aria-hidden="true">→</td>
              <td><span class="hrea-pill">{r.hrea}</span></td>
              <td>
                <code class="hrea-note">{r.link}</code>
                {#if r.caveat}<p class="hrea-caveat">{r.caveat}</p>{/if}
              </td>
              <td>{r.roCount}</td>
              <td><strong>{r.hreaCount}</strong></td>
              <td>
                {#if r.match}
                  <span class="variant-soft-success badge">matches</span>
                {:else}
                  <span class="variant-filled-error badge">mismatch</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="card space-y-3 p-4">
    <div class="hrea-graph-head">
      <div>
        <h2 class="h3">Economic-flow graph</h2>
        <p class="hrea-sub">
          One exchange's ValueFlows structure, each node marked from what hREA holds. Hover a node
          to inspect it; screen readers read each node's fields in the list.
          {#if missingCount}<strong class="text-error-500"
              >{missingCount} expected node{missingCount === 1 ? '' : 's'} missing from hREA.</strong
            >{/if}
        </p>
      </div>
      {#if dash.exchanges.length}
        <label class="hrea-picker label">
          <span>Exchange</span>
          <select
            class="select"
            value={dash.selected?.agreement_hash.toString()}
            onchange={(e) => dash.select(e.currentTarget.value)}
          >
            {#each dash.exchanges as x (x.agreement_hash.toString())}
              <option value={x.agreement_hash.toString()}>{dash.exchangeLabel(x)}</option>
            {/each}
          </select>
        </label>
      {/if}
    </div>

    {#if !dash.exchanges.length}
      <p class="hrea-sub">
        {dash.loading ? 'Reading exchanges…' : 'No exchange on this network yet.'}
      </p>
    {:else}
      <div class="hrea-stage-scroll">
        <div
          class="hrea-stage"
          role="list"
          aria-label="hREA records of this exchange"
          style="width:{CANVAS.w}px; height:{CANVAS.h}px"
        >
          <svg
            class="hrea-edges"
            viewBox="0 0 {CANVAS.w} {CANVAS.h}"
            width={CANVAS.w}
            height={CANVAS.h}
            aria-hidden="true"
          >
            <defs>
              <marker
                id="hrea-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L10,5 L0,10 z" class="hrea-arrow-head" />
              </marker>
            </defs>
            {#each EDGES as ed (ed.from + ed.to)}
              {@const a = anchor(ed.from, ed.fs)}
              {@const b = anchor(ed.to, ed.ts)}
              {@const live = present(ed.from) && present(ed.to)}
              <line
                x1={a[0]}
                y1={a[1]}
                x2={b[0]}
                y2={b[1]}
                class="hrea-edge"
                class:hrea-edge--dashed={ed.dashed}
                class:hrea-edge--ghost={!live}
                marker-end="url(#hrea-arrow)"
              />
              <text
                x={(a[0] + b[0]) / 2}
                y={(a[1] + b[1]) / 2}
                dy="-3"
                class="hrea-edge-label"
                class:hrea-edge-label--ghost={!live}
              >
                {ed.label}
              </text>
            {/each}
          </svg>
          {#each dash.flow as n (n.id)}
            {@const pos = LAYOUT[n.id]}
            <div
              class="hrea-node hrea-k--{n.kind} hrea-node--{n.state}"
              class:hrea-node--hover={hover === n.id}
              style="left:{pos.x}px; top:{pos.y}px; width:{pos.w}px; height:{pos.h}px"
              role="listitem"
              onmouseenter={() => (hover = n.id)}
              onmouseleave={() => hover === n.id && (hover = null)}
            >
              <span class="hrea-node-kind">{n.kind}</span>
              <span class="hrea-node-title">{n.title}</span>
              <span class="hrea-node-sub">{n.sub}</span>
              {#if n.state !== 'present'}<span class="hrea-node-state">{STATE_LABEL[n.state]}</span
                >{/if}
              <!-- What the inspector shows on hover, read in the list by screen readers. -->
              <span class="sr-only"
                >{n.state === 'present' ? STATE_LABEL[n.state] : ''}{#each n.fields as [k, v] (k)}; {k}:
                  {v}{/each}</span
              >
            </div>
          {/each}
        </div>
      </div>

      <div class="hrea-inspector" aria-live="polite">
        {#if hovered}
          <div class="hrea-inspector-head">
            <span class="hrea-pill hrea-k--{hovered.kind}">{hovered.kind}</span>
            <strong>{hovered.title}</strong>
            <span
              class="badge {hovered.state === 'present'
                ? 'variant-soft-success'
                : hovered.state === 'missing'
                  ? 'variant-filled-error'
                  : 'variant-soft-surface'}"
            >
              {STATE_LABEL[hovered.state]}
            </span>
          </div>
          <dl class="hrea-fields">
            {#each hovered.fields as f (f[0])}
              <div class="hrea-field">
                <dt>{f[0]}</dt>
                <dd>{f[1]}</dd>
              </div>
            {/each}
          </dl>
        {:else}
          <p class="hrea-sub">
            Missing: the exchange's stage expects it and hREA does not hold it. Not yet: the stage
            does not call for it. Not mapped: R&amp;O never mirrors it for this kind of term.
          </p>
        {/if}
      </div>
    {/if}
  </section>

  <section class="card space-y-3 p-4">
    <h2 class="h3">Known mapping gaps</h2>
    <p class="hrea-sub">
      What the mirror does not record yet. The audit above shows their effect; it does not hide it.
    </p>
    <ul class="space-y-3">
      {#each KNOWN_MAPPING_GAPS as g (g.title)}
        <li class="hrea-gap">
          <strong>{g.title}.</strong>
          {g.detail}
          <code class="hrea-note">{g.where}</code>
        </li>
      {/each}
    </ul>
  </section>

  <section class="card space-y-3 p-4">
    <h2 class="h3">ValueFlows vocabulary</h2>
    <div class="hrea-vocab">
      {#each VF_VOCAB as v (v.term)}
        <div class="hrea-vocab-item hrea-k--{v.kind}">
          <span class="hrea-vocab-dot"></span>
          <div>
            <strong>{v.term}</strong>
            <p class="hrea-sub">{v.def}</p>
          </div>
        </div>
      {/each}
    </div>
  </section>
</div>

<style>
  /* Ported from the design system's hREA admin view (app.css, hREA / ValueFlows
     block); colours stay on the Skeleton theme tokens, no new palette. */
  .hrea-intro {
    max-width: 780px;
    opacity: 0.85;
  }
  .hrea-sub {
    font-size: 13px;
    line-height: 19px;
    opacity: 0.7;
    margin: 0;
  }

  .hrea-counts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
    gap: 12px;
  }
  /* A Skeleton card, so it carries its own surface: the admin layout keeps its
     content area dark in light mode, and a transparent card put black text on it. */
  .hrea-count-card {
    border: 1px solid rgb(var(--color-surface-500) / 0.2);
    border-top: 3px solid rgb(var(--k));
    border-radius: 12px;
    padding: 16px;
  }
  .hrea-count-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: rgb(var(--k));
    margin-bottom: 8px;
  }
  .hrea-count-v {
    font-weight: 700;
    font-size: 28px;
    line-height: 32px;
  }
  .hrea-count-l {
    font-weight: 500;
    font-size: 12px;
    opacity: 0.7;
    margin-top: 2px;
  }

  .hrea-map-arrow {
    opacity: 0.8;
    text-align: center;
    width: 28px;
  }
  .hrea-note {
    font-family: var(--theme-font-family-mono, monospace);
    font-size: 11px;
    background: rgb(var(--color-surface-500) / 0.12);
    padding: 2px 6px;
    border-radius: 5px;
  }
  :global(tr.hrea-row--mismatch) td {
    background: rgb(var(--color-error-500) / 0.1);
  }

  .hrea-pill {
    --k: var(--color-secondary-500);
    --kt: var(--color-secondary-900);
    --kl: var(--color-secondary-400);
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 9999px;
    font-weight: 600;
    font-size: 12px;
    line-height: 16px;
    background: rgb(var(--k) / 0.18);
    color: rgb(var(--kt));
    border: 1px solid rgb(var(--kt) / 0.6);
  }
  :global(.dark) .hrea-pill {
    color: rgb(var(--kl));
    border-color: rgb(var(--kl) / 0.6);
  }

  .hrea-graph-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
    flex-wrap: wrap;
  }
  .hrea-picker select {
    min-width: 280px;
  }
  .hrea-caveat {
    margin-top: 0.25rem;
    font-size: 0.75rem;
    opacity: 0.8;
  }
  .hrea-stage-scroll {
    overflow-x: auto;
    padding-bottom: 6px;
  }
  .hrea-stage {
    position: relative;
    background: rgb(var(--color-surface-900) / 0.06);
    border: 1px solid rgb(var(--color-surface-500) / 0.2);
    border-radius: 12px;
    background-image: radial-gradient(rgb(var(--color-surface-500) / 0.15) 1px, transparent 1px);
    background-size: 22px 22px;
  }
  .hrea-edges {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: visible;
  }
  /* Every colour below is a theme shade picked per mode and measured at WCAG AA:
     4.5:1 for text, 3:1 for strokes, dashed borders and tags. --hrea-halo is the
     stage's own colour, painted behind edge labels so a line never runs through one. */
  .hrea-stage {
    --hrea-ink: var(--color-surface-900);
    --hrea-ghost: var(--color-surface-600);
    --hrea-line: var(--color-surface-600);
    --hrea-line-ghost: var(--color-surface-500);
    --hrea-halo: var(--color-surface-50);
  }
  :global(.dark) .hrea-stage {
    --hrea-ink: var(--color-surface-50);
    --hrea-ghost: var(--color-surface-300);
    --hrea-line: var(--color-surface-300);
    --hrea-line-ghost: var(--color-surface-400);
    --hrea-halo: var(--color-surface-800);
  }
  .hrea-edge {
    stroke: rgb(var(--hrea-line));
    stroke-width: 1.5;
    fill: none;
  }
  .hrea-edge--dashed {
    stroke-dasharray: 5 4;
  }
  .hrea-edge--ghost {
    stroke: rgb(var(--hrea-line-ghost));
  }
  .hrea-arrow-head {
    fill: rgb(var(--hrea-line));
  }
  .hrea-edge-label {
    fill: rgb(var(--hrea-ink));
    font-weight: 600;
    font-size: 10px;
    text-anchor: middle;
    paint-order: stroke;
    stroke: rgb(var(--hrea-halo));
    stroke-width: 4px;
    stroke-linejoin: round;
  }
  .hrea-edge-label--ghost {
    fill: rgb(var(--hrea-ghost));
  }

  .hrea-node {
    position: absolute;
    background: rgb(var(--color-surface-50));
    color: rgb(var(--color-surface-900));
    border-radius: 10px;
    border-left: 4px solid rgb(var(--kt));
    box-shadow: 0 2px 6px rgb(0 0 0 / 0.18);
    padding: 7px 12px;
    display: flex;
    flex-direction: column;
    gap: 1px;
    overflow: hidden;
    transition:
      transform 100ms,
      box-shadow 100ms;
  }
  .hrea-node-kind {
    font-weight: 700;
    font-size: 9px;
    line-height: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: rgb(var(--kt));
  }
  .hrea-node-title {
    font-weight: 700;
    font-size: 13px;
    line-height: 17px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .hrea-node-sub {
    font-size: 11px;
    line-height: 15px;
    opacity: 0.75;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .hrea-node--hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 14px rgb(0 0 0 / 0.25);
    z-index: 5;
    cursor: pointer;
  }
  .hrea-node--hover:focus-visible {
    outline: 2px solid rgb(var(--color-primary-500));
    outline-offset: 2px;
  }
  .hrea-node--not-yet,
  .hrea-node--not-mapped {
    background: rgb(var(--color-surface-500) / 0.08);
    color: inherit;
    border: 1px dashed rgb(var(--color-surface-500));
    border-left: 4px dashed rgb(var(--kt));
    box-shadow: none;
  }
  :global(.dark) .hrea-node--not-yet,
  :global(.dark) .hrea-node--not-mapped {
    border-color: rgb(var(--color-surface-300));
    border-left-color: rgb(var(--kl));
  }
  :global(.dark) .hrea-node--not-yet .hrea-node-kind,
  :global(.dark) .hrea-node--not-mapped .hrea-node-kind {
    color: rgb(var(--kl));
  }
  .hrea-node--missing {
    border: 2px solid rgb(var(--color-error-500));
    border-left: 4px solid rgb(var(--color-error-500));
  }
  .hrea-node-state {
    position: absolute;
    top: 6px;
    right: 9px;
    font-weight: 700;
    font-size: 8px;
    line-height: 1;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.7;
  }
  .hrea-node--missing .hrea-node-state {
    color: rgb(var(--color-error-500));
    opacity: 1;
  }

  .hrea-inspector {
    border-top: 1px solid rgb(var(--color-surface-500) / 0.25);
    padding-top: 14px;
    min-height: 92px;
  }
  .hrea-inspector-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .hrea-fields {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 6px 18px;
    margin: 0;
  }
  .hrea-field {
    display: flex;
    gap: 8px;
    font-size: 12px;
    line-height: 18px;
  }
  .hrea-field dt {
    opacity: 0.55;
    min-width: 76px;
  }
  .hrea-field dd {
    margin: 0;
    word-break: break-word;
  }

  .hrea-gap {
    font-size: 14px;
    line-height: 21px;
  }
  .hrea-gap .hrea-note {
    display: inline-block;
    margin-left: 6px;
  }

  .hrea-vocab {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 14px;
  }
  .hrea-vocab-item {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .hrea-vocab-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: rgb(var(--k));
    margin-top: 4px;
    flex-shrink: 0;
  }

  .hrea-k--agent {
    --k: var(--color-primary-500);
    --kt: var(--color-primary-700);
    --kl: var(--color-primary-300);
  }
  .hrea-k--spec {
    --k: var(--color-surface-400);
    --kt: var(--color-surface-600);
    --kl: var(--color-surface-300);
  }
  .hrea-k--proposal {
    --k: var(--color-secondary-500);
    --kt: var(--color-secondary-900);
    --kl: var(--color-secondary-400);
  }
  .hrea-k--intent {
    --k: var(--color-warning-500);
    --kt: var(--color-warning-900);
    --kl: var(--color-warning-400);
  }
  .hrea-k--agreement {
    --k: var(--color-success-500);
    --kt: var(--color-success-900);
    --kl: var(--color-success-400);
  }
  .hrea-k--commitment {
    --k: var(--color-tertiary-500);
    --kt: var(--color-tertiary-900);
    --kl: var(--color-tertiary-400);
  }
  .hrea-k--event {
    --k: var(--color-error-500);
    --kt: var(--color-error-700);
    --kl: var(--color-error-300);
  }
  .hrea-k--fulfillment {
    --k: var(--color-success-600);
    --kt: var(--color-success-800);
    --kl: var(--color-success-400);
  }
</style>
