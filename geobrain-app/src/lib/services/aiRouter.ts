/**
 * GeoBrain AI Router Service
 * Multi-provider AI routing: Anthropic, Google, OpenAI, Local (Ollama/LM Studio)
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

// ============================================
// Types
// ============================================

export type AIProvider = 'anthropic' | 'google' | 'openai' | 'ollama' | 'lmstudio';

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  contextLength: number;
  inputPrice: number;  // per 1M tokens
  outputPrice: number; // per 1M tokens
  capabilities: ('chat' | 'code' | 'vision' | 'function_calling')[];
  isLocal: boolean;
}

export interface AIProviderConfig {
  provider: AIProvider;
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  authType?: 'api_key' | 'oauth';
  oauthToken?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[]; // base64 for vision
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  provider?: AIProvider;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  systemPrompt?: string;
}

export interface ChatResponse {
  content: string;
  model: string;
  provider: AIProvider;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cost?: number;
  };
  finishReason?: string;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

// ============================================
// Constants
// ============================================

const API_BASE = 'http://localhost:3001/api';
const STORAGE_KEY = 'geobrain_ai_config';

// Available models by provider
export const AVAILABLE_MODELS: AIModel[] = [
  // Anthropic
  {
    id: 'claude-opus-4-20250514',
    name: 'Claude Opus 4',
    provider: 'anthropic',
    contextLength: 200000,
    inputPrice: 15,
    outputPrice: 75,
    capabilities: ['chat', 'code', 'vision', 'function_calling'],
    isLocal: false
  },
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    contextLength: 200000,
    inputPrice: 3,
    outputPrice: 15,
    capabilities: ['chat', 'code', 'vision', 'function_calling'],
    isLocal: false
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    contextLength: 200000,
    inputPrice: 3,
    outputPrice: 15,
    capabilities: ['chat', 'code', 'vision', 'function_calling'],
    isLocal: false
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    contextLength: 200000,
    inputPrice: 0.8,
    outputPrice: 4,
    capabilities: ['chat', 'code', 'function_calling'],
    isLocal: false
  },

  // Google
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    contextLength: 1000000,
    inputPrice: 0.075,
    outputPrice: 0.30,
    capabilities: ['chat', 'code', 'vision', 'function_calling'],
    isLocal: false
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    contextLength: 2000000,
    inputPrice: 1.25,
    outputPrice: 5,
    capabilities: ['chat', 'code', 'vision', 'function_calling'],
    isLocal: false
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'google',
    contextLength: 1000000,
    inputPrice: 0.075,
    outputPrice: 0.30,
    capabilities: ['chat', 'code', 'vision'],
    isLocal: false
  },

  // OpenAI
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    contextLength: 128000,
    inputPrice: 2.5,
    outputPrice: 10,
    capabilities: ['chat', 'code', 'vision', 'function_calling'],
    isLocal: false
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    contextLength: 128000,
    inputPrice: 0.15,
    outputPrice: 0.60,
    capabilities: ['chat', 'code', 'vision', 'function_calling'],
    isLocal: false
  },
  {
    id: 'o1',
    name: 'o1 (Reasoning)',
    provider: 'openai',
    contextLength: 200000,
    inputPrice: 15,
    outputPrice: 60,
    capabilities: ['chat', 'code'],
    isLocal: false
  },

  // Local - Ollama (examples, dynamically loaded)
  {
    id: 'llama3.2',
    name: 'Llama 3.2',
    provider: 'ollama',
    contextLength: 128000,
    inputPrice: 0,
    outputPrice: 0,
    capabilities: ['chat', 'code'],
    isLocal: true
  },
  {
    id: 'codellama',
    name: 'Code Llama',
    provider: 'ollama',
    contextLength: 16000,
    inputPrice: 0,
    outputPrice: 0,
    capabilities: ['code'],
    isLocal: true
  },
  {
    id: 'mistral',
    name: 'Mistral 7B',
    provider: 'ollama',
    contextLength: 32000,
    inputPrice: 0,
    outputPrice: 0,
    capabilities: ['chat', 'code'],
    isLocal: true
  },
  {
    id: 'qwen2.5-coder',
    name: 'Qwen 2.5 Coder',
    provider: 'ollama',
    contextLength: 32000,
    inputPrice: 0,
    outputPrice: 0,
    capabilities: ['code'],
    isLocal: true
  }
];

// Default provider configs
const DEFAULT_CONFIGS: AIProviderConfig[] = [
  {
    provider: 'anthropic',
    enabled: true,
    defaultModel: 'claude-3-5-sonnet-20241022',
    authType: 'api_key'
  },
  {
    provider: 'google',
    enabled: false,
    defaultModel: 'gemini-2.0-flash',
    authType: 'api_key'
  },
  {
    provider: 'openai',
    enabled: false,
    defaultModel: 'gpt-4o-mini',
    authType: 'api_key'
  },
  {
    provider: 'ollama',
    enabled: false,
    baseUrl: 'http://localhost:11434',
    defaultModel: 'llama3.2'
  },
  {
    provider: 'lmstudio',
    enabled: false,
    baseUrl: 'http://localhost:1234',
    defaultModel: 'local-model'
  }
];

// ============================================
// AI Config Store
// ============================================

interface AIConfigState {
  providers: AIProviderConfig[];
  activeProvider: AIProvider;
  activeModel: string;
  autoRoute: boolean;
  routingRules: RoutingRule[];
}

interface RoutingRule {
  id: string;
  name: string;
  condition: 'contains' | 'starts_with' | 'task_type' | 'context_length';
  value: string;
  targetProvider: AIProvider;
  targetModel: string;
  priority: number;
}

function loadConfig(): AIConfigState {
  const defaultState: AIConfigState = {
    providers: DEFAULT_CONFIGS,
    activeProvider: 'anthropic',
    activeModel: 'claude-3-5-sonnet-20241022',
    autoRoute: false,
    routingRules: []
  };

  if (!browser) return defaultState;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to ensure all providers exist
      return {
        ...defaultState,
        ...parsed,
        providers: DEFAULT_CONFIGS.map(def => {
          const stored = parsed.providers?.find((p: AIProviderConfig) => p.provider === def.provider);
          return stored ? { ...def, ...stored } : def;
        })
      };
    }
  } catch {}

  return defaultState;
}

function createAIConfigStore() {
  const { subscribe, set, update } = writable<AIConfigState>(loadConfig());

  // Save on change (without API keys for security)
  if (browser) {
    subscribe(state => {
      const toSave = {
        ...state,
        providers: state.providers.map(p => ({
          ...p,
          apiKey: undefined, // Don't persist API keys in localStorage
          oauthToken: undefined
        }))
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    });
  }

  return {
    subscribe,

    setProvider(provider: AIProvider, config: Partial<AIProviderConfig>) {
      update(state => ({
        ...state,
        providers: state.providers.map(p =>
          p.provider === provider ? { ...p, ...config } : p
        )
      }));
    },

    setActiveProvider(provider: AIProvider, model?: string) {
      update(state => {
        const providerConfig = state.providers.find(p => p.provider === provider);
        return {
          ...state,
          activeProvider: provider,
          activeModel: model || providerConfig?.defaultModel || state.activeModel
        };
      });
    },

    setActiveModel(model: string) {
      update(state => ({ ...state, activeModel: model }));
    },

    toggleAutoRoute(enabled: boolean) {
      update(state => ({ ...state, autoRoute: enabled }));
    },

    addRoutingRule(rule: Omit<RoutingRule, 'id'>) {
      update(state => ({
        ...state,
        routingRules: [...state.routingRules, { ...rule, id: `rule_${Date.now()}` }]
      }));
    },

    removeRoutingRule(id: string) {
      update(state => ({
        ...state,
        routingRules: state.routingRules.filter(r => r.id !== id)
      }));
    },

    getProviderConfig(provider: AIProvider): AIProviderConfig | undefined {
      return get({ subscribe }).providers.find(p => p.provider === provider);
    }
  };
}

export const aiConfigStore = createAIConfigStore();

// ============================================
// Usage Tracking Store
// ============================================

interface UsageRecord {
  timestamp: Date;
  provider: AIProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

function createUsageStore() {
  const { subscribe, update } = writable<UsageRecord[]>([]);

  return {
    subscribe,

    addRecord(record: Omit<UsageRecord, 'timestamp'>) {
      update(records => [{
        ...record,
        timestamp: new Date()
      }, ...records].slice(0, 1000)); // Keep last 1000
    },

    getTotalCost(since?: Date): number {
      const records = get({ subscribe });
      return records
        .filter(r => !since || r.timestamp >= since)
        .reduce((sum, r) => sum + r.cost, 0);
    },

    getByProvider(provider: AIProvider): UsageRecord[] {
      return get({ subscribe }).filter(r => r.provider === provider);
    },

    clear() {
      update(() => []);
    }
  };
}

export const usageStore = createUsageStore();

// ============================================
// AI Router Functions
// ============================================

/**
 * Auto-route request to best provider/model
 */
