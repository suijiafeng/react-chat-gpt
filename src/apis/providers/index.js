import { DemoProvider } from './demo';
import { OpenAIProvider } from './openai';
import { OllamaProvider } from './ollama';

class ProviderRegistry {
  constructor() {
    this.providers = {
      demo: new DemoProvider(),
      custom: new OpenAIProvider(),
      ollama: new OllamaProvider(),
    };
  }

  /**
   * Get provider instance by name.
   * @param {string} name - Provider identifier ('demo', 'custom', 'ollama')
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
export { BaseProvider } from './base';
export { DemoProvider } from './demo';
export { OpenAIProvider } from './openai';
export { OllamaProvider } from './ollama';
