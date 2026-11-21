export type PrerequisiteAvailability = {
  readonly serviceTypes: boolean;
  readonly mediumsOfExchange: boolean;
};

export type PrerequisiteListing = 'offers' | 'requests';
export type PrerequisiteVerb = 'create' | 'edit';

/**
 * The headline and explanation of the prerequisite wall, built from what is actually
 * missing. A fixed headline named service types while only the medium of exchange was
 * missing (dogfooding of 21 November, F3).
 */
export function prerequisiteWall(
  available: PrerequisiteAvailability,
  listing: PrerequisiteListing,
  verb: PrerequisiteVerb
): { title: string; description: string } {
  const noun = listing === 'offers' ? 'Offers' : 'Requests';
  const missingTypes = !available.serviceTypes;
  const missingMedium = !available.mediumsOfExchange;

  const what =
    missingTypes && missingMedium
      ? 'Service Types and a Medium of Exchange Are'
      : missingTypes
        ? 'Service Types Are'
        : 'A Medium of Exchange Is';

  const needs = [
    missingTypes ? 'be categorized with a service type' : null,
    missingMedium ? 'name a medium of exchange' : null
  ]
    .filter(Boolean)
    .join(' and ');
  const adminTask = [
    missingTypes ? 'create service types' : null,
    missingMedium ? 'approve a medium of exchange' : null
  ]
    .filter(Boolean)
    .join(' and ');

  return {
    title: `${what} Required for ${noun}`,
    description: `${noun} must ${needs}. Administrators need to ${adminTask} before members can ${verb} ${listing}.`
  };
}
