/**
 * GeoBrain Backend Server
 * Gère les appels API aux LLMs et les opérations système
 */

import express from 'express';
import cors from 'cors';
import { readFile, writeFile, readdir, stat, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { exec } from 'child_process';
import memory from './memory.js';
import geoportalProxy from './geoportal-proxy.js';
import { TOOL_DEFINITIONS, executeTool, AGENT_SYSTEM_PROMPT } from './tools.js';
import { selectModel, MODELS } from './model-selector.js';
import { orchestrate, generateEnrichedSystemPrompt, identifyRelevantAgents, listAgents } from './sub-agents.js';
import security from './security.js';
import { runOllamaAgent, chatWithTools as ollamaChat } from './ollama-agent.js';
import { processSQLAssistant, buildEnrichedPrompt } from './sql-assistant.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ============================================
// CREDENTIALS MANAGEMENT
// ============================================

const CLAUDE_CREDENTIALS_PATH = join(homedir(), '.claude', '.credentials.json');
const GEOBRAIN_CONFIG_PATH = join(homedir(), '.geobrain', 'config.json');

async function getClaudeCredentials() {
  try {
    if (existsSync(CLAUDE_CREDENTIALS_PATH)) {
      const data = await readFile(CLAUDE_CREDENTIALS_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading Claude credentials:', error);
  }
  return null;
}

async function getGeoBrainConfig() {
  try {
    if (existsSync(GEOBRAIN_CONFIG_PATH)) {
      const data = await readFile(GEOBRAIN_CONFIG_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading GeoBrain config:', error);
  }
  return { providers: {} };
}

async function saveGeoBrainConfig(config) {
  const dir = dirname(GEOBRAIN_CONFIG_PATH);
  if (!existsSync(dir)) {
    await import('fs').then(fs => fs.promises.mkdir(dir, { recursive: true }));
  }
  await writeFile(GEOBRAIN_CONFIG_PATH, JSON.stringify(config, null, 2));
}

// ============================================
// PROVIDERS CONFIGURATION
// ============================================

const PROVIDERS = {
  claude: {
    name: 'Claude (Anthropic)',
    models: [
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', default: true },
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
    ],
    authType: 'oauth', // Utilise les credentials Claude Code existants
    baseUrl: 'https://api.anthropic.com/v1'
  },
  openai: {
    name: 'OpenAI (ChatGPT)',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', default: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'o1-preview', name: 'o1 Preview' },
    ],
    authType: 'apikey',
    baseUrl: 'https://api.openai.com/v1'
  },
  mistral: {
    name: 'Mistral AI',
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large', default: true },
      { id: 'mistral-medium-latest', name: 'Mistral Medium' },
      { id: 'codestral-latest', name: 'Codestral' },
    ],
    authType: 'apikey',
    baseUrl: 'https://api.mistral.ai/v1'
  },
  deepseek: {
    name: 'DeepSeek',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', default: true },
      { id: 'deepseek-coder', name: 'DeepSeek Coder' },
    ],
    authType: 'apikey',
    baseUrl: 'https://api.deepseek.com/v1'
  },
  perplexity: {
    name: 'Perplexity',
    models: [
      { id: 'llama-3.1-sonar-large-128k-online', name: 'Sonar Large (Online)', default: true },
      { id: 'llama-3.1-sonar-small-128k-online', name: 'Sonar Small (Online)' },
    ],
    authType: 'apikey',
    baseUrl: 'https://api.perplexity.ai'
  },
  google: {
    name: 'Google Gemini',
    models: [
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', default: true },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash' },
    ],
    authType: 'apikey',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta'
  },
  ollama: {
    name: 'Ollama (Local)',
    models: [
      { id: 'qwen2.5:14b', name: 'Qwen 2.5 14B (Tools)', default: true, forTools: true },
      { id: 'llama3.2', name: 'Llama 3.2 (Chat rapide)' },
      { id: 'codellama', name: 'CodeLlama' },
      { id: 'mistral', name: 'Mistral' },
      { id: 'phi3', name: 'Phi-3' },
    ],
    authType: 'local',
    baseUrl: 'http://localhost:11434'
  },
  lmstudio: {
    name: 'LM Studio (Local)',
    models: [
      { id: 'local-model', name: 'Local Model', default: true },
    ],
    authType: 'local',
    baseUrl: 'http://localhost:1234/v1'
  }
};

// ============================================
// API ROUTES
// ============================================

// Helper: Check if local server is running
async function checkLocalServer(url, timeout = 2000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

// Helper: Get Ollama models dynamically
async function getOllamaModels() {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (response.ok) {
      const data = await response.json();
      if (data.models && data.models.length > 0) {
        return data.models.map((m, i) => ({
          id: m.name,
          name: m.name.replace(':latest', ''),
          default: i === 0
        }));
      }
    }
  } catch {}
  return PROVIDERS.ollama.models; // Fallback to default list
}

// Get available providers and their status
app.get('/api/providers', async (req, res) => {
  const claudeCredentials = await getClaudeCredentials();
  const config = await getGeoBrainConfig();

  // Check local servers in parallel
  const [ollamaRunning, lmstudioRunning] = await Promise.all([
    checkLocalServer('http://localhost:11434/api/tags'),
    checkLocalServer('http://localhost:1234/v1/models')
  ]);

  // Get dynamic Ollama models if running
  let ollamaModels = PROVIDERS.ollama.models;
  if (ollamaRunning) {
    ollamaModels = await getOllamaModels();
  }

  const providers = await Promise.all(Object.entries(PROVIDERS).map(async ([id, provider]) => {
    let isConfigured = false;
    let authMethod = null;
    let models = provider.models;

    if (config.providers?.[id]?.apiKey) {
      isConfigured = true;
      authMethod = 'API Key';
    } else if (id === 'claude' && claudeCredentials?.claudeAiOauth) {
      isConfigured = true;
      authMethod = 'Claude Code OAuth';
    } else if (id === 'ollama' && ollamaRunning) {
      isConfigured = true;
      authMethod = 'Local Server';
      models = ollamaModels;
    } else if (id === 'lmstudio' && lmstudioRunning) {
      isConfigured = true;
      authMethod = 'Local Server';
    }

    return {
      id,
      ...provider,
      models,
      isConfigured,
      authMethod
    };
  }));

  res.json(providers);
});

// Get models for a specific provider
app.get('/api/providers/:providerId/models', (req, res) => {
  const provider = PROVIDERS[req.params.providerId];
  if (!provider) {
    return res.status(404).json({ error: 'Provider not found' });
  }
  res.json(provider.models);
});

// Save API key for a provider
app.post('/api/providers/:providerId/config', async (req, res) => {
  const { apiKey } = req.body;
  const providerId = req.params.providerId;

  if (!PROVIDERS[providerId]) {
    return res.status(404).json({ error: 'Provider not found' });
  }

  const config = await getGeoBrainConfig();
  config.providers = config.providers || {};
  config.providers[providerId] = { apiKey };
  await saveGeoBrainConfig(config);

  res.json({ success: true });
});

// ============================================
// MEMORY API
// ============================================

app.get('/api/memory', async (req, res) => {
  try {
    const summary = memory.getMemorySummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/memory/reload', async (req, res) => {
  try {
    await memory.loadMemory();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/memory/update', async (req, res) => {
  try {
    const { fileKey, content, append } = req.body;
    const result = await memory.updateMemory(fileKey, content, append);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/memory/log', async (req, res) => {
  try {
    const { entry } = req.body;
    await memory.logSession(entry);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PROVIDER ROUTER FUNCTION
// ============================================

/**
 * Routes chat requests to the appropriate provider
 */
async function callProvider(provider, model, messages, tools) {
  const config = await getGeoBrainConfig();

  switch (provider) {
    case 'ollama': {
      // Utiliser l'agent avec outils pour Ollama
      const result = await runOllamaAgent(model || 'llama3.2', messages, {
        baseUrl: 'http://localhost:11434'
      });
      return {
        content: result.content,
        model: result.model,
        provider: 'ollama',
        toolCalls: result.toolCalls
      };
    }

    case 'lmstudio': {
      const response = await fetch('http://localhost:1234/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model || 'local-model',
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          temperature: 0.7,
          max_tokens: 4096
        })
      });
      const data = await response.json();
      return {
        content: data.choices?.[0]?.message?.content || '',
        model: data.model,
        provider: 'lmstudio'
      };
    }

    case 'openai': {
      const apiKey = config.providers?.openai?.apiKey;
      if (!apiKey) throw new Error('OpenAI API key not configured');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'gpt-4o',
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          temperature: 0.7,
          max_tokens: 4096
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return {
        content: data.choices?.[0]?.message?.content || '',
        model: data.model,
        provider: 'openai'
      };
    }

    case 'mistral': {
      const apiKey = config.providers?.mistral?.apiKey;
      if (!apiKey) throw new Error('Mistral API key not configured');

      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'mistral-large-latest',
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          temperature: 0.7,
          max_tokens: 4096
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return {
        content: data.choices?.[0]?.message?.content || '',
        model: data.model,
        provider: 'mistral'
      };
    }

    case 'deepseek': {
      const apiKey = config.providers?.deepseek?.apiKey;
      if (!apiKey) throw new Error('DeepSeek API key not configured');

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'deepseek-chat',
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          temperature: 0.7,
          max_tokens: 4096
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return {
        content: data.choices?.[0]?.message?.content || '',
        model: data.model,
        provider: 'deepseek'
      };
    }

    default:
      throw new Error(`Provider ${provider} not supported in streaming fallback`);
  }
}

// ============================================
// CHAT API
// ============================================

app.post('/api/chat', async (req, res) => {
  const { provider, model, messages, tools } = req.body;

  try {
    // Construire le contexte avec la mémoire
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
    const systemContext = await memory.buildContext(lastUserMessage);

    // Ajouter le contexte système au début des messages
    const messagesWithContext = [
      { role: 'system', content: systemContext },
      ...messages
    ];

    let response;

    switch (provider) {
      case 'claude':
        response = await callClaude(model, messagesWithContext, tools);
        break;
      case 'openai':
        response = await callOpenAI(model, messagesWithContext, tools);
        break;
      case 'mistral':
        response = await callMistral(model, messagesWithContext, tools);
        break;
      case 'deepseek':
        response = await callDeepSeek(model, messagesWithContext, tools);
        break;
      case 'perplexity':
        response = await callPerplexity(model, messagesWithContext);
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    // Logger la conversation dans la session
    await memory.logSession(`Chat ${provider}/${model}: "${lastUserMessage.slice(0, 50)}..."`);

    res.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Streaming chat endpoint
app.post('/api/chat/stream', async (req, res) => {
  const { provider, model, messages, tools } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Construire le contexte avec la mémoire
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
    const systemContext = await memory.buildContext(lastUserMessage);

    if (provider === 'claude') {
      await streamClaude(model, messages, tools, res, systemContext);
    } else {
      // Fallback to non-streaming for other providers
      const messagesWithContext = [
        { role: 'system', content: systemContext },
        ...messages
      ];
      const response = await callProvider(provider, model, messagesWithContext, tools);
      res.write(`data: ${JSON.stringify({ type: 'content', content: response.content })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    }

    // Logger la conversation
    await memory.logSession(`Chat stream ${provider}/${model}: "${lastUserMessage.slice(0, 50)}..."`);
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
  }

  res.end();
});

// ============================================
// MODEL SELECTION & SUB-AGENTS ENDPOINTS
// ============================================

// Endpoint pour sélection automatique du modèle
app.post('/api/model/select', async (req, res) => {
  try {
    const { provider, message, conversationHistory, options } = req.body;
    const result = selectModel(provider || 'claude', message, conversationHistory || [], options || {});
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint pour lister les sub-agents disponibles
app.get('/api/agents', (req, res) => {
  res.json({
    agents: listAgents(),
    total: listAgents().length
  });
});

// Endpoint pour orchestrer les sub-agents
app.post('/api/agents/orchestrate', async (req, res) => {
  try {
    const { message, options } = req.body;
    const plan = orchestrate(message, options || {});
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Agent chat endpoint with tool execution loop and REAL streaming
app.post('/api/chat/agent', async (req, res) => {
  const { provider, model, messages, autoSelectModel, mode = 'standard' } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Gestion de l'abort par le client
  let isAborted = false;
  let currentAbortController = null;
  let responseStarted = false;

  req.on('close', () => {
    // Ne considérer comme abort que si on a commencé à répondre
    if (responseStarted && !res.writableEnded) {
      console.log('[Agent] Client disconnected - aborting');
      isAborted = true;
      if (currentAbortController) {
        currentAbortController.abort();
      }
    }
  });

  try {
    if (provider !== 'claude') {
      throw new Error('Agent mode only supported for Claude');
    }

    const auth = await getClaudeAuth();

    // Récupérer le dernier message utilisateur pour l'analyse
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';

    // Sélection automatique du modèle si activée
    let selectedModelId = model;
    let modelSelectionInfo = null;

    if (autoSelectModel !== false) {
      const selection = selectModel('claude', lastUserMessage, messages);
      selectedModelId = selection.model;
      modelSelectionInfo = selection;
      console.log(`[Agent] Auto-selected model: ${selectedModelId} (${selection.reason})`);

      // Envoyer l'info de sélection au client
      res.write(`data: ${JSON.stringify({
        type: 'model_selected',
        model: selectedModelId,
        reason: selection.reason,
        taskType: selection.taskType,
        complexity: selection.complexity
      })}\n\n`);
    }

    // Identifier les sub-agents pertinents et enrichir le prompt
    const relevantAgents = identifyRelevantAgents(lastUserMessage);
    const systemPrompt = relevantAgents.length > 0
      ? generateEnrichedSystemPrompt(relevantAgents)
      : AGENT_SYSTEM_PROMPT;

    if (relevantAgents.length > 0) {
      console.log(`[Agent] Activated sub-agents: ${relevantAgents.join(', ')}`);
      res.write(`data: ${JSON.stringify({
        type: 'agents_activated',
        agents: relevantAgents
      })}\n\n`);
    }

    // Log du mode de sécurité actuel
    console.log(`[Agent] Security mode: ${mode}`);
    const modePerms = security.MODE_PERMISSIONS[mode];

    // Filtrer les outils disponibles selon le mode
    const availableTools = modePerms.allowedTools.includes('*')
      ? TOOL_DEFINITIONS
      : TOOL_DEFINITIONS.filter(tool => modePerms.allowedTools.includes(tool.name));

    console.log(`[Agent] Available tools for mode "${mode}": ${availableTools.length}/${TOOL_DEFINITIONS.length}`);

    // Convertir les messages
    const claudeMessages = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }));

    let iteration = 0;
    const MAX_ITERATIONS = 10;
    let continueLoop = true;

    while (continueLoop && iteration < MAX_ITERATIONS && !isAborted) {
      iteration++;
      console.log(`[Agent] Iteration ${iteration}`);

      // Créer un AbortController pour cette requête
      currentAbortController = new AbortController();

      // Appel à Claude avec STREAMING
      const body = {
        model: selectedModelId || 'claude-3-5-haiku-20241022',
        max_tokens: 8096,
        system: systemPrompt,
        messages: claudeMessages,
        tools: availableTools,  // Outils filtrés selon le mode
        stream: true  // ACTIVER LE STREAMING
      };

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': auth.key || auth.token
        },
        body: JSON.stringify(body),
        signal: currentAbortController.signal
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${error}`);
      }

      // Parser le stream SSE de Claude
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let fullContent = [];  // Pour reconstruire la réponse complète
      let currentText = '';
      let currentToolUse = null;
      let toolUses = [];

      try {
        while (!isAborted) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (isAborted) break;
            if (!line.startsWith('data: ')) continue;
            if (line === 'data: [DONE]') continue;

            try {
              const data = JSON.parse(line.slice(6));

              // Traiter les différents types d'événements
              if (data.type === 'content_block_start') {
                if (data.content_block?.type === 'text') {
                  currentText = '';
                } else if (data.content_block?.type === 'tool_use') {
                  currentToolUse = {
                    id: data.content_block.id,
                    name: data.content_block.name,
                    input: ''
                  };
                }
              } else if (data.type === 'content_block_delta') {
                if (data.delta?.type === 'text_delta' && data.delta.text) {
                  // STREAMING TEMPS RÉEL - envoyer chaque morceau au client
                  currentText += data.delta.text;
                  responseStarted = true;
                  res.write(`data: ${JSON.stringify({ type: 'content', content: data.delta.text })}\n\n`);
                } else if (data.delta?.type === 'input_json_delta' && currentToolUse) {
                  currentToolUse.input += data.delta.partial_json || '';
                }
              } else if (data.type === 'content_block_stop') {
                if (currentToolUse) {
                  // Parser l'input JSON de l'outil
                  try {
                    currentToolUse.input = JSON.parse(currentToolUse.input);
                  } catch (e) {
                    currentToolUse.input = {};
                  }
                  toolUses.push(currentToolUse);
                  fullContent.push({ type: 'tool_use', ...currentToolUse });
                  currentToolUse = null;
                } else if (currentText) {
                  fullContent.push({ type: 'text', text: currentText });
                }
              } else if (data.type === 'message_stop') {
                // Message terminé
              } else if (data.type === 'message_delta') {
                // Peut contenir stop_reason
                if (data.delta?.stop_reason === 'end_turn') {
                  continueLoop = false;
                }
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      } catch (e) {
        if (e.name === 'AbortError') {
          console.log('[Agent] Request aborted');
          break;
        }
        throw e;
      }

      if (isAborted) break;

      console.log(`[Agent] Got ${toolUses.length} tool calls`);

      // Si pas d'outils appelés, on termine
      if (toolUses.length === 0) {
        continueLoop = false;
        break;
      }

      // Exécuter les outils (avec validation de sécurité)
      const toolResults = [];
      for (const toolUse of toolUses) {
        if (isAborted) break;

        // Informer le client qu'on exécute un outil
        res.write(`data: ${JSON.stringify({
          type: 'tool_use',
          tool: toolUse.name,
          input: toolUse.input
        })}\n\n`);

        // Valider l'opération selon le mode
        const operation = {
          type: toolUse.name,
          path: toolUse.input?.path,
          command: toolUse.input?.command,
          query: toolUse.input?.query
        };
        const validation = security.validateOperation(operation, mode);

        let result;
        if (!validation.allowed) {
          // Opération bloquée par la sécurité
          result = {
            error: validation.error,
            blocked: true,
            mode: mode,
            suggestion: validation.needsConfirmation
              ? 'Cette opération nécessite une confirmation ou un mode supérieur.'
              : `Passez en mode ${mode === 'standard' ? 'expert' : 'god'} pour effectuer cette opération.`
          };
          res.write(`data: ${JSON.stringify({
            type: 'security_blocked',
            tool: toolUse.name,
            error: validation.error,
            mode: mode
          })}\n\n`);
        } else {
          // Exécuter l'outil
          result = await executeTool(toolUse.name, toolUse.input);
        }

        // Informer le client du résultat
        res.write(`data: ${JSON.stringify({
          type: 'tool_result',
          tool: toolUse.name,
          result: result
        })}\n\n`);

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result)
        });
      }

      if (isAborted) break;

      // Ajouter la réponse de l'assistant et les résultats d'outils aux messages
      claudeMessages.push({
        role: 'assistant',
        content: fullContent
      });

      claudeMessages.push({
        role: 'user',
        content: toolResults
      });
    }

    // Signaler la fin (seulement si pas aborted)
    if (!isAborted) {
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    }

  } catch (error) {
    if (!isAborted) {
      console.error('[Agent] Error:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    }
  }

  res.end();
});

// ============================================
// CLAUDE API IMPLEMENTATION
// ============================================

async function getClaudeAuth() {
  // Prioriser la clé API sur l'OAuth (l'OAuth Claude Code ne fonctionne pas pour l'API directe)
  const config = await getGeoBrainConfig();
  if (config.providers?.claude?.apiKey) {
    return {
      type: 'apikey',
      key: config.providers.claude.apiKey
    };
  }

  const credentials = await getClaudeCredentials();
  if (credentials?.claudeAiOauth) {
    return {
      type: 'oauth',
      token: credentials.claudeAiOauth.accessToken,
      refreshToken: credentials.claudeAiOauth.refreshToken,
      expiresAt: credentials.claudeAiOauth.expiresAt
    };
  }

  throw new Error('Claude not configured. Please add an API key in ~/.geobrain/config.json');
}

async function callClaude(model, messages, tools, systemPrompt = null) {
  const auth = await getClaudeAuth();

  // Séparer le message système des autres messages
  let system = systemPrompt;
  const claudeMessages = [];

  for (const m of messages) {
    if (m.role === 'system') {
      system = m.content;
    } else {
      claudeMessages.push({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      });
    }
  }

  const body = {
    model: model || 'claude-sonnet-4-20250514',
    max_tokens: 8096,
    messages: claudeMessages
  };

  // Ajouter le system prompt si présent
  if (system) {
    body.system = system;
  }

  // Add tools if provided
  if (tools && tools.length > 0) {
    body.tools = tools;
  }

  const headers = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    'x-api-key': auth.key || auth.token
  };

  console.log(`Calling Claude API with model: ${body.model}`);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  return {
    content: data.content[0]?.text || '',
    toolCalls: data.content.filter(c => c.type === 'tool_use'),
    usage: data.usage,
    model: data.model
  };
}

async function streamClaude(model, messages, tools, res, systemPrompt = null) {
  const auth = await getClaudeAuth();

  // Séparer le message système des autres messages
  let system = systemPrompt;
  const claudeMessages = [];

  for (const m of messages) {
    if (m.role === 'system') {
      system = m.content;
    } else {
      claudeMessages.push({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      });
    }
  }

  const body = {
    model: model || 'claude-sonnet-4-20250514',
    max_tokens: 8096,
    messages: claudeMessages,
    stream: true
  };

  // Ajouter le system prompt si présent
  if (system) {
    body.system = system;
  }

  if (tools && tools.length > 0) {
    body.tools = tools;
  }

  const headers = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    'x-api-key': auth.key || auth.token
  };

  console.log(`Streaming Claude API with model: ${body.model}`);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') {
          res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        } else {
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta') {
              res.write(`data: ${JSON.stringify({ type: 'content', content: parsed.delta?.text || '' })}\n\n`);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
  }
}

// ============================================
// OTHER PROVIDERS (simplified)
// ============================================

async function callOpenAI(model, messages, tools) {
  const config = await getGeoBrainConfig();
  const apiKey = config.providers?.openai?.apiKey;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'gpt-4o',
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      tools: tools?.map(t => ({ type: 'function', function: t }))
    })
  });

  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
  const data = await response.json();

  return {
    content: data.choices[0]?.message?.content || '',
    toolCalls: data.choices[0]?.message?.tool_calls || [],
    usage: data.usage
  };
}

