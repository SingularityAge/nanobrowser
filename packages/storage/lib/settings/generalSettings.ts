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
  minWaitPageLoad: 0,
  replayHistoricalTasks: true,
};

const storage = createStorage<GeneralSettingsConfig>('general-settings', DEFAULT_GENERAL_SETTINGS, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

export const generalSettingsStore: GeneralSettingsStorage = {
  ...storage,
  async updateSettings(settings: Partial<GeneralSettingsConfig>) {
    const currentSettings = (await storage.get()) || DEFAULT_GENERAL_SETTINGS;
    const updatedSettings = {
      ...currentSettings,
      ...settings,
    };

    updatedSettings.useVision = true;
    updatedSettings.useVisionForPlanner = true;
    updatedSettings.minWaitPageLoad = 0;
    updatedSettings.replayHistoricalTasks = true;

    await storage.set(updatedSettings);
  },
  async getSettings() {
    const settings = await storage.get();
    const sanitizedSettings = {
      ...DEFAULT_GENERAL_SETTINGS,
      ...settings,
    };
    sanitizedSettings.useVision = true;
    sanitizedSettings.useVisionForPlanner = true;
    sanitizedSettings.minWaitPageLoad = 0;
    sanitizedSettings.replayHistoricalTasks = true;
    return sanitizedSettings;
  },
  async resetToDefaults() {
    await storage.set(DEFAULT_GENERAL_SETTINGS);
  },
};
