import { useState, useEffect } from 'react';
import '@src/Options.css';
import { Button } from '@extension/ui';
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { FiSettings } from 'react-icons/fi';
import {
  llmProviderStore,
  agentModelStore,
  AgentNameEnum,
  ProviderTypeEnum,
  getDefaultProviderConfig,
} from '@extension/storage';

const OPENROUTER_PROVIDER_ID = ProviderTypeEnum.OpenRouter;
const DEFAULT_PLANNER_MODEL = 'openai/gpt-4.1';
const DEFAULT_NAVIGATOR_MODEL = 'openai/gpt-4.1';

const Options = () => {
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isConfigured, setIsConfigured] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Check for dark mode preference
  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeMediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };

    darkModeMediaQuery.addEventListener('change', handleChange);
    return () => darkModeMediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Load existing OpenRouter configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const provider = await llmProviderStore.getProvider(OPENROUTER_PROVIDER_ID);
        if (provider?.apiKey) {
          setApiKey(provider.apiKey);
          setIsConfigured(true);
        }
      } catch (error) {
        console.error('Error loading OpenRouter config:', error);
      }
    };

    loadConfig();
  }, []);

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      setSaveStatus('error');
      return;
    }

    setIsSaving(true);
    setSaveStatus('idle');

    try {
      // Get default OpenRouter config and set the API key
      const config = getDefaultProviderConfig(OPENROUTER_PROVIDER_ID);
      config.apiKey = apiKey.trim();

      // Add auto-router model to the models list
      if (!config.modelNames) {
        config.modelNames = [];
      }
      if (!config.modelNames.includes(DEFAULT_PLANNER_MODEL)) {
        config.modelNames.push(DEFAULT_PLANNER_MODEL);
      }
      if (!config.modelNames.includes(DEFAULT_NAVIGATOR_MODEL)) {
        config.modelNames.push(DEFAULT_NAVIGATOR_MODEL);
      }

      // Save the provider config
      await llmProviderStore.setProvider(OPENROUTER_PROVIDER_ID, config);

      // Auto-configure agent models with OpenRouter auto-routing
      await agentModelStore.setAgentModel(AgentNameEnum.Planner, {
        provider: OPENROUTER_PROVIDER_ID,
        modelName: DEFAULT_PLANNER_MODEL,
        parameters: { temperature: 0.7, topP: 0.9 },
      });

      await agentModelStore.setAgentModel(AgentNameEnum.Navigator, {
        provider: OPENROUTER_PROVIDER_ID,
        modelName: DEFAULT_NAVIGATOR_MODEL,
        parameters: { temperature: 0.3, topP: 0.85 },
      });

      setIsConfigured(true);
      setSaveStatus('success');

      // Reset status after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Error saving API key:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={`flex min-h-screen items-center justify-center ${isDarkMode ? 'bg-slate-900' : 'bg-gradient-to-br from-amber-50 to-orange-50'}`}>
      <div className="w-full max-w-md p-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className={`text-4xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>Browseless.ai</h1>
          <p className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Powered by OpenRouter Auto-Routing
          </p>
        </div>

        {/* API Key Card */}
        <div
          className={`rounded-2xl border ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white'} p-6 shadow-lg`}>
          <h2 className={`mb-4 text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
            OpenRouter API Key
          </h2>

          <div className="space-y-4">
            <input
              type="password"
              placeholder="sk-or-..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className={`w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors ${
                isDarkMode
                  ? 'border-slate-600 bg-slate-700 text-gray-200 placeholder:text-gray-500 focus:border-amber-500'
                  : 'border-gray-200 bg-gray-50 text-gray-800 placeholder:text-gray-400 focus:border-amber-500'
              }`}
            />

            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Get your API key at{' '}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-600 hover:text-amber-700 hover:underline">
                openrouter.ai/keys
              </a>
            </p>

            <Button
              onClick={handleSaveApiKey}
              disabled={isSaving || !apiKey.trim()}
              className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 font-medium text-white transition-colors ${
                isSaving || !apiKey.trim()
                  ? 'cursor-not-allowed bg-gray-400'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
              }`}>
              <FiSettings className={`size-5 ${isSaving ? 'animate-spin' : ''}`} />
              {isSaving ? 'Saving...' : 'Save API Key'}
            </Button>

            {saveStatus === 'success' && (
              <p className="text-center text-sm text-green-600">API key saved successfully!</p>
            )}

            {saveStatus === 'error' && (
              <p className="text-center text-sm text-red-600">
                {apiKey.trim() ? 'Failed to save API key. Please try again.' : 'Please enter a valid API key.'}
              </p>
            )}

            {isConfigured && saveStatus === 'idle' && (
              <p className={`text-center text-sm ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                OpenRouter is configured and ready to use.
              </p>
            )}
          </div>
        </div>

        {/* How it works */}
        <div
          className={`mt-6 rounded-2xl border ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white'} p-6 shadow-lg`}>
          <h3 className={`mb-3 text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
            How it works
          </h3>
          <p className={`mb-4 text-sm leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Browseless.ai uses OpenRouter's intelligent auto-routing to automatically select the best AI model for each
            task, delivering 8-10% better performance than manually selecting models.
          </p>
          <ul className={`space-y-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500"></span>
              <span>
                <strong className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Planning</strong> — Higher creativity
                for flexible task planning
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500"></span>
              <span>
                <strong className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Navigation</strong> — Precise actions
                for accurate web interactions
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500"></span>
              <span>
                <strong className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Cost Efficient</strong> — Only pay
                for what you use with no markup
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <div>Loading...</div>), <div>Error Occurred</div>);
