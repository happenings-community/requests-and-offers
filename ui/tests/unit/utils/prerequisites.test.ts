import { describe, it, expect } from 'vitest';
import { prerequisiteWall } from '$lib/utils/prerequisites';

/**
 * **The prerequisite wall names what is actually missing** (dogfooding of 21 November, F3).
 *
 * With a service type and no medium of exchange, /offers/create headlined "Service Types
 * Required for Offers" while the only missing item it listed was the medium.
 */
describe('prerequisiteWall', () => {
  it('names the medium of exchange when only the medium is missing', () => {
    const wall = prerequisiteWall(
      { serviceTypes: true, mediumsOfExchange: false },
      'offers',
      'create'
    );
    expect(wall.title).toBe('A Medium of Exchange Is Required for Offers');
    expect(wall.title).not.toMatch(/service type/i);
    expect(wall.description).toMatch(/medium of exchange/i);
    expect(wall.description).not.toMatch(/service type/i);
    expect(wall.description).toMatch(/before members can create offers/);
  });

  it('names the service types when only they are missing', () => {
    const wall = prerequisiteWall(
      { serviceTypes: false, mediumsOfExchange: true },
      'requests',
      'edit'
    );
    expect(wall.title).toBe('Service Types Are Required for Requests');
    expect(wall.description).not.toMatch(/medium/i);
    expect(wall.description).toMatch(/before members can edit requests/);
  });

  it('names both when both are missing', () => {
    const wall = prerequisiteWall(
      { serviceTypes: false, mediumsOfExchange: false },
      'offers',
      'create'
    );
    expect(wall.title).toBe('Service Types and a Medium of Exchange Are Required for Offers');
    expect(wall.description).toMatch(/service types/);
    expect(wall.description).toMatch(/medium of exchange/);
  });
});
