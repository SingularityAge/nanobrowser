import type { DirectorCtlOptions } from './service';
import { directorSettingsStore, DEFAULT_DIRECTOR_SETTINGS } from '@extension/storage';

/**
 * Resolve Director control parameters by merging defaults, persisted settings, and per-call overrides.
 */
export async function getDirectorCtlOptions(overrides?: Partial<DirectorCtlOptions>): Promise<DirectorCtlOptions> {
  try {
    const stored = await directorSettingsStore.getSettings();
    return {
      visionScoreOffset: stored.visionScoreOffset,
      hysteresisMargin: stored.hysteresisMargin,
      preferDomOnTie: stored.preferDomOnTie,
      ...overrides,
    };
  } catch (error) {
    console.warn('[Director] Failed to load persisted settings, falling back to defaults.', error);
    return {
      visionScoreOffset: DEFAULT_DIRECTOR_SETTINGS.visionScoreOffset,
      hysteresisMargin: DEFAULT_DIRECTOR_SETTINGS.hysteresisMargin,
      preferDomOnTie: DEFAULT_DIRECTOR_SETTINGS.preferDomOnTie,
      ...overrides,
    };
  }
}