export function autoRoute(request: ChatRequest): { provider: AIProvider; model: string } {
  const config = get(aiConfigStore);

  // Check routing rules
  for (const rule of config.routingRules.sort((a, b) => b.priority - a.priority)) {
    const lastMessage = request.messages[request.messages.length - 1]?.content || '';

    let matches = false;
    switch (rule.condition) {
      case 'contains':
        matches = lastMessage.toLowerCase().includes(rule.value.toLowerCase());
        break;
      case 'starts_with':
        matches = lastMessage.toLowerCase().startsWith(rule.value.toLowerCase());
        break;
      case 'task_type':
        // Simple task type detection
        if (rule.value === 'code') {
          matches = /```|function|def |class |import |const |let |var /.test(lastMessage);
        } else if (rule.value === 'long_context') {
          matches = request.messages.reduce((sum, m) => sum + m.content.length, 0) > 50000;
        }
        break;
      case 'context_length':
        const totalLength = request.messages.reduce((sum, m) => sum + m.content.length, 0);
        matches = totalLength > parseInt(rule.value);
        break;
    }

    if (matches) {
      const providerConfig = config.providers.find(p => p.provider === rule.targetProvider);
      if (providerConfig?.enabled) {
        return { provider: rule.targetProvider, model: rule.targetModel };
      }
    }
  }

  // Default: use active provider/model
  return { provider: config.activeProvider, model: config.activeModel };
}

/**
 * Send chat request to appropriate provider
 */
export async function chat(request: ChatRequest): Promise<ChatResponse> {
  const config = get(aiConfigStore);

  // Determine provider and model
  let provider = request.provider || config.activeProvider;
  let model = request.model || config.activeModel;

  if (config.autoRoute && !request.provider && !request.model) {
    const routed = autoRoute(request);
    provider = routed.provider;
    model = routed.model;
  }

  const providerConfig = config.providers.find(p => p.provider === provider);
  if (!providerConfig?.enabled) {
    throw new Error(`Provider ${provider} is not enabled`);
  }

  // Route to appropriate handler
  switch (provider) {
    case 'anthropic':
      return chatAnthropic(request, model, providerConfig);
    case 'google':
      return chatGoogle(request, model, providerConfig);
    case 'openai':
      return chatOpenAI(request, model, providerConfig);
    case 'ollama':
      return chatOllama(request, model, providerConfig);
    case 'lmstudio':
      return chatLMStudio(request, model, providerConfig);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Stream chat response
 */
export async function* streamChat(request: ChatRequest): AsyncGenerator<StreamChunk> {
  const config = get(aiConfigStore);
  const provider = request.provider || config.activeProvider;
  const model = request.model || config.activeModel;
  const providerConfig = config.providers.find(p => p.provider === provider);

  if (!providerConfig?.enabled) {
    throw new Error(`Provider ${provider} is not enabled`);
  }

  // Call backend streaming endpoint
  const response = await fetch(`${API_BASE}/ai/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      model,
      messages: request.messages,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      systemPrompt: request.systemPrompt,
      apiKey: providerConfig.apiKey,
      baseUrl: providerConfig.baseUrl
    })
  });

  if (!response.ok) {
    throw new Error(`Stream request failed: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') {
          yield { content: '', done: true };
          return;
        }
        try {
          const parsed = JSON.parse(data);
          yield { content: parsed.content || '', done: false };
        } catch {}
      }
    }
  }
}

// ============================================
// Provider-specific implementations
// ============================================

async function chatAnthropic(
  request: ChatRequest,
  model: string,
  config: AIProviderConfig
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE}/ai/anthropic/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      maxTokens: request.maxTokens ?? 4096,
      systemPrompt: request.systemPrompt,
      apiKey: config.apiKey
    })
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Anthropic API error');
  }

  // Track usage
  if (result.usage) {
    const modelInfo = AVAILABLE_MODELS.find(m => m.id === model);
    const cost = modelInfo
      ? (result.usage.inputTokens * modelInfo.inputPrice / 1000000) +
        (result.usage.outputTokens * modelInfo.outputPrice / 1000000)
      : 0;

    usageStore.addRecord({
      provider: 'anthropic',
      model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cost
    });
  }

  return {
    content: result.content,
    model,
    provider: 'anthropic',
    usage: result.usage,
    finishReason: result.finishReason
  };
}

async function chatGoogle(
  request: ChatRequest,
  model: string,
  config: AIProviderConfig
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE}/ai/google/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      maxTokens: request.maxTokens ?? 4096,
      systemPrompt: request.systemPrompt,
      apiKey: config.apiKey
    })
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Google API error');
  }

  if (result.usage) {
    const modelInfo = AVAILABLE_MODELS.find(m => m.id === model);
    const cost = modelInfo
      ? (result.usage.inputTokens * modelInfo.inputPrice / 1000000) +
        (result.usage.outputTokens * modelInfo.outputPrice / 1000000)
      : 0;

    usageStore.addRecord({
      provider: 'google',
      model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cost
    });
  }

  return {
    content: result.content,
    model,
    provider: 'google',
    usage: result.usage,
    finishReason: result.finishReason
  };
}

async function chatOpenAI(
  request: ChatRequest,
  model: string,
  config: AIProviderConfig
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE}/ai/openai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      maxTokens: request.maxTokens ?? 4096,
      systemPrompt: request.systemPrompt,
      apiKey: config.apiKey
    })
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'OpenAI API error');
  }

  if (result.usage) {
    const modelInfo = AVAILABLE_MODELS.find(m => m.id === model);
    const cost = modelInfo
      ? (result.usage.inputTokens * modelInfo.inputPrice / 1000000) +
        (result.usage.outputTokens * modelInfo.outputPrice / 1000000)
      : 0;

    usageStore.addRecord({
      provider: 'openai',
      model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cost
    });
  }

  return {
    content: result.content,
    model,
    provider: 'openai',
    usage: result.usage,
    finishReason: result.finishReason
  };
}

async function chatOllama(
  request: ChatRequest,
  model: string,
  config: AIProviderConfig
): Promise<ChatResponse> {
  const baseUrl = config.baseUrl || 'http://localhost:11434';

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: request.messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      stream: false,
      options: {
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens ?? 4096
      }
    })
  });

  const result = await response.json();

  // Ollama is free/local
  usageStore.addRecord({
    provider: 'ollama',
    model,
    inputTokens: result.prompt_eval_count || 0,
    outputTokens: result.eval_count || 0,
    cost: 0
  });

  return {
    content: result.message?.content || '',
    model,
    provider: 'ollama',
    usage: {
      inputTokens: result.prompt_eval_count || 0,
      outputTokens: result.eval_count || 0,
      cost: 0
    },
    finishReason: 'stop'
  };
}

async function chatLMStudio(
  request: ChatRequest,
  model: string,
  config: AIProviderConfig
): Promise<ChatResponse> {
  const baseUrl = config.baseUrl || 'http://localhost:1234';

  // LM Studio uses OpenAI-compatible API
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4096
    })
  });

  const result = await response.json();

  usageStore.addRecord({
    provider: 'lmstudio',
    model,
    inputTokens: result.usage?.prompt_tokens || 0,
    outputTokens: result.usage?.completion_tokens || 0,
    cost: 0
  });

  return {
    content: result.choices?.[0]?.message?.content || '',
    model,
    provider: 'lmstudio',
    usage: {
      inputTokens: result.usage?.prompt_tokens || 0,
      outputTokens: result.usage?.completion_tokens || 0,
      cost: 0
    },
    finishReason: result.choices?.[0]?.finish_reason || 'stop'
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Test provider connection
 */
export async function testProvider(provider: AIProvider): Promise<{ success: boolean; error?: string }> {
  const config = get(aiConfigStore);
  const providerConfig = config.providers.find(p => p.provider === provider);

  if (!providerConfig) {
    return { success: false, error: 'Provider not configured' };
  }

  try {
    if (provider === 'ollama') {
      const response = await fetch(`${providerConfig.baseUrl || 'http://localhost:11434'}/api/tags`);
      return { success: response.ok };
    }

    if (provider === 'lmstudio') {
      const response = await fetch(`${providerConfig.baseUrl || 'http://localhost:1234'}/v1/models`);
      return { success: response.ok };
    }

    // For cloud providers, send a minimal test request
    const response = await fetch(`${API_BASE}/ai/${provider}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: providerConfig.apiKey })
    });

    return await response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Get available models for a provider (including dynamic Ollama models)
 */
