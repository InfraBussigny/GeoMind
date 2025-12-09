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

export interface ToolUseEvent {
  tool: string;
  input: any;
}

export interface ToolResultEvent {
  tool: string;
  result: any;
}

export interface StreamController {
  abort: () => void;
}

export async function streamMessage(
  provider: string,
  model: string,
  messages: Message[],
  tools?: any[],
  onChunk?: (chunk: string) => void,
  onDone?: () => void,
  onError?: (error: string) => void,
  onToolUse?: (event: ToolUseEvent) => void,
  onToolResult?: (event: ToolResultEvent) => void,
  onAborted?: () => void
): Promise<StreamController> {
  // Utiliser l'endpoint agent pour Claude (avec outils)
  const endpoint = provider === 'claude' ? `${API_BASE}/chat/agent` : `${API_BASE}/chat/stream`;

  const abortController = new AbortController();
  let isAborted = false;

  const controller: StreamController = {
    abort: () => {
      isAborted = true;
      abortController.abort();
    }
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, model, messages, tools }),
      signal: abortController.signal
    });

    if (!response.ok) {
      const error = await response.json();
      onError?.(error.error || 'Stream request failed');
      return controller;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError?.('No response body');
      return controller;
    }

    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Stream terminé, s'assurer que onDone est appelé
          if (!isAborted) {
            onDone?.();
          }
          break;
        }

        if (isAborted) {
          reader.cancel();
          onAborted?.();
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'content') {
                onChunk?.(data.content);
              } else if (data.type === 'tool_use') {
                onToolUse?.({ tool: data.tool, input: data.input });
              } else if (data.type === 'tool_result') {
                onToolResult?.({ tool: data.tool, result: data.result });
              } else if (data.type === 'done') {
                // Le serveur a envoyé done, mais on attend aussi la fin du stream
              } else if (data.type === 'error') {
                onError?.(data.error);
                return controller;
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (e) {
      if (!isAborted) {
        onError?.(`Stream error: ${e}`);
      }
    }
  } catch (e: any) {
    if (e.name === 'AbortError') {
      onAborted?.();
    } else {
      onError?.(`Request error: ${e}`);
    }
  }

  return controller;
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
