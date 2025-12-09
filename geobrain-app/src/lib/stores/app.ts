import { writable } from 'svelte/store';

export type ModuleType = 'chat' | 'canvas' | 'editor' | 'docgen' | 'settings';

export const currentModule = writable<ModuleType>('chat');
export const sidebarCollapsed = writable(false);

// Chat state
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  model?: string;
  provider?: string;
}

export interface Provider {
  id: string;
  name: string;
  models: Model[];
  authType: 'oauth' | 'apikey';
  isConfigured: boolean;
  authMethod: string | null;
}

export interface Model {
  id: string;
  name: string;
  default?: boolean;
}

export const messages = writable<Message[]>([]);
export const isLoading = writable(false);
export const currentProvider = writable<string>('claude');
export const currentModel = writable<string>('claude-sonnet-4-20250514');
export const providers = writable<Provider[]>([]);
export const backendConnected = writable(false);

// Editor state
export const currentFile = writable<string | null>(null);
export const editorContent = writable('');

// Canvas state
export const canvasLayers = writable<string[]>([]);

// Settings
export const settingsOpen = writable(false);
