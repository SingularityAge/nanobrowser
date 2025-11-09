import type { DirectorCtlOptions } from './service';

export interface DirectorConfig {
  /**
   * Default control parameters that are merged with runtime overrides.
   * Update these values to tweak arbitration behaviour without touching service logic.
   */
  control: Partial<DirectorCtlOptions>;
}

/**
 * Baseline control options used when no overrides are supplied.
 * These are intentionally conservative to avoid oscillations between DOM and vision modes.
 */
export const DIRECTOR_DEFAULT_CTL: DirectorCtlOptions = {
  visionScoreOffset: 0.05,
  hysteresisMargin: 0.08,
  preferDomOnTie: true,
};

/**
 * Placeholder for future dynamic configuration (e.g. remote flags or user settings).
 * Today this simply allows code-based overrides while keeping the merge logic in one place.
 */
const staticDirectorConfig: DirectorConfig = {
  control: {},
};

/**
 * Resolve Director control parameters by merging defaults, static config, and per-call overrides.
 */
export function getDirectorCtlOptions(overrides?: Partial<DirectorCtlOptions>): DirectorCtlOptions {
  return {
    ...DIRECTOR_DEFAULT_CTL,
    ...staticDirectorConfig.control,
    ...overrides,
  };
}