async function callMistral(model, messages, tools) {
  const config = await getGeoBrainConfig();
  const apiKey = config.providers?.mistral?.apiKey;
  if (!apiKey) throw new Error('Mistral API key not configured');

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'mistral-large-latest',
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    })
  });

  if (!response.ok) throw new Error(`Mistral error: ${response.status}`);
  const data = await response.json();

  return {
    content: data.choices[0]?.message?.content || '',
    usage: data.usage
  };
}

async function callDeepSeek(model, messages, tools) {
  const config = await getGeoBrainConfig();
  const apiKey = config.providers?.deepseek?.apiKey;
  if (!apiKey) throw new Error('DeepSeek API key not configured');

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'deepseek-chat',
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    })
  });

  if (!response.ok) throw new Error(`DeepSeek error: ${response.status}`);
  const data = await response.json();

  return {
    content: data.choices[0]?.message?.content || '',
    usage: data.usage
  };
}

async function callPerplexity(model, messages) {
  const config = await getGeoBrainConfig();
  const apiKey = config.providers?.perplexity?.apiKey;
  if (!apiKey) throw new Error('Perplexity API key not configured');

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'llama-3.1-sonar-large-128k-online',
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    })
  });

  if (!response.ok) throw new Error(`Perplexity error: ${response.status}`);
  const data = await response.json();

  return {
    content: data.choices[0]?.message?.content || '',
    usage: data.usage
  };
}

