import { StorageEnum } from '../base/enums';
import { createStorage } from '../base/base';
import type { BaseStorage } from '../base/types';

// Interface for general settings configuration
export interface GeneralSettingsConfig {
  maxSteps: number;
  maxActionsPerStep: number;
  maxFailures: number;
  useVision: boolean;
  useVisionForPlanner: boolean;
  planningInterval: number;
  displayHighlights: boolean;
  minWaitPageLoad: number;
  replayHistoricalTasks: boolean;
}

export type GeneralSettingsStorage = BaseStorage<GeneralSettingsConfig> & {
  updateSettings: (settings: Partial<GeneralSettingsConfig>) => Promise<void>;
  getSettings: () => Promise<GeneralSettingsConfig>;
  resetToDefaults: () => Promise<void>;
};

// Default settings
export const DEFAULT_GENERAL_SETTINGS: GeneralSettingsConfig = {
  maxSteps: 100,
  maxActionsPerStep: 5,
  maxFailures: 3,
  useVision: true,
  useVisionForPlanner: true,
  planningInterval: 3,
  displayHighlights: true,
  minWaitPageLoad: 250,
  replayHistoricalTasks: true,
};

const applyVisionConstraints = (settings: GeneralSettingsConfig): GeneralSettingsConfig => {
  const withVision = {
    ...settings,
    useVision: true,
    useVisionForPlanner: true,
  };

  if (withVision.useVision && !withVision.displayHighlights) {
    return {
      ...withVision,
      displayHighlights: true,
    };
  }

  return withVision;
};

const storage = createStorage<GeneralSettingsConfig>('general-settings', DEFAULT_GENERAL_SETTINGS, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

export const generalSettingsStore: GeneralSettingsStorage = {
  ...storage,
  async updateSettings(settings: Partial<GeneralSettingsConfig>) {
    const currentSettings = (await storage.get()) || DEFAULT_GENERAL_SETTINGS;
    const updatedSettings = applyVisionConstraints({
      ...currentSettings,
      ...settings,
    });

    await storage.set(updatedSettings);
  },
  async getSettings() {
    const settings = await storage.get();
    return applyVisionConstraints({
      ...DEFAULT_GENERAL_SETTINGS,
      ...settings,
    });
  },
  async resetToDefaults() {
    await storage.set(DEFAULT_GENERAL_SETTINGS);
  },
};
