import { DemoProvider } from './demo';
import { OpenAIProvider } from './openai';
import { OllamaProvider } from './ollama';
import { BackendProvider } from './backend';

class ProviderRegistry {
  constructor() {
    this.providers = {
      demo: new DemoProvider(),
      custom: new OpenAIProvider(),
      ollama: new OllamaProvider(),
      backend: new BackendProvider(),
    };
  }

  /**
   * Get provider instance by name.
   * @param {string} name - Provider identifier ('demo', 'custom', 'ollama', 'backend')
   * @returns {BaseProvider} Provider instance
   */
  getProvider(name) {
    const provider = this.providers[name];
    if (!provider) {
      return this.providers.demo;
    }
    return provider;
  }
}

export const providerRegistry = new ProviderRegistry();
