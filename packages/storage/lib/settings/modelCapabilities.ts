import { ProviderTypeEnum } from './types';

export interface ModelCapability {
  top_k: boolean;
  max_top_k?: number;
}

const TOP_K_SUPPORTED_FAMILIES = [/mistral/i, /mixtral/i, /llama/i, /qwen/i, /deepseek/i, /command/i, /mpt/i, /yi/i];

const DEFAULT_MAX_TOP_K = 200;

/**
 * Returns capability metadata for a target model/provider combo.
 * Currently only top_k support is differentiated via conservative allowlist.
 */
export function getModelCaps(modelId: string, providerId: string): ModelCapability {
  const normalizedModelId = (modelId || '').toLowerCase();
  const normalizedProviderId = (providerId || '').toLowerCase();

  // Explicitly disable top_k for providers we know do not expose it
  if (normalizedProviderId === ProviderTypeEnum.Ollama || normalizedProviderId === ProviderTypeEnum.Anthropic) {
    return { top_k: false };
  }

  const topKSupported = TOP_K_SUPPORTED_FAMILIES.some(pattern => pattern.test(normalizedModelId));

  if (!topKSupported) {
    return { top_k: false };
  }

  return { top_k: true, max_top_k: DEFAULT_MAX_TOP_K };
}
