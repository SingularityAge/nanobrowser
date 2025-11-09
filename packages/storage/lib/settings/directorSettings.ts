import { createStorage } from '../base/base';
import { StorageEnum } from '../base/enums';
import type { BaseStorage } from '../base/types';

export interface DirectorSettingsConfig {
  visionScoreOffset: number;
  hysteresisMargin: number;
  preferDomOnTie: boolean;
}

export const DEFAULT_DIRECTOR_SETTINGS: DirectorSettingsConfig = {
  visionScoreOffset: 0.05,
  hysteresisMargin: 0.08,
  preferDomOnTie: true,
};

export type DirectorSettingsStorage = BaseStorage<DirectorSettingsConfig> & {
  updateSettings: (settings: Partial<DirectorSettingsConfig>) => Promise<void>;
  getSettings: () => Promise<DirectorSettingsConfig>;
  resetToDefaults: () => Promise<void>;
};

const storage = createStorage<DirectorSettingsConfig>('director-settings', DEFAULT_DIRECTOR_SETTINGS, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export const directorSettingsStore: DirectorSettingsStorage = {
  ...storage,
  async updateSettings(settings: Partial<DirectorSettingsConfig>) {
    await storage.set(prev => {
      const merged: DirectorSettingsConfig = {
        ...DEFAULT_DIRECTOR_SETTINGS,
        ...prev,
        ...settings,
      };

      return {
        visionScoreOffset: clamp(merged.visionScoreOffset, 0, 1),
        hysteresisMargin: clamp(merged.hysteresisMargin, 0, 1),
        preferDomOnTie: Boolean(merged.preferDomOnTie),
      };
    });
  },
  async getSettings() {
    const current = await storage.get();
    return {
      visionScoreOffset: clamp(current.visionScoreOffset, 0, 1),
      hysteresisMargin: clamp(current.hysteresisMargin, 0, 1),
      preferDomOnTie: Boolean(current.preferDomOnTie),
    };
  },
  async resetToDefaults() {
    await storage.set(DEFAULT_DIRECTOR_SETTINGS);
  },
};
