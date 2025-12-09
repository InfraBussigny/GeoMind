/**
 * GeoBrain API Service
 * Communication avec le backend pour les LLMs et outils système
 */

const API_BASE = 'http://localhost:3001/api';

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

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  content: string;
  toolCalls?: any[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  model?: string;
}

// ============================================
// PROVIDERS
// ============================================

export async function getProviders(): Promise<Provider[]> {
  const response = await fetch(`${API_BASE}/providers`);
  if (!response.ok) throw new Error('Failed to fetch providers');
  return response.json();
}

export async function getModels(providerId: string): Promise<Model[]> {
  const response = await fetch(`${API_BASE}/providers/${providerId}/models`);
  if (!response.ok) throw new Error('Failed to fetch models');
  return response.json();
}

export async function saveProviderConfig(providerId: string, apiKey: string): Promise<void> {
  const response = await fetch(`${API_BASE}/providers/${providerId}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey })
  });
  if (!response.ok) throw new Error('Failed to save config');
}

// ============================================
// CHAT
// ============================================

export async function sendMessage(
  provider: string,
  model: string,
  messages: Message[],
  tools?: any[]
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, model, messages, tools })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Chat request failed');
  }

  return response.json();
}

export async function streamMessage(
  provider: string,
  model: string,
  messages: Message[],
  tools?: any[],
  onChunk?: (chunk: string) => void,
  onDone?: () => void,
  onError?: (error: string) => void
): Promise<void> {
  const response = await fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, model, messages, tools })
  });

  if (!response.ok) {
    const error = await response.json();
    onError?.(error.error || 'Stream request failed');
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    onError?.('No response body');
    return;
  }

  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'content') {
            onChunk?.(data.content);
          } else if (data.type === 'done') {
            onDone?.();
          } else if (data.type === 'error') {
            onError?.(data.error);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }
}

// ============================================
// FILE SYSTEM TOOLS
// ============================================

export async function readFile(path: string): Promise<string> {
  const response = await fetch(`${API_BASE}/tools/read-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to read file');
  }

  const data = await response.json();
  return data.content;
}

export async function writeFile(path: string, content: string): Promise<void> {
  const response = await fetch(`${API_BASE}/tools/write-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to write file');
  }
}

export async function listDirectory(path: string): Promise<{ name: string; isDirectory: boolean; isFile: boolean }[]> {
  const response = await fetch(`${API_BASE}/tools/list-directory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to list directory');
  }

  return response.json();
}

export async function executeCommand(command: string, cwd?: string): Promise<{ stdout: string; stderr: string }> {
  const response = await fetch(`${API_BASE}/tools/execute-command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, cwd })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to execute command');
  }

  return response.json();
}

// ============================================
// GEOPORTAL API
// ============================================

export interface GeoportalSession {
  isAuthenticated: boolean;
  username: string | null;
  lastLogin: string | null;
  expiresAt: string | null;
}

export interface GeoportalLoginResult {
  success: boolean;
  message: string;
  username?: string;
}

export async function geoportalLogin(username: string, password: string, remember: boolean = false): Promise<GeoportalLoginResult> {
  const response = await fetch(`${API_BASE}/geoportal/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, remember })
  });

  return response.json();
}

export async function geoportalLogout(): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/geoportal/logout`, {
    method: 'POST'
  });

  return response.json();
}

export async function getGeoportalSession(): Promise<GeoportalSession> {
  const response = await fetch(`${API_BASE}/geoportal/session`);
  return response.json();
}

export function getGeoportalWmsUrl(theme: string, params: Record<string, string>): string {
  const searchParams = new URLSearchParams(params);
  return `${API_BASE}/geoportal/wms/${theme}?${searchParams.toString()}`;
}

export async function getGeoportalCapabilities(theme: string): Promise<string> {
  const response = await fetch(`${API_BASE}/geoportal/capabilities/${theme}`);
  if (!response.ok) throw new Error('Failed to get capabilities');
  return response.text();
}

export interface GeoportalTheme {
  id: string;
  name: string;
  description: string;
  thumbnail: string | null;
  isPublic: boolean;
  wmsUrl: string | null;
}

export interface GeoportalThemesResponse {
  themes: GeoportalTheme[];
  isAuthenticated: boolean;
  total: number;
}

export async function getGeoportalThemes(): Promise<GeoportalThemesResponse> {
  const response = await fetch(`${API_BASE}/geoportal/themes`);
  if (!response.ok) throw new Error('Failed to get themes');
  return response.json();
}
