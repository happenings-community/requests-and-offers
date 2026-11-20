import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import OrganizationFilterControls from '$lib/components/organizations/OrganizationFilterControls.svelte';
import type { UIOrganization } from '$lib/types/ui';

const org = (name: string) =>
  ({
    name,
    description: '',
    full_legal_name: '',
    email: '',
    location: ''
  }) as unknown as UIOrganization;

/**
 * The five list searches show how many of a list they show as one line, where a "Search
 * Results" card once stood (Sam's walk, 20 November). Drawn the same way in each; this
 * one stands for them.
 */
describe('a list search counts what it shows', () => {
  it('says how many in all, then how many of them a search leaves', async () => {
    render(OrganizationFilterControls, {
      organizations: [org('Garden Collective'), org('Bike Kitchen'), org('Garden Share')]
    });
    expect(screen.getByText('3 in all')).toBeTruthy();

    const input = screen.getByRole('searchbox');
    await fireEvent.input(input, { target: { value: 'garden' } });
    expect(screen.getByText('Showing 2 of 3')).toBeTruthy();
    expect(screen.queryByText('Search Results')).toBeNull();
  });
});
