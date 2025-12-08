import { writable } from 'svelte/store';

export type ModuleType = 'chat' | 'canvas' | 'editor' | 'docgen';

export const currentModule = writable<ModuleType>('chat');
export const sidebarCollapsed = writable(false);

// Chat state
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const messages = writable<Message[]>([]);
export const isLoading = writable(false);

// Editor state
export const currentFile = writable<string | null>(null);
export const editorContent = writable('');

// Canvas state
export const canvasLayers = writable<string[]>([]);
