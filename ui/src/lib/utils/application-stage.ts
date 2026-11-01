/**
 * Where a pending application stands, for the admin queue (#331).
 *
 * Worked out from two records that already exist, so there is no flag to keep in
 * step: the latest status revision (a pending status whose reason is a request for
 * more information, and when it was written) and the profile's latest revision
 * (when the applicant last edited it). The two times come from different agents'
 * clocks, so a response within moments of a request could be read either way.
 */

export type ApplicationStage = 'new' | 'waiting' | 'responded';

export const APPLICATION_STAGE_LABEL: Record<ApplicationStage, string> = {
  new: 'New application',
  waiting: 'Waiting for applicant',
  responded: 'Applicant responded'
};

export interface StageStatus {
  status_type?: string;
  reason?: string;
  /** When the status revision was written, in milliseconds. */
  created_at?: number;
}

/**
 * The stage of a pending application, or null for anyone who isn't pending.
 *
 * @param status the latest status
 * @param profileUpdatedAt when the profile's latest revision was written, in milliseconds
 */
export function applicationStage(
  status: StageStatus | null | undefined,
  profileUpdatedAt: number | null | undefined
): ApplicationStage | null {
  if (status?.status_type !== 'pending') return null;
  if (!status.reason?.trim()) return 'new';
  // Without both times nothing can be said to have changed since the request.
  if (status.created_at == null || profileUpdatedAt == null) return 'waiting';
  return profileUpdatedAt > status.created_at ? 'responded' : 'waiting';
}