// ============================================
// AI PROVIDER ENDPOINTS (for aiRouter.ts)
// ============================================

// Mistral chat endpoint
app.post('/api/ai/mistral/chat', async (req, res) => {
  try {
    const { model, messages, temperature, maxTokens, systemPrompt, apiKey } = req.body;

    // Use provided API key or fallback to stored config
    let key = apiKey;
    if (!key) {
      const config = await getGeoBrainConfig();
      key = config.providers?.mistral?.apiKey;
    }
    if (!key) {
      return res.json({ success: false, error: 'Mistral API key not configured' });
    }

    // Build messages with system prompt
    const finalMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: model || 'mistral-small-latest',
        messages: finalMessages.map(m => ({ role: m.role, content: m.content })),
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens ?? 4096
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return res.json({ success: false, error: `Mistral API error: ${response.status} - ${error}` });
    }

    const data = await response.json();
    res.json({
      success: true,
      content: data.choices[0]?.message?.content || '',
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0
      },
      finishReason: data.choices[0]?.finish_reason
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// DeepSeek chat endpoint
app.post('/api/ai/deepseek/chat', async (req, res) => {
  try {
    const { model, messages, temperature, maxTokens, systemPrompt, apiKey } = req.body;

    let key = apiKey;
    if (!key) {
      const config = await getGeoBrainConfig();
      key = config.providers?.deepseek?.apiKey;
    }
    if (!key) {
      return res.json({ success: false, error: 'DeepSeek API key not configured' });
    }

    const finalMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: model || 'deepseek-chat',
        messages: finalMessages.map(m => ({ role: m.role, content: m.content })),
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens ?? 4096
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return res.json({ success: false, error: `DeepSeek API error: ${response.status} - ${error}` });
    }

    const data = await response.json();
    res.json({
      success: true,
      content: data.choices[0]?.message?.content || '',
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0
      },
      finishReason: data.choices[0]?.finish_reason
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Perplexity chat endpoint
app.post('/api/ai/perplexity/chat', async (req, res) => {
  try {
    const { model, messages, temperature, maxTokens, systemPrompt, apiKey } = req.body;

    let key = apiKey;
    if (!key) {
      const config = await getGeoBrainConfig();
      key = config.providers?.perplexity?.apiKey;
    }
    if (!key) {
      return res.json({ success: false, error: 'Perplexity API key not configured' });
    }

    const finalMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: model || 'sonar',
        messages: finalMessages.map(m => ({ role: m.role, content: m.content })),
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens ?? 4096
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return res.json({ success: false, error: `Perplexity API error: ${response.status} - ${error}` });
    }

    const data = await response.json();
    res.json({
      success: true,
      content: data.choices[0]?.message?.content || '',
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0
      },
      finishReason: data.choices[0]?.finish_reason
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Google (Gemini) chat endpoint
app.post('/api/ai/google/chat', async (req, res) => {
  try {
    const { model, messages, temperature, maxTokens, systemPrompt, apiKey } = req.body;

    let key = apiKey;
    if (!key) {
      const config = await getGeoBrainConfig();
      key = config.providers?.google?.apiKey;
    }
    if (!key) {
      return res.json({ success: false, error: 'Google API key not configured' });
    }

    // Convert messages to Gemini format
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    // Add system instruction if provided
    const requestBody = {
      contents,
      generationConfig: {
        temperature: temperature ?? 0.7,
        maxOutputTokens: maxTokens ?? 4096
      }
    };

    if (systemPrompt) {
      requestBody.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    const modelId = model || 'gemini-2.0-flash';
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return res.json({ success: false, error: `Google API error: ${response.status} - ${error}` });
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    res.json({
      success: true,
      content,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount || 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount || 0
      },
      finishReason: data.candidates?.[0]?.finishReason
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// OpenAI chat endpoint
app.post('/api/ai/openai/chat', async (req, res) => {
  try {
    const { model, messages, temperature, maxTokens, systemPrompt, apiKey } = req.body;

    let key = apiKey;
    if (!key) {
      const config = await getGeoBrainConfig();
      key = config.providers?.openai?.apiKey;
    }
    if (!key) {
      return res.json({ success: false, error: 'OpenAI API key not configured' });
    }

    const finalMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: finalMessages.map(m => ({ role: m.role, content: m.content })),
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens ?? 4096
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return res.json({ success: false, error: `OpenAI API error: ${response.status} - ${error}` });
    }

    const data = await response.json();
    res.json({
      success: true,
      content: data.choices[0]?.message?.content || '',
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0
      },
      finishReason: data.choices[0]?.finish_reason
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Anthropic chat endpoint (non-streaming)
app.post('/api/ai/anthropic/chat', async (req, res) => {
  try {
    const { model, messages, temperature, maxTokens, systemPrompt, apiKey } = req.body;

    const auth = await getClaudeAuth(apiKey);
    if (!auth.apiKey && !auth.oauthToken) {
      return res.json({ success: false, error: 'Claude API not configured' });
    }

    const headers = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      ...(auth.oauthToken
        ? { 'Authorization': `Bearer ${auth.oauthToken}` }
        : { 'x-api-key': auth.apiKey })
    };

    const claudeMessages = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model || 'claude-3-5-haiku-20241022',
        max_tokens: maxTokens ?? 4096,
        system: systemPrompt || '',
        messages: claudeMessages
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return res.json({ success: false, error: `Anthropic API error: ${response.status} - ${error}` });
    }

    const data = await response.json();
    const content = data.content?.find(c => c.type === 'text')?.text || '';

    res.json({
      success: true,
      content,
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0
      },
      finishReason: data.stop_reason
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Ollama chat endpoint (local) - AVEC SQL ASSISTANT ET CONTEXTE PARTAGÉ
app.post('/api/ai/ollama/chat', async (req, res) => {
  try {
    const { model, messages, temperature, systemPrompt, baseUrl, useTools = true, useSQLAssistant = true } = req.body;
    const ollamaUrl = baseUrl || 'http://localhost:11434';

    // Extraire le dernier message utilisateur
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';

    // Construire le contexte partagé (mémoire, personnalité, connaissances)
    // Utilise un max de 2000 tokens pour les modèles locaux (plus légers)
    const sharedContext = await memory.buildContext(lastUserMessage, 2000);

    // MODE 1: SQL Assistant (plus fiable pour les petits modèles)
    if (useSQLAssistant) {
      console.log(`[Ollama] Checking SQL Assistant for: "${lastUserMessage.slice(0, 50)}..."`);

      const sqlResult = await processSQLAssistant(lastUserMessage);

      if (sqlResult.activated) {
        console.log(`[Ollama] SQL Assistant activated for entity: ${sqlResult.entity}`);

        // Construire le prompt enrichi avec les données SQL ET le contexte partagé
        const enrichedMessages = [
          {
            role: 'system',
            content: `${sharedContext}

---
## MODE SQL ASSISTANT
Tu dois répondre aux questions en utilisant UNIQUEMENT les données fournies ci-dessous.
Ne fais JAMAIS de suppositions ou d'estimations. Cite les chiffres exacts.
Réponds de manière concise et professionnelle.`
          },
          ...messages.slice(0, -1), // Messages précédents
          {
            role: 'user',
            content: buildEnrichedPrompt(lastUserMessage, sqlResult)
          }
        ];

        // Appeler Ollama avec le contexte enrichi
        const response = await fetch(`${ollamaUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model || 'llama3.2',
            messages: enrichedMessages.map(m => ({ role: m.role, content: m.content })),
            stream: false,
            options: {
              temperature: 0.3, // Plus bas pour plus de précision
              num_predict: 2048
            }
          })
        });

        if (!response.ok) {
          const error = await response.text();
          return res.json({ success: false, error: `Ollama error: ${response.status} - ${error}` });
        }

        const data = await response.json();
        return res.json({
          success: true,
          content: data.message?.content || '',
          sqlAssistant: {
            activated: true,
            entity: sqlResult.entity,
            query: sqlResult.results?.query,
            rowCount: sqlResult.results?.rowCount
          },
          usage: {
            inputTokens: data.prompt_eval_count || 0,
            outputTokens: data.eval_count || 0
          },
          finishReason: 'stop',
          model: data.model
        });
      }
    }

    // MODE 2: Agent avec outils (pour questions complexes)
    // Qwen2.5:14b est le modèle recommandé pour le tool calling (92% accuracy)
    if (useTools) {
      const toolModel = model || 'qwen2.5:14b'; // Qwen2.5 par défaut pour les outils
      console.log(`[Ollama] MODE 2 - Agent avec outils, modèle: ${toolModel}`);
      console.log(`[Ollama] Shared context length: ${sharedContext.length} chars`);

      const result = await runOllamaAgent(toolModel, messages, {
        baseUrl: ollamaUrl,
        sharedContext: sharedContext, // Passer le contexte partagé à l'agent
        onToolCall: (name, input) => {
          console.log(`[Ollama] Tool called: ${name}`, input);
        },
        onToolResult: (name, result) => {
          console.log(`[Ollama] Tool result for ${name}:`, result.success ? 'success' : 'error');
        }
      });

      return res.json({
        success: true,
        content: result.content,
        toolCalls: result.toolCalls,
        iterations: result.iterations,
        usage: {
          inputTokens: 0,
          outputTokens: 0
        },
        finishReason: 'stop',
        model: result.model
      });
    }

    // MODE 3: Simple chat (fallback) - AVEC CONTEXTE PARTAGÉ
    // Combiner le contexte partagé avec le system prompt optionnel
    const combinedSystemPrompt = sharedContext + (systemPrompt ? `\n\n---\n\n${systemPrompt}` : '');

    console.log(`[Ollama] MODE 3 - Simple chat with shared context (${sharedContext.length} chars)`);

    const finalMessages = [
      { role: 'system', content: combinedSystemPrompt },
      ...messages
    ];

    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'llama3.2',
        messages: finalMessages.map(m => ({ role: m.role, content: m.content })),
        stream: false,
        options: {
          temperature: temperature ?? 0.7
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return res.json({ success: false, error: `Ollama error: ${response.status} - ${error}` });
    }

    const data = await response.json();
    res.json({
      success: true,
      content: data.message?.content || '',
      usage: {
        inputTokens: data.prompt_eval_count || 0,
        outputTokens: data.eval_count || 0
      },
      finishReason: data.done ? 'stop' : 'length',
      model: data.model
    });
  } catch (error) {
    console.error('[Ollama] Error:', error);
    res.json({ success: false, error: error.message });
  }
});

// LM Studio chat endpoint (local, OpenAI compatible)
app.post('/api/ai/lmstudio/chat', async (req, res) => {
  try {
    const { model, messages, temperature, maxTokens, systemPrompt, baseUrl } = req.body;

    // Build messages with system prompt
    const finalMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    const lmstudioUrl = baseUrl || 'http://localhost:1234/v1';
    const response = await fetch(`${lmstudioUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'local-model',
        messages: finalMessages.map(m => ({ role: m.role, content: m.content })),
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens ?? 4096
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return res.json({ success: false, error: `LM Studio error: ${response.status} - ${error}` });
    }

    const data = await response.json();
    res.json({
      success: true,
      content: data.choices[0]?.message?.content || '',
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0
      },
      finishReason: data.choices[0]?.finish_reason
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Provider test endpoints
app.post('/api/ai/:provider/test', async (req, res) => {
  const { provider } = req.params;
  const { apiKey } = req.body;

  try {
    let testUrl, headers;

    switch (provider) {
      case 'anthropic':
        // For Anthropic, try a minimal request
        const auth = await getClaudeAuth(apiKey);
        if (!auth.apiKey && !auth.oauthToken) {
          return res.json({ success: false, error: 'No API key or OAuth token' });
        }
        return res.json({ success: true });

      case 'google':
        if (!apiKey) return res.json({ success: false, error: 'API key required' });
        testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        break;

      case 'openai':
        if (!apiKey) return res.json({ success: false, error: 'API key required' });
        testUrl = 'https://api.openai.com/v1/models';
        headers = { 'Authorization': `Bearer ${apiKey}` };
        break;

      case 'mistral':
        if (!apiKey) return res.json({ success: false, error: 'API key required' });
        testUrl = 'https://api.mistral.ai/v1/models';
        headers = { 'Authorization': `Bearer ${apiKey}` };
        break;

      case 'deepseek':
        if (!apiKey) return res.json({ success: false, error: 'API key required' });
        testUrl = 'https://api.deepseek.com/v1/models';
        headers = { 'Authorization': `Bearer ${apiKey}` };
        break;

      case 'perplexity':
        // Perplexity doesn't have a models endpoint, try a minimal chat
        if (!apiKey) return res.json({ success: false, error: 'API key required' });
        // Just validate the key format
        return res.json({ success: apiKey.startsWith('pplx-') });

      case 'ollama':
        // Test Ollama local server
        testUrl = 'http://localhost:11434/api/tags';
        break;

      case 'lmstudio':
        // Test LM Studio local server
        testUrl = 'http://localhost:1234/v1/models';
        break;

      default:
        return res.json({ success: false, error: 'Unknown provider' });
    }

    const response = await fetch(testUrl, { headers });
    res.json({ success: response.ok });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// ============================================
// SECURITY API
// ============================================

// Get permissions for a specific mode
app.get('/api/security/permissions/:mode', (req, res) => {
  const { mode } = req.params;
  const perms = security.MODE_PERMISSIONS[mode];

  if (!perms) {
    return res.status(400).json({ error: 'Mode inconnu', validModes: ['standard', 'expert', 'god'] });
  }

  res.json({
    mode,
    permissions: perms,
    sandboxPath: security.SANDBOX_PATH
  });
});

// Validate an operation before execution
app.post('/api/security/validate', (req, res) => {
  const { operation, mode } = req.body;

  if (!operation || !mode) {
    return res.status(400).json({ error: 'operation et mode requis' });
  }

  const result = security.validateOperation(operation, mode);
  res.json(result);
});

// Endpoint pour évaluer le niveau de dangerosité d'une commande/requête
app.post('/api/security/evaluate-danger', (req, res) => {
  const { command } = req.body;

  if (!command) {
    return res.status(400).json({ error: 'command requis' });
  }

  const dangerEval = security.evaluateDangerLevel(command);
  const warning = security.generateWarningMessage(dangerEval);

  res.json({
    ...dangerEval,
    warning,
    isBlocked: security.isAlwaysBlocked(command)
  });
});

// Get available tools for a mode
app.get('/api/security/tools/:mode', (req, res) => {
  const { mode } = req.params;
  const perms = security.MODE_PERMISSIONS[mode];

  if (!perms) {
    return res.status(400).json({ error: 'Mode inconnu' });
  }

  // Si mode god, retourner tous les outils disponibles
  if (perms.allowedTools.includes('*')) {
    res.json({
      mode,
      tools: ['*'],
      description: 'Tous les outils sont disponibles'
    });
  } else {
    res.json({
      mode,
      tools: perms.allowedTools,
      description: `${perms.allowedTools.length} outils disponibles`
    });
  }
});

// ============================================
// FILE SYSTEM TOOLS (avec sécurité)
// ============================================

app.post('/api/tools/read-file', async (req, res) => {
  try {
    const { path, mode = 'standard' } = req.body;

    // Valider l'opération selon le mode
    const validation = security.validateOperation({ type: 'read_file', path }, mode);
    if (!validation.allowed) {
      return res.status(403).json({
        error: validation.error,
        blocked: true,
        requiredMode: mode === 'standard' ? 'god' : null
      });
    }

    const content = await readFile(path, 'utf-8');
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tools/write-file', async (req, res) => {
  try {
    const { path, content, mode = 'standard' } = req.body;

    // Valider l'opération selon le mode
    const validation = security.validateOperation({ type: 'write_file', path }, mode);
    if (!validation.allowed) {
      return res.status(403).json({
        error: validation.error,
        blocked: true,
        sandboxPath: security.SANDBOX_PATH,
        suggestion: `En mode "${mode}", vous ne pouvez écrire que dans: ${security.SANDBOX_PATH}`
      });
    }

    await writeFile(path, content, 'utf-8');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tools/list-directory', async (req, res) => {
  try {
    const { path } = req.body;
    const entries = await readdir(path, { withFileTypes: true });
    const result = entries.map(entry => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile()
    }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List Windows drives
app.get('/api/tools/list-drives', async (req, res) => {
  try {
    // On Windows, list available drives
    if (process.platform === 'win32') {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const { stdout } = await execAsync('wmic logicaldisk get name,volumename,description', { encoding: 'utf8' });
      const lines = stdout.trim().split(/\r?\n/).slice(1); // Skip header, handle Windows line endings
      const drives = lines
        .map(line => {
          const trimmed = line.trim();
          if (!trimmed) return null;

          // wmic returns columns in alphabetical order: Description, Name, VolumeName
          // Parse with multiple spaces as separator
          const parts = trimmed.split(/\s{2,}/);

          // Find the drive letter (format: X:)
          const driveMatch = trimmed.match(/([A-Z]:)/);
          if (!driveMatch) return null;

          const driveName = driveMatch[1];
          // Get description (first part) and volume name (last part if exists)
          const description = parts[0] || '';
          const volumeName = parts.length > 2 ? parts[2] : '';
          const label = volumeName || description || 'Disque local';

          return {
            name: driveName,
            path: driveName + '/',
            label: label,
            isDirectory: true
          };
        })
        .filter(Boolean);

      res.json(drives);
    } else {
      // Unix-like: return root
      res.json([{ name: '/', path: '/', label: 'Root', isDirectory: true }]);
    }
  } catch (error) {
    // Fallback: common Windows drives
    res.json([
      { name: 'C:', path: 'C:/', label: 'Disque local', isDirectory: true },
      { name: 'D:', path: 'D:/', label: 'Disque local', isDirectory: true }
    ]);
  }
});

app.post('/api/tools/execute-command', async (req, res) => {
  try {
    const { command, cwd, mode = 'standard', confirmed = false } = req.body;

    // Valider l'opération selon le mode (avec flag confirmed pour bypass confirmation)
    const validation = security.validateOperation({ type: 'execute_command', command, confirmed }, mode);
    if (!validation.allowed) {
      return res.status(403).json({
        error: validation.error,
        blocked: validation.blocked || false,
        needsConfirmation: validation.needsConfirmation || false,
        dangerLevel: validation.dangerLevel || null,
        dangerColor: validation.dangerColor || null,
        warning: validation.warning || null,
        requiredMode: mode === 'standard' ? 'expert' : (mode === 'expert' ? 'god' : null)
      });
    }

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const { stdout, stderr } = await execAsync(command, {
      cwd: cwd || process.cwd(),
      timeout: 30000
    });

    res.json({ stdout, stderr });
  } catch (error) {
    res.status(500).json({ error: error.message, stderr: error.stderr });
  }
});

// Endpoint pour les requêtes SQL (avec sécurité)
app.post('/api/tools/sql-query', async (req, res) => {
  try {
    const { query, database, mode = 'standard', confirmed = false } = req.body;

    // Valider l'opération selon le mode (avec flag confirmed pour bypass confirmation)
    const validation = security.validateOperation({ type: 'sql_query', query, confirmed }, mode);
    if (!validation.allowed) {
      return res.status(403).json({
        error: validation.error,
        blocked: validation.blocked || false,
        needsConfirmation: validation.needsConfirmation || false,
        dangerLevel: validation.dangerLevel || null,
        dangerColor: validation.dangerColor || null,
        warning: validation.warning || null,
        allowedInMode: mode === 'standard' ? 'Seules les requêtes SELECT sont autorisées' : null
      });
    }

    // TODO: Implémenter la vraie connexion DB
    res.json({
      message: 'SQL endpoint ready',
      query,
      validated: true
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint pour supprimer des fichiers (avec sécurité)
app.post('/api/tools/delete-file', async (req, res) => {
  try {
    const { path, mode = 'standard' } = req.body;
    const { unlink } = await import('fs/promises');

    // Valider l'opération selon le mode
    const validation = security.validateOperation({ type: 'delete_file', path }, mode);
    if (!validation.allowed) {
      return res.status(403).json({
        error: validation.error,
        blocked: true,
        requiredMode: 'expert'
      });
    }

    await unlink(path);
    res.json({ success: true, deleted: path });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// USAGE STATS API
// ============================================

// Store pour les stats de session (en mémoire)
const sessionStats = {
  startTime: Date.now(),
  tokenCount: 0,
  cost: 0,
  requests: 0
};

// Tarifs approximatifs par modèle ($ per 1M tokens input/output moyenné)
const MODEL_COSTS = {
  'claude-sonnet-4-20250514': 0.003,
  'claude-opus-4-20250514': 0.015,
  'claude-3-5-haiku-20241022': 0.00025,
  'gpt-4o': 0.005,
  'gpt-4o-mini': 0.00015,
  'mistral-large-latest': 0.003,
  'deepseek-chat': 0.0001
};

// Fonction pour tracker l'usage (appelée après chaque requête)
function trackUsage(model, inputTokens, outputTokens) {
  const totalTokens = (inputTokens || 0) + (outputTokens || 0);
  sessionStats.tokenCount += totalTokens;
  sessionStats.requests++;

  // Calculer le coût approximatif
  const costPerToken = MODEL_COSTS[model] || 0.001;
  sessionStats.cost += (totalTokens / 1000000) * costPerToken * 1000000; // Simplification
}

app.get('/api/usage', async (req, res) => {
  try {
    const config = await getGeoBrainConfig();
    const monthlyLimit = config.monthlyTokenLimit || null;

    // Récupérer les stats mensuelles depuis le fichier (si existant)
    let monthlyStats = { tokens: 0, cost: 0, requests: 0 };
    const statsPath = join(homedir(), '.geobrain', 'usage-stats.json');

    try {
      if (existsSync(statsPath)) {
        const data = await readFile(statsPath, 'utf-8');
        const stats = JSON.parse(data);
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

        if (stats.month === currentMonth) {
          monthlyStats = stats;
        }
      }
    } catch (e) {
      // Ignore, use defaults
    }

    res.json({
      sessionTokens: sessionStats.tokenCount,
      sessionCost: sessionStats.cost,
      sessionRequests: sessionStats.requests,
      sessionStartTime: sessionStats.startTime,
      monthlyTokens: monthlyStats.tokens + sessionStats.tokenCount,
      monthlyCost: monthlyStats.cost + sessionStats.cost,
      monthlyLimit: monthlyLimit,
      monthlyRequests: monthlyStats.requests + sessionStats.requests
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sauvegarder les stats mensuelles
async function saveMonthlyStats() {
  try {
    const statsPath = join(homedir(), '.geobrain', 'usage-stats.json');
    const currentMonth = new Date().toISOString().slice(0, 7);

    let monthlyStats = { month: currentMonth, tokens: 0, cost: 0, requests: 0 };

    if (existsSync(statsPath)) {
      const data = await readFile(statsPath, 'utf-8');
      const existing = JSON.parse(data);
      if (existing.month === currentMonth) {
        monthlyStats = existing;
      }
    }

    monthlyStats.tokens += sessionStats.tokenCount;
    monthlyStats.cost += sessionStats.cost;
    monthlyStats.requests += sessionStats.requests;

    const dir = dirname(statsPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(statsPath, JSON.stringify(monthlyStats, null, 2));
  } catch (e) {
    console.error('Error saving monthly stats:', e);
  }
}

// Sauvegarder les stats à l'arrêt du serveur
process.on('SIGINT', async () => {
  console.log('\nSaving usage stats...');
  await saveMonthlyStats();
  process.exit(0);
});

// ============================================
// GEOPORTAL PROXY API
// ============================================

// Login au geoportail
app.post('/api/geoportal/login', async (req, res) => {
  try {
    const { username, password, remember } = req.body;
    const result = await geoportalProxy.login(username, password, remember);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Logout
app.post('/api/geoportal/logout', (req, res) => {
  const result = geoportalProxy.logout();
  res.json(result);
});

// Status de la session
app.get('/api/geoportal/session', (req, res) => {
  const status = geoportalProxy.getSessionStatus();
  res.json(status);
});

// Proxy WMS GetMap - retourne une image
app.get('/api/geoportal/wms/:theme', async (req, res) => {
  try {
    const { theme } = req.params;
    const result = await geoportalProxy.proxyWmsGetMap(theme, req.query);

    // Transmettre les headers de l'image
    res.set('Content-Type', result.headers['content-type'] || 'image/png');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(result.buffer);
  } catch (error) {
    if (error.message.includes('Non authentifie') || error.message.includes('Session expiree')) {
      res.status(401).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Proxy generique pour autres requetes geoportail
app.get('/api/geoportal/proxy/*', async (req, res) => {
  try {
    const targetPath = '/' + req.params[0] + (req.query ? '?' + new URLSearchParams(req.query).toString() : '');
    const result = await geoportalProxy.proxyRequest(targetPath);

    res.set('Content-Type', result.headers['content-type'] || 'application/octet-stream');
    res.send(result.buffer);
  } catch (error) {
    if (error.message.includes('Non authentifie') || error.message.includes('Session expiree')) {
      res.status(401).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// GetCapabilities WMS (souvent public)
app.get('/api/geoportal/capabilities/:theme', async (req, res) => {
  try {
    const { theme } = req.params;
    const capabilities = await geoportalProxy.getWmsCapabilities(theme);
    res.set('Content-Type', 'application/xml');
    res.send(capabilities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Récupérer les thèmes disponibles (avec ou sans auth)
app.get('/api/geoportal/themes', async (req, res) => {
  try {
    // Essayer d'abord avec authentification si connecté
    const isAuth = geoportalProxy.isAuthenticated();
    let themesData;

    if (isAuth) {
      console.log('[Geoportal] Fetching themes with authentication...');
      const result = await geoportalProxy.proxyRequest('/themes.json');
      themesData = JSON.parse(result.buffer.toString());
    } else {
      // Fallback: récupérer les thèmes publics
      console.log('[Geoportal] Fetching public themes...');
      const response = await fetch('https://geo.bussigny.ch/themes.json');
      themesData = await response.json();
    }

    // Extraire et formater les thèmes
    const themes = [];
    if (themesData.themes?.items) {
      for (const item of themesData.themes.items) {
        themes.push({
          id: item.id,
          name: item.title || item.name || item.id,
          description: item.description || '',
          thumbnail: item.thumbnail || null,
          isPublic: !item.restricted,
          wmsUrl: item.wms_name ? `https://geo.bussigny.ch/ows/${item.wms_name}` : null
        });
      }
    }

    res.json({
      themes,
      isAuthenticated: isAuth,
      total: themes.length
    });
  } catch (error) {
    console.error('[Geoportal] Error fetching themes:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CONNECTIONS MANAGEMENT
// ============================================

import * as connections from './connections.js';

// Liste des types de connexions supportés
app.get('/api/connections/types', (req, res) => {
  res.json(connections.CONNECTION_TYPES);
});

// Liste toutes les connexions
app.get('/api/connections', (req, res) => {
  try {
    const list = connections.listConnections();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ajoute une nouvelle connexion
app.post('/api/connections', (req, res) => {
  try {
    const result = connections.addConnection(req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Met à jour une connexion
app.put('/api/connections/:id', (req, res) => {
  try {
    const result = connections.updateConnection(req.params.id, req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Supprime une connexion
app.delete('/api/connections/:id', (req, res) => {
  try {
    connections.deleteConnection(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Teste une connexion (sans la sauvegarder)
app.post('/api/connections/test', async (req, res) => {
  try {
    const result = await connections.testConnection(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Se connecte à un serveur
app.post('/api/connections/:id/connect', async (req, res) => {
  try {
    const result = await connections.connect(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Se déconnecte d'un serveur
app.post('/api/connections/:id/disconnect', (req, res) => {
  try {
    const result = connections.disconnect(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Exécute une requête SQL
app.post('/api/connections/:id/sql', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query required' });
    }
    const result = await connections.executeSQL(req.params.id, query);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Exécute une commande SSH
app.post('/api/connections/:id/ssh', async (req, res) => {
  try {
    const { command } = req.body;
    if (!command) {
      return res.status(400).json({ error: 'Command required' });
    }
    const result = await connections.executeSSH(req.params.id, command);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Récupère les capabilities OGC
app.get('/api/connections/:id/capabilities', async (req, res) => {
  try {
    const result = await connections.getOGCCapabilities(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ============================================
// SERVER MANAGEMENT ENDPOINTS
// ============================================

// Server status endpoint
app.get('/api/server/status', (req, res) => {
  res.json({
    status: 'running',
    uptime: process.uptime(),
    startTime: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    nodeVersion: process.version,
    memoryUsage: process.memoryUsage(),
    pid: process.pid
  });
});

// Restart endpoint - mode expert/god uniquement
app.post('/api/server/restart', async (req, res) => {
  const { mode = 'standard' } = req.body;

  // Vérifier les permissions
  if (mode === 'standard') {
    return res.status(403).json({
      error: 'Redémarrage serveur non autorisé en mode standard. Passez en mode expert.'
    });
  }

  console.log('\n🔄 Redémarrage demandé depuis l\'interface...\n');

  // Envoyer la réponse avant de redémarrer
  res.json({
    success: true,
    message: 'Redémarrage en cours...',
    willRestartIn: 1500
  });

  // Attendre que la réponse soit envoyée
  setTimeout(async () => {
    const { spawn } = await import('child_process');
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    console.log('🔄 Lancement du nouveau processus serveur...');

    // Lancer un nouveau processus Node.js détaché
    const child = spawn('node', ['index.js'], {
      cwd: __dirname,
      detached: true,
      stdio: 'ignore',
      shell: true
    });

    // Détacher le processus enfant
    child.unref();

    console.log('✅ Nouveau processus lancé, arrêt de l\'ancien...');

    // Fermer le serveur actuel proprement
    if (global.geobrainServer) {
      global.geobrainServer.close(() => {
        console.log('👋 Ancien serveur arrêté');
        process.exit(0);
      });
    }

    // Force exit après 2 secondes si le close ne fonctionne pas
    setTimeout(() => {
      process.exit(0);
    }, 2000);
  }, 500);
});

// ============================================
// PORT CLEANUP UTILITY
// ============================================

/**
 * Tue tout processus utilisant le port spécifié (Windows)
 * Méthode robuste : netstat + taskkill via PowerShell
 */
async function killProcessOnPort(port) {
  return new Promise((resolve) => {
    // Utiliser PowerShell pour trouver et tuer le processus
    const findCmd = `powershell.exe -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`;

    exec(findCmd, (error, stdout) => {
      if (error || !stdout.trim()) {
        console.log(`✅ Port ${port} libre`);
        resolve(true);
        return;
      }

      const pids = stdout.trim().split('\n').filter(pid => pid.trim() && pid.trim() !== '0');

      if (pids.length === 0) {
        console.log(`✅ Port ${port} libre`);
        resolve(true);
        return;
      }

      console.log(`⚠️ Port ${port} occupé par PID: ${pids.join(', ')}`);

      // Tuer chaque processus (sauf le processus actuel)
      const currentPid = process.pid.toString();
      const pidsToKill = pids.filter(pid => pid.trim() !== currentPid);

      if (pidsToKill.length === 0) {
        resolve(true);
        return;
      }

      const killPromises = pidsToKill.map(pid => {
        return new Promise((resolveKill) => {
          const killCmd = `powershell.exe -Command "Stop-Process -Id ${pid.trim()} -Force -ErrorAction SilentlyContinue"`;
          exec(killCmd, () => {
            console.log(`   🔪 Processus ${pid.trim()} terminé`);
            resolveKill();
          });
        });
      });

      Promise.all(killPromises).then(() => {
        // Attendre un peu que les sockets TIME_WAIT se libèrent
        setTimeout(() => {
          console.log(`✅ Port ${port} libéré`);
          resolve(true);
        }, 1000);
      });
    });
  });
}

// ============================================
// START SERVER
// ============================================

// Fonction de démarrage avec nettoyage du port
async function startServer() {
  // D'abord, libérer le port si occupé
  await killProcessOnPort(PORT);

  const server = app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║         GeoBrain Backend Server            ║
║════════════════════════════════════════════║
║  Running on: http://localhost:${PORT}         ║
║  Press Ctrl+C to stop                      ║
╚════════════════════════════════════════════╝
    `);
  });

  // Gérer les erreurs de démarrage
  server.on('error', async (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`\n⚠️ Port ${PORT} encore occupé, nouvelle tentative...`);
      await killProcessOnPort(PORT);
      setTimeout(() => startServer(), 2000);
    } else {
      console.error('Erreur serveur:', err);
      process.exit(1);
    }
  });

  // Graceful shutdown handler
  process.on('SIGTERM', () => {
    console.log('\n📴 Signal SIGTERM reçu, arrêt gracieux...');
    server.close(() => {
      console.log('✅ Serveur arrêté proprement');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('\n📴 Ctrl+C reçu, arrêt gracieux...');
    server.close(() => {
      console.log('✅ Serveur arrêté proprement');
      process.exit(0);
    });
  });

  // Stocker la référence du serveur globalement pour le restart
  global.geobrainServer = server;
}

// ============================================
// GLOBAL ERROR HANDLERS
// ============================================

// Capturer les erreurs non gérées pour éviter les crashes
process.on('uncaughtException', (err) => {
  console.error('[ERREUR NON CAPTURÉE]', err.message);
  console.error(err.stack);
  // Ne pas faire process.exit() - laisser le serveur tourner
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[PROMESSE REJETÉE NON GÉRÉE]', reason);
  // Ne pas faire process.exit() - laisser le serveur tourner
});

// Démarrer le serveur
startServer();
