import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import type { ActionHash } from '@holochain/client';
import { createMockActionHash } from '../../test-helpers';

const { approved } = vi.hoisted(() => ({ approved: [] as Array<Record<string, unknown>> }));

const fixtures = [
  {
    original_action_hash: createMockActionHash('web'),
    previous_action_hash: createMockActionHash('web'),
    name: 'Web Development',
    description: 'Sites and apps',
    technical: true,
    status: 'approved',
    created_at: 1,
    updated_at: 1
  },
  {
    original_action_hash: createMockActionHash('design'),
    previous_action_hash: createMockActionHash('design'),
    name: 'Graphic Design',
    description: 'Logos',
    technical: false,
    status: 'approved',
    created_at: 2,
    updated_at: 2
  }
];
approved.push(...fixtures);

vi.mock('@skeletonlabs/skeleton', () => ({
  getToastStore: () => ({ trigger: vi.fn() })
}));
vi.mock('$lib/stores/serviceTypes.store.svelte', () => ({
  default: { approvedServiceTypes: approved, getApprovedServiceTypes: () => undefined }
}));
vi.mock('$lib/utils/effect', () => ({ runEffect: <T>(value: T) => value }));

import ServiceTypeSelector from '$lib/components/service-types/ServiceTypeSelector.svelte';

const options = async (container: HTMLElement) => {
  await vi.waitFor(() => {
    if (
      container.querySelectorAll(
        'label.label input[type="radio"], label.label input[type="checkbox"]'
      ).length < approved.length
    )
      throw new Error('not loaded');
  });
  return [
    ...container.querySelectorAll<HTMLInputElement>(
      'label.label input[type="radio"], label.label input[type="checkbox"]'
    )
  ];
};

describe('ServiceTypeSelector', () => {
  it('a listing picks one service type with radio buttons sharing one group', async () => {
    const { container } = render(ServiceTypeSelector, { single: true, id: 'offer-service-types' });
    const inputs = await options(container);
    expect(inputs.map((i) => i.type)).toEqual(['radio', 'radio']);
    expect(new Set(inputs.map((i) => i.name))).toEqual(new Set(['offer-service-types-choice']));
  });

  it('picking a second service type replaces the first', async () => {
    // The selector is controlled: like OfferForm, the parent feeds each pick back in.
    let selected: ActionHash[] = [];
    const view = render(ServiceTypeSelector, {
      single: true,
      id: 'offer-service-types',
      onSelectionChange: (hashes: ActionHash[]) => {
        selected = hashes;
        void view.rerender({ selectedServiceTypes: hashes });
      }
    });
    const [first, second] = await options(view.container);
    await fireEvent.click(first);
    await fireEvent.click(second);
    expect(selected).toHaveLength(1);
    await vi.waitFor(async () => {
      const checked = (await options(view.container)).filter((i) => i.checked);
      expect(checked.map((i) => i.value)).toEqual([second.value]);
    });
  });

  it('keeps checkboxes when several service types may be picked', async () => {
    const { container } = render(ServiceTypeSelector, {});
    const inputs = await options(container);
    expect(inputs.map((i) => i.type)).toEqual(['checkbox', 'checkbox']);
    expect(inputs.every((i) => !i.name)).toBe(true);
  });
});
