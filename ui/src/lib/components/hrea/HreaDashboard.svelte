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

  /** A Commitment's tag: finished, open, or open while R&O says it is over. */
  function progressLabel(n: FlowNode): string {
    if (n.progress === 'unknown') return 'state unread';
    if (n.progress === 'open' && n.behind) return 'open, behind R&O';
    return n.progress ?? '';
  }

  const STATE_LABEL: Record<FlowState, string> = {
    present: 'in hREA',
    missing: 'missing',
    'not-yet': 'not yet created',
    ended: 'will not happen',
    'no-resource': 'no resource',
    'not-mapped': 'not mapped'
  };

  /** What each node state means, in the order a reader meets them; one entry per FlowState. */
  const LEGEND: readonly { state: FlowState; meaning: string }[] = [
    { state: 'present', meaning: 'hREA holds this record.' },
    {
      state: 'missing',
      meaning:
        'The exchange has reached the stage that needs this record, and hREA does not hold it: the mirror is incomplete.'
    },
    { state: 'not-yet', meaning: 'The exchange has not reached the stage that creates it.' },
    {
      state: 'ended',
      meaning: 'The exchange was cancelled, declined or withdrawn before that stage.'
    },
    {
      state: 'no-resource',
      meaning:
        'The reciprocal moves nothing (a gift, or a term still to be discussed), so no resource specification is drawn.'
    },
    {
      state: 'not-mapped',
      meaning: 'The service is still to be discussed, so R&O writes no mirror for it.'
    }
  ];

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

  /**
   * The graph as a whiteboard: it fits the panel by default, and zooms and pans like
   * one (buttons, Ctrl or Cmd with the wheel, a drag, the arrow keys), instead of a
   * sideways scroll that cut off the left column (Sam, 20 November).
   */
  let viewW = $state(0);
  let zoom = $state<number | null>(null); // null: fit the panel
  let pan = $state({ x: 0, y: 0 });
  const ZOOM_MIN = 0.4;
  const ZOOM_MAX = 2;
  const fitScale = $derived(viewW > 0 ? Math.min(1, viewW / CANVAS.w) : 1);
  const scale = $derived(zoom ?? fitScale);
  const viewH = $derived(CANVAS.h * Math.max(fitScale, Math.min(scale, 1)));
  const clampPan = (x: number, y: number) => {
    const minX = Math.min(0, viewW - CANVAS.w * scale);
    const minY = Math.min(0, viewH - CANVAS.h * scale);
    // A stage narrower than the panel sits in its middle; a wider one may move between
    // its two edges.
    const centred = (viewW - CANVAS.w * scale) / 2;
    return {
      x: centred >= 0 ? centred : Math.min(Math.max(x, minX), 0),
      y: Math.min(Math.max(y, minY), 0)
    };
  };
  function setZoom(next: number | null, about?: { x: number; y: number }) {
    if (next === null) {
      zoom = null;
      pan = clampPan((viewW - CANVAS.w * fitScale) / 2, 0);
      return;
    }
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
    // Keep the point under the pointer (or the view's centre) where it was.
    const c = about ?? { x: viewW / 2, y: viewH / 2 };
    const sx = (c.x - pan.x) / scale;
    const sy = (c.y - pan.y) / scale;
    zoom = z;
    pan = clampPan(c.x - sx * z, c.y - sy * z);
  }
  $effect(() => {
    // Refit when the panel changes size while fitted.
    if (zoom === null && viewW > 0) pan = clampPan((viewW - CANVAS.w * fitScale) / 2, 0);
  });
  let drag = $state<{ x: number; y: number; px: number; py: number } | null>(null);
  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0 || !e.isPrimary) return;
    drag = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: PointerEvent) {
    if (!drag) return;
    pan = clampPan(drag.px + e.clientX - drag.x, drag.py + e.clientY - drag.y);
  }
  function onPointerUp() {
    drag = null;
  }
  function onWheel(e: WheelEvent) {
    if (!(e.ctrlKey || e.metaKey)) return; // a plain wheel scrolls the page
    e.preventDefault();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setZoom(scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1), {
      x: e.clientX - r.left,
      y: e.clientY - r.top
    });
  }
  /**
   * Tabbing to a node the viewport has clipped makes the browser scroll the viewport to
   * it. That scroll is folded into the pan, so dragging and the clamps keep working.
   */
  function onFocusScroll(e: Event) {
    const v = e.currentTarget as HTMLElement;
    if (!v.scrollLeft && !v.scrollTop) return;
    pan = clampPan(pan.x - v.scrollLeft, pan.y - v.scrollTop);
    v.scrollLeft = 0;
    v.scrollTop = 0;
  }
  function onKey(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // the browser's own zoom and shortcuts
    const step = 40;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step]
    };
    if (e.key in moves) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      pan = clampPan(pan.x + dx, pan.y + dy);
    } else if (e.key === '+' || e.key === '=') setZoom(scale * 1.25);
    else if (e.key === '-') setZoom(scale / 1.25);
    else if (e.key === '0') setZoom(null);
  }

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
          One exchange's ValueFlows structure, each node marked from what hREA holds. Hover, tap or
          tab to a node to inspect it; screen readers read each node's fields in the list.
          {#if missingCount}<strong class="text-error-600 dark:text-error-300"
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
      <div class="hrea-zoom-bar" role="group" aria-label="Zoom the graph">
        <button
          type="button"
          class="variant-ghost btn btn-sm"
          aria-label="Zoom out"
          disabled={scale <= ZOOM_MIN}
          onclick={() => setZoom(scale / 1.25)}>−</button
        >
        <button
          type="button"
          class="variant-ghost btn btn-sm"
          aria-pressed={zoom === null}
          onclick={() => setZoom(null)}>Fit</button
        >
        <button
          type="button"
          class="variant-ghost btn btn-sm"
          aria-label="Zoom in"
          disabled={scale >= ZOOM_MAX}
          onclick={() => setZoom(scale * 1.25)}>+</button
        >
        <span class="hrea-zoom-level" aria-live="polite">{Math.round(scale * 100)}%</span>
        <span class="hrea-zoom-hint">Drag to move; Ctrl or ⌘ with the wheel to zoom.</span>
      </div>
      <!--
        A focusable region the arrow keys move and plus and minus zoom, as a map does; the
        buttons above do the same for anyone not using the keyboard here.
      -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <div
        class="hrea-viewport"
        class:hrea-viewport--dragging={drag !== null}
        class:hrea-viewport--zoomed={scale > fitScale + 0.001}
        bind:clientWidth={viewW}
        style="height:{viewH}px"
        tabindex="0"
        role="region"
        aria-label="Economic-flow graph. Arrow keys move it, plus and minus zoom, 0 fits it."
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
        onpointercancel={onPointerUp}
        onwheel={onWheel}
        onkeydown={onKey}
        onscroll={onFocusScroll}
        data-testid="hrea-viewport"
      >
        <div
          class="hrea-stage"
          role="list"
          aria-label="hREA records of this exchange"
          style="width:{CANVAS.w}px; height:{CANVAS.h}px; transform: translate({pan.x}px, {pan.y}px) scale({scale})"
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
            <!--
              A list item a keyboard can reach and a tap can open: focusing or tapping it
              shows it in the inspector, as hovering does, so the inspector is not
              pointer-only.
            -->
            <div
              class="hrea-node hrea-k--{n.kind} hrea-node--{n.state}"
              class:hrea-node--hover={hover === n.id}
              style="left:{pos.x}px; top:{pos.y}px; width:{pos.w}px; height:{pos.h}px"
              role="listitem"
              tabindex="0"
              onmouseenter={() => (hover = n.id)}
              onmouseleave={() => hover === n.id && (hover = null)}
              onfocus={() => (hover = n.id)}
              onblur={() => hover === n.id && (hover = null)}
              onpointerdown={(e) => {
                // A tap shows the node in the inspector; it does not start a drag.
                e.stopPropagation();
                hover = n.id;
              }}
            >
              <span class="hrea-node-kind">{n.kind}</span>
              <span class="hrea-node-title">{n.title}</span>
              <span class="hrea-node-sub">{n.sub}</span>
              {#if n.state !== 'present'}<span class="hrea-node-state">{STATE_LABEL[n.state]}</span
                >{:else if n.progress}<span
                  class="hrea-node-state hrea-progress--{n.progress}"
                  class:hrea-progress--behind={n.behind}
                  aria-hidden="true"
                  data-testid="commitment-progress">{progressLabel(n)}</span
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
          <p class="hrea-sub">Hover, tap or tab to a node to read its fields here.</p>
        {/if}
      </div>

      <div class="hrea-legend">
        <h3 class="hrea-legend-title">Reading a node</h3>
        <ul class="hrea-legend-list">
          {#each LEGEND as l (l.state)}
            <li class="hrea-legend-item">
              <span
                class="hrea-node hrea-k--spec hrea-node--{l.state} hrea-legend-swatch"
                aria-hidden="true"
              >
                <span class="hrea-node-title">{STATE_LABEL[l.state]}</span>
              </span>
              <span><strong>{STATE_LABEL[l.state]}</strong>: {l.meaning}</span>
            </li>
          {/each}
        </ul>
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
  .hrea-zoom-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  .hrea-zoom-level {
    min-width: 3.5rem;
    font-variant-numeric: tabular-nums;
    font-size: 0.875rem;
  }
  .hrea-zoom-hint {
    font-size: 0.875rem;
    color: rgb(var(--color-surface-600));
  }
  :global(.dark) .hrea-zoom-hint {
    color: rgb(var(--color-surface-300));
  }
  .hrea-viewport {
    position: relative;
    overflow: hidden;
    cursor: grab;
    /* Fitted, a touch scrolls the page; zoomed in, it moves the graph. */
    touch-action: pan-y;
    border-radius: 12px;
  }
  .hrea-viewport--zoomed {
    touch-action: none;
  }
  .hrea-viewport--dragging {
    cursor: grabbing;
  }
  .hrea-viewport:focus-visible {
    outline: 2px solid rgb(var(--color-primary-500));
    outline-offset: 2px;
  }
  :global(.dark) .hrea-viewport:focus-visible {
    outline-color: rgb(var(--color-primary-300));
  }
  .hrea-node:focus-visible {
    outline: 2px solid rgb(var(--color-primary-500));
    outline-offset: 2px;
  }
  /* The ring sits on the stage, dark in the admin area: primary-300 there (5.4:1). */
  :global(.dark) .hrea-node:focus-visible {
    outline-color: rgb(var(--color-primary-300));
  }
  .hrea-stage {
    transform-origin: 0 0;
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
  .hrea-node--ended,
  .hrea-node--no-resource,
  .hrea-node--not-mapped {
    background: rgb(var(--color-surface-500) / 0.08);
    color: inherit;
    border: 1px dashed rgb(var(--color-surface-500));
    border-left: 4px dashed rgb(var(--kt));
    box-shadow: none;
  }
  :global(.dark) .hrea-node--not-yet,
  :global(.dark) .hrea-node--ended,
  :global(.dark) .hrea-node--no-resource,
  :global(.dark) .hrea-node--not-mapped {
    border-color: rgb(var(--color-surface-300));
    border-left-color: rgb(var(--kl));
  }
  :global(.dark) .hrea-node--not-yet .hrea-node-kind,
  :global(.dark) .hrea-node--ended .hrea-node-kind,
  :global(.dark) .hrea-node--no-resource .hrea-node-kind,
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
    font-size: 9px;
    line-height: 1;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.7;
  }
  .hrea-progress--finished {
    color: rgb(var(--color-success-900));
    opacity: 1;
  }
  .hrea-progress--behind {
    color: rgb(var(--color-warning-800));
    opacity: 1;
  }
  .hrea-node--missing .hrea-node-state {
    /* error-700 on the node's surface-50: 6.6:1 (error-500 was 4.3:1) */
    color: rgb(var(--color-error-700));
    opacity: 1;
  }

  .hrea-legend {
    border-top: 1px solid rgb(var(--color-surface-500) / 0.25);
    padding-top: 14px;
  }
  .hrea-legend-title {
    font-weight: 600;
    font-size: 14px;
    margin: 0 0 10px;
  }
  .hrea-legend-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 10px 24px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .hrea-legend-item {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
    line-height: 18px;
  }
  .hrea-legend-swatch {
    position: static;
    flex: none;
    width: 132px;
    padding: 6px 10px;
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
