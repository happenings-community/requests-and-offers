/**
 * The start-up screen's progress: the share of its steps that are finished.
 *
 * A skipped step is finished too: the non-critical steps (hREA, the network check, the
 * member's profile) are skipped when they fail, and the app carries on, so a skip must not
 * hold the bar short of 100%.
 */
export type StartupStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export function startupProgress(steps: ReadonlyArray<{ status: StartupStepStatus }>): number {
  if (steps.length === 0) return 0;
  const finished = steps.filter((s) => s.status === 'completed' || s.status === 'skipped').length;
  return Math.round((finished / steps.length) * 100);
}