export async function getAvailableModels(provider: AIProvider): Promise<AIModel[]> {
  const staticModels = AVAILABLE_MODELS.filter(m => m.provider === provider);

  if (provider === 'ollama') {
    try {
      const config = get(aiConfigStore);
      const providerConfig = config.providers.find(p => p.provider === 'ollama');
      const baseUrl = providerConfig?.baseUrl || 'http://localhost:11434';

      const response = await fetch(`${baseUrl}/api/tags`);
      const result = await response.json();

      const ollamaModels: AIModel[] = result.models?.map((m: { name: string }) => ({
        id: m.name,
        name: m.name,
        provider: 'ollama' as AIProvider,
        contextLength: 32000,
        inputPrice: 0,
        outputPrice: 0,
        capabilities: ['chat', 'code'] as const,
        isLocal: true
      })) || [];

      return [...staticModels, ...ollamaModels];
    } catch {
      return staticModels;
    }
  }

  if (provider === 'lmstudio') {
    try {
      const config = get(aiConfigStore);
      const providerConfig = config.providers.find(p => p.provider === 'lmstudio');
      const baseUrl = providerConfig?.baseUrl || 'http://localhost:1234';

      const response = await fetch(`${baseUrl}/v1/models`);
      const result = await response.json();

      const lmModels: AIModel[] = result.data?.map((m: { id: string }) => ({
        id: m.id,
        name: m.id,
        provider: 'lmstudio' as AIProvider,
        contextLength: 32000,
        inputPrice: 0,
        outputPrice: 0,
        capabilities: ['chat', 'code'] as const,
        isLocal: true
      })) || [];

      return [...staticModels, ...lmModels];
    } catch {
      return staticModels;
    }
  }

  return staticModels;
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost === 0) return 'Gratuit';
  if (cost < 0.01) return `$${(cost * 100).toFixed(3)}¢`;
  return `$${cost.toFixed(4)}`;
}

/**
 * Get provider display info
 */
export function getProviderInfo(provider: AIProvider): { name: string; icon: string; color: string } {
  switch (provider) {
    case 'anthropic':
      return { name: 'Anthropic', icon: '🅰️', color: '#D97706' };
    case 'google':
      return { name: 'Google', icon: '🔵', color: '#4285F4' };
    case 'openai':
      return { name: 'OpenAI', icon: '🟢', color: '#10A37F' };
    case 'ollama':
      return { name: 'Ollama', icon: '🦙', color: '#000000' };
    case 'lmstudio':
      return { name: 'LM Studio', icon: '🏠', color: '#6366F1' };
    default:
      return { name: provider, icon: '🤖', color: '#6B7280' };
  }
}
