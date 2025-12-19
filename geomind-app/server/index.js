/**
 * GeoMind Backend Server
 * Gère les appels API aux LLMs et les opérations système
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { readFile, writeFile, readdir, stat, mkdir } from 'fs/promises';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
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
import * as mvtTiles from './mvt-tiles.js';
import { setupCommunicationsRoutes } from './communications-routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Setup Communications routes (Outlook, Calendar, Teams, 3CX)
setupCommunicationsRoutes(app);

// ============================================
// CREDENTIALS MANAGEMENT
// ============================================

const CLAUDE_CREDENTIALS_PATH = join(homedir(), '.claude', '.credentials.json');
const GEOMIND_CONFIG_PATH = join(homedir(), '.geomind', 'config.json');

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

async function getGeoMindConfig() {
  let config = { providers: {} };

  // 1. Lire depuis le fichier config
  try {
    if (existsSync(GEOMIND_CONFIG_PATH)) {
      const data = await readFile(GEOMIND_CONFIG_PATH, 'utf-8');
      config = JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading GeoMind config:', error);
  }

  // 2. Fusionner avec les variables d'environnement (prioritaires)
  if (!config.providers) config.providers = {};

  // Groq depuis .env
  if (process.env.GROQ_API_KEY) {
    config.providers.groq = {
      ...config.providers.groq,
      apiKey: process.env.GROQ_API_KEY
    };
  }

  // OpenAI depuis .env
  if (process.env.OPENAI_API_KEY) {
    config.providers.openai = {
      ...config.providers.openai,
      apiKey: process.env.OPENAI_API_KEY
    };
  }

  // Anthropic depuis .env
  if (process.env.ANTHROPIC_API_KEY) {
    config.providers.anthropic = {
      ...config.providers.anthropic,
      apiKey: process.env.ANTHROPIC_API_KEY
    };
  }

  // Google depuis .env
  if (process.env.GOOGLE_API_KEY) {
    config.providers.google = {
      ...config.providers.google,
      apiKey: process.env.GOOGLE_API_KEY
    };
  }

  return config;
}

async function saveGeoMindConfig(config) {
  const dir = dirname(GEOMIND_CONFIG_PATH);
  if (!existsSync(dir)) {
    await import('fs').then(fs => fs.promises.mkdir(dir, { recursive: true }));
  }
  await writeFile(GEOMIND_CONFIG_PATH, JSON.stringify(config, null, 2));
}

// ============================================
// PROVIDERS CONFIGURATION
// ============================================

const PROVIDERS = {
  groq: {
    name: 'Groq (Gratuit)',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', default: true },
      { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B' },
    ],
    authType: 'apikey',
    baseUrl: 'https://api.groq.com/openai/v1'
  },
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
  const config = await getGeoMindConfig();

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

  const config = await getGeoMindConfig();
  config.providers = config.providers || {};
  config.providers[providerId] = { apiKey };
  await saveGeoMindConfig(config);

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
  const config = await getGeoMindConfig();

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
  const { provider, model, messages, tools, skipMemoryContext } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Extraire le dernier message utilisateur pour le logging
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';

    // Si un message système est déjà présent ou skipMemoryContext=true, ne pas ajouter de contexte mémoire
    const hasSystemMessage = messages.some(m => m.role === 'system');
    let systemContext = null;

    if (!hasSystemMessage && !skipMemoryContext) {
      systemContext = await memory.buildContext(lastUserMessage);
    }

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
    // Providers supportant le tool use
    const toolUseProviders = ['claude', 'groq', 'openai'];

    if (!toolUseProviders.includes(provider)) {
      // Pour les providers sans tool use, utiliser l'endpoint enrichi avec sql-assistant
      throw new Error(`Agent mode with tool use requires Claude, Groq, or OpenAI. For ${provider}, use the enhanced sql-assistant mode.`);
    }

    // Auth selon le provider
    let auth = null;
    if (provider === 'claude') {
      auth = await getClaudeAuth();
    }

    // Récupérer le dernier message utilisateur pour l'analyse
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';

    // Sélection automatique du modèle si activée
    let selectedModelId = model;
    let modelSelectionInfo = null;

    if (autoSelectModel !== false) {
      const selection = selectModel(provider, lastUserMessage, messages);
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
    const agentMessages = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }));

    let iteration = 0;
    const MAX_ITERATIONS = 10;
    let continueLoop = true;

    // =============================================
    // GROQ AGENT LOOP (non-streaming avec tool use)
    // =============================================
    if (provider === 'groq') {
      console.log(`[Agent/Groq] Starting Groq agent with model: ${selectedModelId || 'llama-3.3-70b-versatile'}`);

      while (continueLoop && iteration < MAX_ITERATIONS && !isAborted) {
        iteration++;
        console.log(`[Agent/Groq] Iteration ${iteration}`);

        try {
          const result = await callGroq(
            selectedModelId || 'llama-3.3-70b-versatile',
            agentMessages,
            availableTools,
            systemPrompt
          );

          // Envoyer le contenu texte
          if (result.content) {
            res.write(`data: ${JSON.stringify({ type: 'content', content: result.content })}\n\n`);
          }

          // Traiter les tool calls
          if (result.toolCalls && result.toolCalls.length > 0) {
            console.log(`[Agent/Groq] Got ${result.toolCalls.length} tool calls`);

            // Ajouter la réponse de l'assistant avec les tool calls
            agentMessages.push({
              role: 'assistant',
              content: result.content || '',
              tool_calls: result.toolCalls.map(tc => ({
                id: tc.id,
                type: 'function',
                function: { name: tc.name, arguments: JSON.stringify(tc.input) }
              }))
            });

            // Exécuter chaque outil
            for (const toolCall of result.toolCalls) {
              res.write(`data: ${JSON.stringify({ type: 'tool_use', tool: toolCall.name, input: toolCall.input })}\n\n`);

              console.log(`[Tools] Executing: ${toolCall.name}`, toolCall.input);
              const toolResult = await executeTool(toolCall.name, toolCall.input);

              res.write(`data: ${JSON.stringify({ type: 'tool_result', tool: toolCall.name, result: toolResult })}\n\n`);

              // Ajouter le résultat de l'outil aux messages
              agentMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolResult)
              });
            }
            // Continuer la boucle pour laisser le modèle répondre
          } else {
            // Pas de tool calls, on a fini
            continueLoop = false;
          }
        } catch (error) {
          console.error('[Agent/Groq] Error:', error.message);
          res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
          continueLoop = false;
        }
      }

      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
      return;
    }

    // =============================================
    // CLAUDE AGENT LOOP (streaming avec tool use)
    // =============================================
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
        messages: agentMessages,
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
      agentMessages.push({
        role: 'assistant',
        content: fullContent
      });

      agentMessages.push({
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
  const config = await getGeoMindConfig();
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

  throw new Error('Claude not configured. Please add an API key in ~/.geomind/config.json');
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
  const config = await getGeoMindConfig();
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
  const config = await getGeoMindConfig();
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
  const config = await getGeoMindConfig();
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
  const config = await getGeoMindConfig();
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

/**
 * Call Groq API (OpenAI-compatible, with tool use support)
 * Free tier available, very fast inference
 */
async function callGroq(model, messages, tools, systemPrompt) {
  const config = await getGeoMindConfig();
  const apiKey = config.providers?.groq?.apiKey;
  if (!apiKey) throw new Error('Groq API key not configured. Get one free at https://console.groq.com');

  const groqMessages = [];

  // Add system prompt if provided
  if (systemPrompt) {
    groqMessages.push({ role: 'system', content: systemPrompt });
  }

  // Add conversation messages
  for (const m of messages) {
    if (m.role === 'system' && !systemPrompt) {
      groqMessages.push({ role: 'system', content: m.content });
    } else if (m.role === 'tool') {
      // Tool results need tool_call_id
      groqMessages.push({
        role: 'tool',
        tool_call_id: m.tool_call_id,
        content: m.content
      });
    } else if (m.role === 'assistant' && m.tool_calls) {
      // Assistant messages with tool calls
      groqMessages.push({
        role: 'assistant',
        content: m.content || '',
        tool_calls: m.tool_calls
      });
    } else if (m.role !== 'system') {
      groqMessages.push({ role: m.role, content: m.content });
    }
  }

  const body = {
    model: model || 'llama-3.3-70b-versatile',
    messages: groqMessages,
    max_tokens: 8096,
    temperature: 0.7
  };

  // Add tools if provided (OpenAI format)
  if (tools && tools.length > 0) {
    body.tools = tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema
      }
    }));
    body.tool_choice = 'auto';
  }

  console.log(`[Groq] Calling model: ${body.model} with ${tools?.length || 0} tools`);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const message = data.choices[0]?.message;

  return {
    content: message?.content || '',
    toolCalls: message?.tool_calls?.map(tc => ({
      id: tc.id,
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments || '{}')
    })) || [],
    usage: data.usage,
    model: data.model
  };
}

/**
 * Stream Groq API response
 */
async function streamGroq(model, messages, tools, res, systemPrompt) {
  const config = await getGeoMindConfig();
  const apiKey = config.providers?.groq?.apiKey;
  if (!apiKey) throw new Error('Groq API key not configured');

  const groqMessages = [];
  if (systemPrompt) {
    groqMessages.push({ role: 'system', content: systemPrompt });
  }
  for (const m of messages) {
    if (m.role !== 'system') {
      groqMessages.push({ role: m.role, content: m.content });
    }
  }

  const body = {
    model: model || 'llama-3.3-70b-versatile',
    messages: groqMessages,
    max_tokens: 8096,
    stream: true
  };

  if (tools && tools.length > 0) {
    body.tools = tools.map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.input_schema }
    }));
  }

  console.log(`[Groq] Streaming model: ${body.model}`);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq streaming error: ${response.status} - ${error}`);
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
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              res.write(`data: ${JSON.stringify({ type: 'content', content: delta.content })}\n\n`);
            }
          } catch (e) {}
        }
      }
    }
  }
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
      const config = await getGeoMindConfig();
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
      const config = await getGeoMindConfig();
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
      const config = await getGeoMindConfig();
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
      const config = await getGeoMindConfig();
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
      const config = await getGeoMindConfig();
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
    const config = await getGeoMindConfig();
    const monthlyLimit = config.monthlyTokenLimit || null;

    // Récupérer les stats mensuelles depuis le fichier (si existant)
    let monthlyStats = { tokens: 0, cost: 0, requests: 0 };
    const statsPath = join(homedir(), '.geomind', 'usage-stats.json');

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
    const statsPath = join(homedir(), '.geomind', 'usage-stats.json');
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
app.post('/api/connections/:id/disconnect', async (req, res) => {
  try {
    const result = await connections.disconnect(req.params.id);
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

// Exécute une requête SQL générée par IA avec validation et protections
app.post('/api/connections/:id/ai-sql', async (req, res) => {
  try {
    const { query, options = {} } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query required' });
    }
    // Options de sécurité par défaut pour les requêtes IA
    const secureOptions = {
      readOnly: options.readOnly !== false,  // Lecture seule par défaut
      allowedTables: options.allowedTables || [],
      maxRows: Math.min(options.maxRows || 1000, 10000), // Max 10k lignes
      timeout: Math.min(options.timeout || 30000, 60000) // Max 60s
    };
    const result = await connections.executeAISQL(req.params.id, query, secureOptions);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Liste les tables d'une connexion PostgreSQL
app.get('/api/connections/:id/tables', async (req, res) => {
  try {
    const result = await connections.listTables(req.params.id);
    res.json({ success: true, tables: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Obtient le schéma d'une table spécifique
app.get('/api/connections/:id/tables/:tableName/schema', async (req, res) => {
  try {
    const result = await connections.getTableSchema(req.params.id, req.params.tableName);
    res.json({ success: true, columns: result });
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
// DATABASES MODULE API
// ============================================

/**
 * Extrait le schéma complet d'une base de données PostgreSQL
 * GET /api/databases/:connectionId/schema
 */
app.get('/api/databases/:connectionId/schema', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { schemas = 'public' } = req.query;

    // Vérifier que la connexion est active
    const conn = connections.getConnection(connectionId);
    if (!conn || conn.type !== 'postgresql') {
      return res.status(400).json({ error: 'Connexion PostgreSQL non trouvée' });
    }

    // S'assurer qu'on est connecté
    try {
      await connections.connect(connectionId);
    } catch (e) {
      // Déjà connecté, c'est ok
    }

    const schemaList = schemas.split(',').map(s => `'${s.trim()}'`).join(',');

    // 1. Récupérer toutes les tables (avec gestion d'erreur pour regclass)
    const tablesQuery = `
      SELECT
        t.table_schema as schema,
        t.table_name as name,
        d.description as comment,
        COALESCE(pg_total_relation_size(c.oid), 0) as size_bytes,
        (SELECT count(*) FROM information_schema.columns col
         WHERE col.table_schema = t.table_schema AND col.table_name = t.table_name) as column_count
      FROM information_schema.tables t
      LEFT JOIN pg_class c ON c.relname = t.table_name
        AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = t.table_schema)
      LEFT JOIN pg_description d ON d.objoid = c.oid AND d.objsubid = 0
      WHERE t.table_schema IN (${schemaList})
        AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_schema, t.table_name
    `;
    const tablesResult = await connections.executeSQL(connectionId, tablesQuery);

    // 2. Récupérer toutes les colonnes avec leurs types et contraintes
    const columnsQuery = `
      SELECT
        c.table_schema as schema,
        c.table_name as table_name,
        c.column_name as name,
        c.data_type as type,
        c.udt_name as udt_type,
        c.character_maximum_length as max_length,
        c.numeric_precision,
        c.numeric_scale,
        c.is_nullable = 'YES' as nullable,
        c.column_default as default_value,
        pd.description as comment,
        c.ordinal_position as position
      FROM information_schema.columns c
      LEFT JOIN pg_class pc ON pc.relname = c.table_name
        AND pc.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = c.table_schema)
      LEFT JOIN pg_description pd ON pd.objoid = pc.oid AND pd.objsubid = c.ordinal_position
      WHERE c.table_schema IN (${schemaList})
      ORDER BY c.table_schema, c.table_name, c.ordinal_position
    `;
    const columnsResult = await connections.executeSQL(connectionId, columnsQuery);

    // 3. Récupérer les clés primaires
    const pkQuery = `
      SELECT
        tc.table_schema as schema,
        tc.table_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema IN (${schemaList})
    `;
    const pkResult = await connections.executeSQL(connectionId, pkQuery);

    // 4. Récupérer les clés étrangères
    const fkQuery = `
      SELECT
        tc.table_schema as schema,
        tc.table_name,
        kcu.column_name,
        ccu.table_schema as foreign_schema,
        ccu.table_name as foreign_table,
        ccu.column_name as foreign_column,
        tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema IN (${schemaList})
    `;
    const fkResult = await connections.executeSQL(connectionId, fkQuery);

    // 5. Récupérer les colonnes géométriques (PostGIS)
    let geometryColumns = [];
    try {
      const geoQuery = `
        SELECT
          f_table_schema as schema,
          f_table_name as table_name,
          f_geometry_column as column_name,
          type as geometry_type,
          srid,
          coord_dimension
        FROM geometry_columns
        WHERE f_table_schema IN (${schemaList})
      `;
      const geoResult = await connections.executeSQL(connectionId, geoQuery);
      geometryColumns = geoResult.rows;
    } catch (e) {
      // PostGIS non installé, ignorer
    }

    // 6. Récupérer les index
    const indexQuery = `
      SELECT
        schemaname as schema,
        tablename as table_name,
        indexname as index_name,
        indexdef as definition
      FROM pg_indexes
      WHERE schemaname IN (${schemaList})
    `;
    const indexResult = await connections.executeSQL(connectionId, indexQuery);

    // 7. Récupérer la liste des schémas disponibles
    const schemasQuery = `
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name
    `;
    const schemasResult = await connections.executeSQL(connectionId, schemasQuery);

    // Créer des maps pour un accès rapide
    const pkMap = new Map();
    pkResult.rows.forEach(pk => {
      const key = `${pk.schema}.${pk.table_name}`;
      if (!pkMap.has(key)) pkMap.set(key, new Set());
      pkMap.get(key).add(pk.column_name);
    });

    const fkMap = new Map();
    fkResult.rows.forEach(fk => {
      const key = `${fk.schema}.${fk.table_name}.${fk.column_name}`;
      fkMap.set(key, {
        foreignSchema: fk.foreign_schema,
        foreignTable: fk.foreign_table,
        foreignColumn: fk.foreign_column,
        constraintName: fk.constraint_name
      });
    });

    const geoMap = new Map();
    geometryColumns.forEach(gc => {
      const key = `${gc.schema}.${gc.table_name}.${gc.column_name}`;
      geoMap.set(key, {
        geometryType: gc.geometry_type,
        srid: gc.srid,
        coordDimension: gc.coord_dimension
      });
    });

    // Assembler le résultat
    const tables = tablesResult.rows.map(table => {
      const tableKey = `${table.schema}.${table.name}`;
      const tablePks = pkMap.get(tableKey) || new Set();

      const columns = columnsResult.rows
        .filter(c => c.schema === table.schema && c.table_name === table.name)
        .map(col => {
          const colKey = `${col.schema}.${col.table_name}.${col.name}`;
          const fk = fkMap.get(colKey);
          const geo = geoMap.get(colKey);

          return {
            name: col.name,
            type: col.udt_type || col.type,
            dataType: col.type,
            maxLength: col.max_length,
            precision: col.numeric_precision,
            scale: col.numeric_scale,
            nullable: col.nullable,
            defaultValue: col.default_value,
            comment: col.comment,
            isPrimaryKey: tablePks.has(col.name),
            isForeignKey: !!fk,
            foreignKey: fk,
            isGeometry: !!geo,
            geometry: geo,
            position: col.position
          };
        });

      const tableIndexes = indexResult.rows
        .filter(i => i.schema === table.schema && i.table_name === table.name)
        .map(i => ({
          name: i.index_name,
          definition: i.definition
        }));

      return {
        schema: table.schema,
        name: table.name,
        fullName: `${table.schema}.${table.name}`,
        comment: table.comment,
        sizeBytes: parseInt(table.size_bytes),
        columnCount: parseInt(table.column_count),
        columns,
        indexes: tableIndexes,
        hasGeometry: columns.some(c => c.isGeometry)
      };
    });

    // Calculer les relations entre tables (pour ERD)
    const relations = fkResult.rows.map(fk => ({
      sourceTable: `${fk.schema}.${fk.table_name}`,
      sourceColumn: fk.column_name,
      targetTable: `${fk.foreign_schema}.${fk.foreign_table}`,
      targetColumn: fk.foreign_column,
      constraintName: fk.constraint_name
    }));

    res.json({
      success: true,
      database: conn.database,
      availableSchemas: schemasResult.rows.map(s => s.schema_name),
      requestedSchemas: schemas.split(',').map(s => s.trim()),
      tables,
      relations,
      stats: {
        tableCount: tables.length,
        totalColumns: columnsResult.rows.length,
        foreignKeyCount: relations.length,
        geometryColumns: geometryColumns.length
      }
    });

  } catch (error) {
    console.error('[Databases] Schema extraction error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Convertit une question en langage naturel en SQL
 * POST /api/databases/text-to-sql
 */
app.post('/api/databases/text-to-sql', async (req, res) => {
  try {
    const { connectionId, query, includeExplanation = true } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query required' });
    }

    // Récupérer le schéma de la base pour le contexte
    let schemaContext = '';
    if (connectionId) {
      try {
        // S'assurer qu'on est connecté
        await connections.connect(connectionId);

        // Récupérer un résumé du schéma
        const schemaQuery = `
          SELECT
            t.table_schema || '.' || t.table_name as table_name,
            string_agg(c.column_name || ' ' || c.udt_name, ', ' ORDER BY c.ordinal_position) as columns
          FROM information_schema.tables t
          JOIN information_schema.columns c
            ON t.table_schema = c.table_schema AND t.table_name = c.table_name
          WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
            AND t.table_type = 'BASE TABLE'
          GROUP BY t.table_schema, t.table_name
          ORDER BY t.table_schema, t.table_name
          LIMIT 50
        `;
        const schemaResult = await connections.executeSQL(connectionId, schemaQuery);

        schemaContext = schemaResult.rows.map(r =>
          `Table ${r.table_name}: ${r.columns}`
        ).join('\n');
      } catch (e) {
        console.warn('[Text-to-SQL] Could not fetch schema:', e.message);
      }
    }

    // Construire le prompt pour Claude
    const systemPrompt = `Tu es un expert PostgreSQL/PostGIS. Tu convertis les questions en langage naturel en requêtes SQL optimisées.

RÈGLES:
- Génère UNIQUEMENT des requêtes SELECT (jamais INSERT, UPDATE, DELETE, DROP, etc.)
- Utilise les alias de tables pour la lisibilité
- Pour les requêtes spatiales PostGIS, utilise le SRID 2056 (CH1903+/LV95) par défaut
- Limite les résultats à 1000 lignes maximum avec LIMIT
- Utilise des noms de colonnes explicites (pas de SELECT *)

${schemaContext ? `SCHÉMA DE LA BASE:\n${schemaContext}` : ''}

Réponds en JSON avec le format:
{
  "sql": "la requête SQL",
  "explanation": "explication en français de ce que fait la requête",
  "tables": ["liste", "des", "tables", "utilisées"],
  "confidence": 0.0 à 1.0
}`;

    // Appeler Claude pour la génération
    const auth = await getClaudeAuth();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': auth.key || auth.token
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          { role: 'user', content: query }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text || '';

    // Parser la réponse JSON
    let result;
    try {
      // Extraire le JSON de la réponse (peut être entouré de markdown)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (e) {
      // Fallback: utiliser le contenu comme SQL direct
      result = {
        sql: content.replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim(),
        explanation: 'Requête générée',
        tables: [],
        confidence: 0.5
      };
    }

    res.json({
      success: true,
      sql: result.sql,
      explanation: includeExplanation ? result.explanation : null,
      tables: result.tables || [],
      confidence: result.confidence || 0.8,
      model: 'claude-3-5-haiku-20241022'
    });

  } catch (error) {
    console.error('[Text-to-SQL] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Récupère les statistiques d'une table
 * GET /api/databases/:connectionId/tables/:tableName/stats
 */
app.get('/api/databases/:connectionId/tables/:tableName/stats', async (req, res) => {
  try {
    const { connectionId, tableName } = req.params;

    // Vérifier la connexion
    const conn = connections.getConnection(connectionId);
    if (!conn || conn.type !== 'postgresql') {
      return res.status(400).json({ error: 'Connexion PostgreSQL non trouvée' });
    }

    await connections.connect(connectionId);

    // Séparer schema.table si fourni
    let schema = 'public';
    let table = tableName;
    if (tableName.includes('.')) {
      [schema, table] = tableName.split('.');
    }

    // Récupérer les stats
    const statsQuery = `
      SELECT
        relname as table_name,
        n_live_tup as row_count,
        n_dead_tup as dead_rows,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        pg_total_relation_size('${schema}.${table}'::regclass) as total_size,
        pg_table_size('${schema}.${table}'::regclass) as table_size,
        pg_indexes_size('${schema}.${table}'::regclass) as indexes_size
      FROM pg_stat_user_tables
      WHERE schemaname = '${schema}' AND relname = '${table}'
    `;

    const result = await connections.executeSQL(connectionId, statsQuery);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Table non trouvée' });
    }

    const stats = result.rows[0];

    res.json({
      success: true,
      table: `${schema}.${table}`,
      stats: {
        rowCount: parseInt(stats.row_count),
        deadRows: parseInt(stats.dead_rows),
        totalSize: parseInt(stats.total_size),
        tableSize: parseInt(stats.table_size),
        indexesSize: parseInt(stats.indexes_size),
        lastVacuum: stats.last_vacuum,
        lastAutoVacuum: stats.last_autovacuum,
        lastAnalyze: stats.last_analyze
      }
    });

  } catch (error) {
    console.error('[Databases] Table stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Récupère un échantillon de données d'une table
 * GET /api/databases/:connectionId/tables/:tableName/sample
 */
app.get('/api/databases/:connectionId/tables/:tableName/sample', async (req, res) => {
  try {
    const { connectionId, tableName } = req.params;
    const { limit = 10 } = req.query;

    const conn = connections.getConnection(connectionId);
    if (!conn || conn.type !== 'postgresql') {
      return res.status(400).json({ error: 'Connexion PostgreSQL non trouvée' });
    }

    await connections.connect(connectionId);

    // Séparer schema.table
    let schema = 'public';
    let table = tableName;
    if (tableName.includes('.')) {
      [schema, table] = tableName.split('.');
    }

    // Requête avec limite de sécurité
    const sampleLimit = Math.min(parseInt(limit), 100);
    const sampleQuery = `SELECT * FROM "${schema}"."${table}" LIMIT ${sampleLimit}`;

    const result = await connections.executeSQL(connectionId, sampleQuery);

    res.json({
      success: true,
      table: `${schema}.${table}`,
      rowCount: result.rowCount,
      rows: result.rows,
      fields: result.fields
    });

  } catch (error) {
    console.error('[Databases] Sample data error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MVT TILES ENDPOINTS (Vector Tiles)
// ============================================

// Liste des tables géométriques
app.get('/api/databases/:connectionId/geotables', async (req, res) => {
  const { connectionId } = req.params;

  try {
    // S'assurer que la connexion est active
    await connections.connect(connectionId);
    const tables = await mvtTiles.getGeometryTables(connectionId);
    res.json({
      success: true,
      tables,
      count: tables.length
    });
  } catch (error) {
    console.error('[MVT] Erreur geotables:', error);
    res.status(500).json({ error: error.message });
  }
});

// Extent (bbox) d'une table
app.get('/api/databases/:connectionId/extent/:schema/:table', async (req, res) => {
  const { connectionId, schema, table } = req.params;

  try {
    // S'assurer que la connexion est active
    await connections.connect(connectionId);
    const extent = await mvtTiles.getTableExtent(connectionId, schema, table);
    res.json({
      success: true,
      extent
    });
  } catch (error) {
    console.error('[MVT] Erreur extent:', error);
    res.status(500).json({ error: error.message });
  }
});

// Tuile MVT
app.get('/api/databases/:connectionId/tiles/:schema/:table/:z/:x/:y.mvt', async (req, res) => {
  const { connectionId, schema, table, z, x, y } = req.params;

  try {
    // S'assurer que la connexion est active
    await connections.connect(connectionId);
    const tile = await mvtTiles.getTile(
      connectionId,
      schema,
      table,
      parseInt(z),
      parseInt(x),
      parseInt(y)
    );

    // Headers MVT
    res.setHeader('Content-Type', 'application/x-protobuf');
    res.setHeader('Content-Encoding', 'identity');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (tile.length === 0) {
      res.status(204).end();
    } else {
      res.send(tile);
    }
  } catch (error) {
    console.error(`[MVT] Erreur tile ${schema}.${table}/${z}/${x}/${y}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// GeoJSON endpoint for layer data (supports bbox filter)
app.get('/api/databases/:connectionId/geojson/:schema/:table', async (req, res) => {
  const { connectionId, schema, table } = req.params;
  const { bbox, limit = 5000 } = req.query;

  try {
    await connections.connect(connectionId);

    // Get geometry column info
    const geoColQuery = `
      SELECT f_geometry_column, srid
      FROM geometry_columns
      WHERE f_table_schema = '${schema}' AND f_table_name = '${table}'
      LIMIT 1
    `;
    const geoResult = await connections.executeSQL(connectionId, geoColQuery);

    if (geoResult.rows.length === 0) {
      return res.status(404).json({ error: `Table ${schema}.${table} has no geometry column` });
    }

    const geomCol = geoResult.rows[0].f_geometry_column;
    const srid = geoResult.rows[0].srid;

    // Build bbox filter if provided (expected format: minX,minY,maxX,maxY in table SRID)
    let bboxFilter = '';
    if (bbox) {
      const [minX, minY, maxX, maxY] = bbox.split(',').map(Number);
      bboxFilter = `AND ST_Intersects("${geomCol}", ST_MakeEnvelope(${minX}, ${minY}, ${maxX}, ${maxY}, ${srid}))`;
    }

    // Get attributes (limit to 15)
    const attrQuery = `
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = '${schema}' AND table_name = '${table}'
        AND udt_name NOT IN ('geometry', 'geography')
      ORDER BY ordinal_position LIMIT 15
    `;
    const attrResult = await connections.executeSQL(connectionId, attrQuery);
    const attrs = attrResult.rows.map(r => `"${r.column_name}"`).join(', ');
    const propsSelect = attrs ? `, ${attrs}` : '';

    // Query features as GeoJSON
    const query = `
      SELECT jsonb_build_object(
        'type', 'FeatureCollection',
        'crs', jsonb_build_object('type', 'name', 'properties', jsonb_build_object('name', 'EPSG:${srid}')),
        'features', COALESCE(jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON("${geomCol}")::jsonb,
            'properties', to_jsonb(t) - '${geomCol}'
          )
        ), '[]'::jsonb)
      ) as geojson
      FROM (
        SELECT "${geomCol}" ${propsSelect}
        FROM "${schema}"."${table}"
        WHERE "${geomCol}" IS NOT NULL ${bboxFilter}
        LIMIT ${parseInt(limit)}
      ) t
    `;

    const result = await connections.executeSQL(connectionId, query);
    const geojson = result.rows[0]?.geojson || { type: 'FeatureCollection', features: [] };

    res.setHeader('Content-Type', 'application/geo+json');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(geojson);

  } catch (error) {
    console.error(`[GeoJSON] Error ${schema}.${table}:`, error.message);
    res.status(500).json({ error: error.message });
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
    if (global.geomindServer) {
      global.geomindServer.close(() => {
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
// DEFAULT CONNECTIONS INITIALIZATION
// ============================================

/**
 * Initialise les connexions par défaut si elles n'existent pas
 */
function initDefaultConnections() {
  const existingConnections = connections.listConnections();

  // Connexion SDOL par défaut
  const sdolExists = existingConnections.some(c =>
    c.host === 'postgres.hkd-geomatique.com' && c.database === 'sdol'
  );

  if (!sdolExists) {
    console.log('[Init] Ajout de la connexion SDOL par défaut...');
    try {
      connections.addConnection({
        name: 'SDOL PostgreSQL',
        type: 'postgresql',
        host: 'postgres.hkd-geomatique.com',
        port: 5432,
        database: 'sdol',
        username: 'by_lgr',
        password: 'H5$HrjTg&f',
        ssl: false
      });
      console.log('[Init] ✅ Connexion SDOL ajoutée');
    } catch (error) {
      console.error('[Init] ❌ Erreur ajout connexion SDOL:', error.message);
    }
  }
}

// ============================================
// VPN (FORTICLIENT) API
// ============================================

const FORTICLIENT_PATH = 'C:\\Program Files\\Fortinet\\FortiClient';
const FORTICLIENT_CONSOLE = `"${FORTICLIENT_PATH}\\FortiClient.exe"`;

// Get VPN connection status
app.get('/api/vpn/status', async (req, res) => {
  try {
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Check if FortiClient process is running
    const { stdout: taskList } = await execAsync('tasklist /FI "IMAGENAME eq FortiTray.exe" /NH', { encoding: 'utf8' });
    const fortiClientRunning = taskList.toLowerCase().includes('fortitray.exe');

    // Check network interfaces for FortiClient VPN
    const { stdout: ipconfig } = await execAsync('ipconfig', { encoding: 'utf8' });

    // Try to get more details from FortiClient
    let vpnName = null;
    let vpnIp = null;
    let vpnConnected = false;

    // Method 1: Check for VPN IP range 10.200.200.x (Bussigny VPN specific)
    const vpnIpMatch = ipconfig.match(/IPv4[^:]*:\s*(10\.200\.200\.\d+)/i);
    if (vpnIpMatch) {
      vpnConnected = true;
      vpnIp = vpnIpMatch[1];
      vpnName = 'Bussigny VPN';
    }

    // Method 2: Fallback to check for fortissl adapter name
    if (!vpnConnected) {
      if (ipconfig.includes('fortissl') || ipconfig.includes('FortiClient')) {
        vpnConnected = true;
        const fortiMatch = ipconfig.match(/fortissl[\s\S]*?IPv4[^:]*:\s*([\d.]+)/i);
        if (fortiMatch) {
          vpnIp = fortiMatch[1];
        }
        vpnName = 'FortiClient SSL VPN';
      }
    }

    res.json({
      success: true,
      status: {
        fortiClientInstalled: existsSync(FORTICLIENT_PATH),
        fortiClientRunning,
        vpnConnected,
        vpnName,
        vpnIp
      }
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      status: {
        fortiClientInstalled: existsSync(FORTICLIENT_PATH),
        fortiClientRunning: false,
        vpnConnected: false
      }
    });
  }
});

// Connect to VPN - Opens FortiTray for manual connection
// Note: FortiClient EMS-managed installations don't support CLI connect
app.post('/api/vpn/connect', async (req, res) => {
  try {
    // Open FortiTray - user will need to connect manually
    exec(FORTICLIENT_CONSOLE, { encoding: 'utf8' }, (error) => {
      if (error) {
        console.log('[VPN] Launch error:', error.message);
      }
    });

    res.json({
      success: true,
      message: 'FortiClient ouvert - Connectez-vous manuellement via l\'interface',
      manual: true
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Disconnect VPN - Opens FortiTray for manual disconnection
app.post('/api/vpn/disconnect', async (req, res) => {
  try {
    // Open FortiTray - user will need to disconnect manually
    exec(FORTICLIENT_CONSOLE, { encoding: 'utf8' }, (error) => {
      if (error) {
        console.log('[VPN] Launch error:', error.message);
      }
    });

    res.json({
      success: true,
      message: 'FortiClient ouvert - Déconnectez-vous manuellement via l\'interface',
      manual: true
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Launch FortiClient Console GUI
app.post('/api/vpn/launch', async (req, res) => {
  try {
    // Launch FortiClient Console (non-blocking)
    exec(FORTICLIENT_CONSOLE, { encoding: 'utf8' }, (error) => {
      if (error) {
        console.log('[VPN] Launch error:', error.message);
      }
    });

    res.json({
      success: true,
      message: 'FortiClient Console lancé'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get saved VPN profiles (if accessible)
app.get('/api/vpn/profiles', async (req, res) => {
  try {
    // FortiClient stores profiles in registry or config files
    // This is a simplified version - actual implementation may vary
    const profiles = [
      { name: 'VPN Commune', server: 'vpn.bussigny.ch', default: true },
    ];

    res.json({
      success: true,
      profiles
    });
  } catch (error) {
    res.json({
      success: true,
      profiles: [],
      warning: 'Impossible de lire les profils VPN'
    });
  }
});

// ============================================
// KDRIVE API PROXY
// ============================================

const KDRIVE_API_BASE = 'https://api.infomaniak.com/2/drive';

// Get saved kDrive config (from server-side file, not exposed in frontend code)
app.get('/api/kdrive/config', (req, res) => {
  try {
    const configPath = join(__dirname, 'config', 'kdrive.json');
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, 'utf8'));
      res.json({ success: true, config });
    } else {
      res.json({ success: false, error: 'No config found' });
    }
  } catch (error) {
    console.error('[kDrive] Config error:', error);
    res.json({ success: false, error: error.message });
  }
});

// Save kDrive config (server-side)
app.post('/api/kdrive/config', express.json(), (req, res) => {
  try {
    const configDir = join(__dirname, 'config');
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }
    const configPath = join(configDir, 'kdrive.json');
    writeFileSync(configPath, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('[kDrive] Save config error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Proxy: Upload file (new endpoint format)
app.post('/api/kdrive/:driveId/upload', express.raw({ type: '*/*', limit: '100mb' }), async (req, res) => {
  const { driveId } = req.params;
  const { directory_id, file_name, total_size } = req.query;
  const authHeader = req.headers.authorization;
  const contentType = req.headers['content-type'];

  if (!authHeader) {
    return res.status(401).json({ success: false, error: 'Authorization header required' });
  }

  if (!file_name) {
    return res.status(400).json({ success: false, error: 'file_name query parameter required' });
  }

  try {
    // Try API v3 first, then v2
    const baseUrls = [
      `https://api.infomaniak.com/3/drive/${driveId}/upload`,
      `https://api.infomaniak.com/2/drive/${driveId}/upload`
    ];

    let lastError = null;
    for (const baseUrl of baseUrls) {
      const params = new URLSearchParams();
      if (directory_id) params.append('directory_id', directory_id);
      params.append('file_name', file_name);
      if (total_size) params.append('total_size', total_size);

      const url = `${baseUrl}?${params.toString()}`;
      console.log(`[kDrive] Trying upload to: ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': contentType || 'application/octet-stream'
        },
        body: req.body
      });

      const data = await response.json();

      if (response.ok || (data.result === 'success')) {
        console.log(`[kDrive] Upload successful via ${baseUrl}`);
        return res.status(response.status).json(data);
      }

      lastError = { status: response.status, data };
      console.log(`[kDrive] Upload failed on ${baseUrl}:`, response.status, data.error?.code);
    }

    // All attempts failed
    console.error('[kDrive] All upload attempts failed:', lastError);
    res.status(lastError?.status || 500).json(lastError?.data || { success: false, error: 'Upload failed' });
  } catch (error) {
    console.error('[kDrive] Upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Proxy: List files in drive root or folder
app.get('/api/kdrive/:driveId/files/:folderId?', async (req, res) => {
  const { driveId, folderId } = req.params;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ success: false, error: 'Authorization header required' });
  }

  try {
    const url = folderId && folderId !== '1'
      ? `${KDRIVE_API_BASE}/${driveId}/files/${folderId}/files`
      : `${KDRIVE_API_BASE}/${driveId}/files`;

    const response = await fetch(url, {
      headers: { 'Authorization': authHeader }
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('[kDrive] Proxy error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Proxy: Upload file to folder
app.post('/api/kdrive/:driveId/files/:folderId/upload', express.raw({ type: '*/*', limit: '100mb' }), async (req, res) => {
  const { driveId, folderId } = req.params;
  const authHeader = req.headers.authorization;
  const contentType = req.headers['content-type'];
  const fileName = req.query.file_name;

  if (!authHeader) {
    return res.status(401).json({ success: false, error: 'Authorization header required' });
  }

  if (!fileName) {
    return res.status(400).json({ success: false, error: 'file_name query parameter required' });
  }

  try {
    // Build URL with file_name query param for Infomaniak API
    const url = `${KDRIVE_API_BASE}/${driveId}/files/${folderId}/upload?file_name=${encodeURIComponent(fileName)}`;

    console.log(`[kDrive] Uploading ${fileName} to folder ${folderId}, size: ${req.body?.length || 0} bytes`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': contentType || 'application/octet-stream'
      },
      body: req.body
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[kDrive] Upload failed:', response.status, data);
    }

    res.status(response.status).json(data);
  } catch (error) {
    console.error('[kDrive] Upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Proxy: Create share link
app.post('/api/kdrive/:driveId/files/:fileId/link', async (req, res) => {
  const { driveId, fileId } = req.params;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ success: false, error: 'Authorization header required' });
  }

  try {
    const url = `${KDRIVE_API_BASE}/${driveId}/files/${fileId}/link`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('[kDrive] Share link error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DWG CONVERSION (ODA FILE CONVERTER)
// ============================================

const ODA_PATHS = [
  'C:\\Program Files\\ODA\\ODAFileConverter\\ODAFileConverter.exe',
  'C:\\Program Files (x86)\\ODA\\ODAFileConverter\\ODAFileConverter.exe',
  join(homedir(), 'ODAFileConverter', 'ODAFileConverter.exe'),
];

function findOdaConverter() {
  for (const p of ODA_PATHS) {
    if (existsSync(p)) return p;
  }
  return null;
}

// Check ODA status
app.get('/api/dwg/status', (req, res) => {
  const odaPath = findOdaConverter();
  res.json({
    odaInstalled: !!odaPath,
    odaPath: odaPath,
    downloadUrl: 'https://www.opendesign.com/guestfiles/oda_file_converter'
  });
});

// Convert DWG to GeoJSON
app.post('/api/dwg/convert', async (req, res) => {
  const odaPath = findOdaConverter();

  if (!odaPath) {
    return res.status(400).json({
      success: false,
      error: 'ODA File Converter non installé',
      downloadUrl: 'https://www.opendesign.com/guestfiles/oda_file_converter',
      instructions: 'Téléchargez et installez ODA File Converter (gratuit) puis réessayez.'
    });
  }

  try {
    const { filename, content } = req.body; // content is base64

    if (!content) {
      return res.status(400).json({ success: false, error: 'Contenu manquant' });
    }

    // Create temp directories
    const tempDir = join(homedir(), '.geomind', 'temp');
    const inputDir = join(tempDir, 'dwg_input');
    const outputDir = join(tempDir, 'dwg_output');

    await mkdir(inputDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });

    // Clean output dir
    const existingFiles = await readdir(outputDir).catch(() => []);
    for (const f of existingFiles) {
      await import('fs/promises').then(fs => fs.unlink(join(outputDir, f))).catch(() => {});
    }

    // Save DWG file
    const dwgBuffer = Buffer.from(content, 'base64');
    const inputFile = join(inputDir, filename || 'input.dwg');
    await writeFile(inputFile, dwgBuffer);

    // Run ODA converter: ODAFileConverter "inputDir" "outputDir" ACAD2018 DXF 0 1 "*.DWG"
    const odaCmd = `"${odaPath}" "${inputDir}" "${outputDir}" ACAD2018 DXF 0 1 "*.DWG"`;

    await new Promise((resolve, reject) => {
      exec(odaCmd, { timeout: 60000 }, (error, stdout, stderr) => {
        if (error && !stdout.includes('Audit')) {
          reject(new Error(`ODA conversion failed: ${error.message}`));
        } else {
          resolve(stdout);
        }
      });
    });

    // Find output DXF file
    const outputFiles = await readdir(outputDir);
    const dxfFile = outputFiles.find(f => f.toLowerCase().endsWith('.dxf'));

    if (!dxfFile) {
      return res.status(500).json({
        success: false,
        error: 'Conversion DWG→DXF échouée, aucun fichier DXF généré'
      });
    }

    // Read DXF content
    const dxfContent = await readFile(join(outputDir, dxfFile), 'utf-8');

    // Convert DXF to GeoJSON (inline parser)
    const geojson = parseDxfToGeoJson(dxfContent);

    // Cleanup
    await import('fs/promises').then(fs => fs.unlink(inputFile)).catch(() => {});
    await import('fs/promises').then(fs => fs.unlink(join(outputDir, dxfFile))).catch(() => {});

    res.json({
      success: true,
      geojson,
      filename: (filename || 'drawing').replace(/\.dwg$/i, '.geojson'),
      entityCount: geojson.features?.length || 0
    });

  } catch (error) {
    console.error('DWG conversion error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur de conversion DWG'
    });
  }
});

// DXF to GeoJSON parser (server-side version)
function parseDxfToGeoJson(dxfContent) {
  const features = [];
  const lines = dxfContent.split('\n');
  let i = 0;
  let entityType = '';
  let currentEntity = {};
  let inEntities = false;

  while (i < lines.length) {
    const code = parseInt(lines[i]?.trim() || '0');
    const value = lines[i + 1]?.trim() || '';
    i += 2;

    if (code === 0 && value === 'SECTION') {
      const sectionCode = parseInt(lines[i]?.trim() || '0');
      const sectionName = lines[i + 1]?.trim() || '';
      if (sectionCode === 2) {
        inEntities = sectionName === 'ENTITIES';
      }
      i += 2;
      continue;
    }

    if (code === 0 && value === 'ENDSEC') {
      inEntities = false;
      continue;
    }

    if (!inEntities) continue;

    if (code === 0) {
      if (entityType && Object.keys(currentEntity).length > 0) {
        const feature = dxfEntityToFeature(entityType, currentEntity);
        if (feature) features.push(feature);
      }
      entityType = value;
      currentEntity = { layer: '0' };
      continue;
    }

    switch (code) {
      case 8: currentEntity.layer = value; break;
      case 10: currentEntity.x = parseFloat(value); break;
      case 20: currentEntity.y = parseFloat(value); break;
      case 11: currentEntity.x2 = parseFloat(value); break;
      case 21: currentEntity.y2 = parseFloat(value); break;
      case 40: currentEntity.radius = parseFloat(value); break;
      case 50: currentEntity.startAngle = parseFloat(value); break;
      case 51: currentEntity.endAngle = parseFloat(value); break;
      case 1: currentEntity.text = value; break;
      case 62: currentEntity.color = parseInt(value); break;
      case 90: currentEntity.vertexCount = parseInt(value); break;
      case 70: currentEntity.flags = parseInt(value); break;
    }

    if (entityType === 'LWPOLYLINE' && code === 10) {
      if (!currentEntity.vertices) currentEntity.vertices = [];
      currentEntity.vertices.push([parseFloat(value), 0]);
    }
    if (entityType === 'LWPOLYLINE' && code === 20) {
      if (currentEntity.vertices?.length > 0) {
        currentEntity.vertices[currentEntity.vertices.length - 1][1] = parseFloat(value);
      }
    }
  }

  if (entityType && Object.keys(currentEntity).length > 0) {
    const feature = dxfEntityToFeature(entityType, currentEntity);
    if (feature) features.push(feature);
  }

  return { type: 'FeatureCollection', features };
}

function dxfEntityToFeature(type, entity) {
  const props = { layer: entity.layer, color: entity.color, entityType: type };

  switch (type) {
    case 'POINT':
      if (entity.x !== undefined && entity.y !== undefined) {
        return { type: 'Feature', geometry: { type: 'Point', coordinates: [entity.x, entity.y] }, properties: props };
      }
      break;

    case 'LINE':
      if (entity.x !== undefined && entity.y !== undefined && entity.x2 !== undefined && entity.y2 !== undefined) {
        return { type: 'Feature', geometry: { type: 'LineString', coordinates: [[entity.x, entity.y], [entity.x2, entity.y2]] }, properties: props };
      }
      break;

    case 'LWPOLYLINE':
    case 'POLYLINE':
      if (entity.vertices?.length >= 2) {
        const isClosed = (entity.flags || 0) & 1;
        if (isClosed && entity.vertices.length >= 3) {
          const coords = [...entity.vertices];
          if (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1]) {
            coords.push([...coords[0]]);
          }
          return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: props };
        } else {
          return { type: 'Feature', geometry: { type: 'LineString', coordinates: entity.vertices }, properties: props };
        }
      }
      break;

    case 'CIRCLE':
      if (entity.x !== undefined && entity.y !== undefined && entity.radius) {
        const coords = [];
        for (let i = 0; i <= 32; i++) {
          const angle = (i / 32) * 2 * Math.PI;
          coords.push([entity.x + entity.radius * Math.cos(angle), entity.y + entity.radius * Math.sin(angle)]);
        }
        return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: { ...props, radius: entity.radius } };
      }
      break;

    case 'ARC':
      if (entity.x !== undefined && entity.y !== undefined && entity.radius) {
        const start = (entity.startAngle || 0) * Math.PI / 180;
        const end = (entity.endAngle || 360) * Math.PI / 180;
        const arcLength = end > start ? end - start : (2 * Math.PI - start + end);
        const segments = Math.max(8, Math.ceil(arcLength / (Math.PI / 16)));
        const coords = [];
        for (let i = 0; i <= segments; i++) {
          const angle = start + (i / segments) * arcLength;
          coords.push([entity.x + entity.radius * Math.cos(angle), entity.y + entity.radius * Math.sin(angle)]);
        }
        return { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: { ...props, radius: entity.radius } };
      }
      break;

    case 'TEXT':
    case 'MTEXT':
      if (entity.x !== undefined && entity.y !== undefined) {
        return { type: 'Feature', geometry: { type: 'Point', coordinates: [entity.x, entity.y] }, properties: { ...props, text: entity.text } };
      }
      break;
  }
  return null;
}

// ============================================
// PYQGIS GEOPROCESSING
// ============================================

import { createRequire } from 'module';
const requireCjs = createRequire(import.meta.url);
let pyqgisBridge = null;

// Lazy load pyqgis-bridge (CommonJS module)
function getPyqgisBridge() {
  if (!pyqgisBridge) {
    try {
      pyqgisBridge = requireCjs('./pyqgis-bridge.js');
    } catch (err) {
      console.error('[PyQGIS] Failed to load bridge:', err.message);
      return null;
    }
  }
  return pyqgisBridge;
}

// Get PyQGIS status
app.get('/api/pyqgis/status', async (req, res) => {
  const bridge = getPyqgisBridge();
  if (!bridge) {
    return res.json({
      available: false,
      error: 'PyQGIS bridge not loaded'
    });
  }

  try {
    const status = await bridge.getStatus();
    res.json(status);
  } catch (err) {
    res.json({
      available: false,
      error: err.message
    });
  }
});

// List available algorithms
app.get('/api/pyqgis/algorithms', async (req, res) => {
  const bridge = getPyqgisBridge();
  if (!bridge) {
    return res.status(500).json({ error: 'PyQGIS bridge not loaded' });
  }

  try {
    const algorithms = await bridge.listAlgorithms();
    res.json({ algorithms });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Install Python dependencies
app.post('/api/pyqgis/install', async (req, res) => {
  const bridge = getPyqgisBridge();
  if (!bridge) {
    return res.status(500).json({ error: 'PyQGIS bridge not loaded' });
  }

  try {
    const result = await bridge.installDependencies();
    res.json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Run geoprocessing algorithm
app.post('/api/pyqgis/process', async (req, res) => {
  const bridge = getPyqgisBridge();
  if (!bridge) {
    return res.status(500).json({ error: 'PyQGIS bridge not loaded' });
  }

  const { algorithm, params, inputGeoJSON } = req.body;

  if (!algorithm) {
    return res.status(400).json({ error: 'Algorithm name required' });
  }

  try {
    const result = await bridge.runAlgorithm(algorithm, params || {}, inputGeoJSON);
    res.json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ============================================
// STATS MODULE API
// ============================================

/**
 * GET /api/databases/:connectionId/schemas
 * Liste tous les schémas de la base de données
 */
app.get('/api/databases/:connectionId/schemas', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const conn = connections.getConnection(connectionId);
    if (!conn || conn.type !== 'postgresql') {
      return res.status(400).json({ error: 'Connexion PostgreSQL non trouvée' });
    }

    await connections.connect(connectionId);

    const query = `
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name
    `;
    const result = await connections.executeSQL(connectionId, query);
    res.json({ schemas: result.rows.map(r => r.schema_name) });
  } catch (error) {
    console.error('[Stats] Error loading schemas:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/databases/:connectionId/schema/:schema/tables
 * Liste les tables d'un schéma
 */
app.get('/api/databases/:connectionId/schema/:schema/tables', async (req, res) => {
  try {
    const { connectionId, schema } = req.params;
    const conn = connections.getConnection(connectionId);
    if (!conn || conn.type !== 'postgresql') {
      return res.status(400).json({ error: 'Connexion PostgreSQL non trouvée' });
    }

    await connections.connect(connectionId);

    // Échapper le schéma pour éviter injection SQL
    const safeSchema = schema.replace(/'/g, "''");
    const query = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = '${safeSchema}'
        AND table_type IN ('BASE TABLE', 'VIEW')
      ORDER BY table_name
    `;
    const result = await connections.executeSQL(connectionId, query);
    res.json({ tables: result.rows.map(r => r.table_name) });
  } catch (error) {
    console.error('[Stats] Error loading tables:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/databases/:connectionId/schema/:schema/table/:table/columns
 * Liste les colonnes d'une table
 */
app.get('/api/databases/:connectionId/schema/:schema/table/:table/columns', async (req, res) => {
  try {
    const { connectionId, schema, table } = req.params;
    const conn = connections.getConnection(connectionId);
    if (!conn || conn.type !== 'postgresql') {
      return res.status(400).json({ error: 'Connexion PostgreSQL non trouvée' });
    }

    await connections.connect(connectionId);

    // Échapper les valeurs pour éviter injection SQL
    const safeSchema = schema.replace(/'/g, "''");
    const safeTable = table.replace(/'/g, "''");
    const query = `
      SELECT column_name as name, data_type as type
      FROM information_schema.columns
      WHERE table_schema = '${safeSchema}' AND table_name = '${safeTable}'
      ORDER BY ordinal_position
    `;
    const result = await connections.executeSQL(connectionId, query);
    res.json({ columns: result.rows });
  } catch (error) {
    console.error('[Stats] Error loading columns:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/stats/assainissement/:connectionId
 * Statistiques pré-calculées pour l'assainissement
 */
app.get('/api/stats/assainissement/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const conn = connections.getConnection(connectionId);
    if (!conn || conn.type !== 'postgresql') {
      return res.status(400).json({ error: 'Connexion PostgreSQL non trouvée' });
    }

    await connections.connect(connectionId);

    // 1. KPIs principaux
    const kpisQuery = `
      SELECT
        COUNT(*) FILTER (WHERE proprietaire = 'Bussigny - Publique') as nb_collecteurs_publics,
        ROUND(SUM(ST_Length(geom)) FILTER (WHERE proprietaire = 'Bussigny - Publique')::numeric / 1000, 2) as km_collecteurs_publics,
        COUNT(DISTINCT CASE WHEN proprietaire = 'Bussigny - Publique' THEN genre_utilisation END) as nb_types
      FROM assainissement.by_ass_collecteur
    `;
    const kpisResult = await connections.executeSQL(connectionId, kpisQuery);
    const kpiRow = kpisResult.rows[0];

    // 2. Collecteurs par type d'eau
    const typeQuery = `
      SELECT
        COALESCE(genre_utilisation, 'Non renseigné') as type_eau,
        COUNT(*) as nb_troncons,
        ROUND(SUM(ST_Length(geom))::numeric / 1000, 2) as km
      FROM assainissement.by_ass_collecteur
      WHERE proprietaire = 'Bussigny - Publique'
      GROUP BY genre_utilisation
      ORDER BY km DESC
    `;
    const typeResult = await connections.executeSQL(connectionId, typeQuery);

    // 3. Collecteurs par état d'inspection
    const etatQuery = `
      SELECT
        COALESCE(etat_derniere_inspection, 'Non inspecté') as etat,
        COUNT(*) as nb,
        ROUND(SUM(ST_Length(geom))::numeric / 1000, 2) as km
      FROM assainissement.v_ass_collecteur_inspection
      WHERE proprietaire = 'Bussigny - Publique'
      GROUP BY etat_derniere_inspection, id_etat_derniere_inspection
      ORDER BY COALESCE(id_etat_derniere_inspection, 99)
    `;
    let etatResult = { rows: [] };
    try {
      etatResult = await connections.executeSQL(connectionId, etatQuery);
    } catch (e) {
      console.log('[Stats] Vue inspection non disponible:', e.message);
    }

    // 4. Chambres par genre
    const chambresQuery = `
      SELECT
        COALESCE(genre_chambre, 'Non renseigné') as type,
        COUNT(*) as nb
      FROM assainissement.by_ass_chambre
      WHERE proprietaire LIKE '%Bussigny%'
      GROUP BY genre_chambre
      ORDER BY nb DESC
      LIMIT 10
    `;
    let chambresResult = { rows: [] };
    try {
      chambresResult = await connections.executeSQL(connectionId, chambresQuery);
    } catch (e) {
      console.log('[Stats] Table chambres non disponible:', e.message);
    }

    // Construire la réponse
    const kpis = [
      {
        label: 'Collecteurs publics',
        value: parseInt(kpiRow.nb_collecteurs_publics) || 0,
        unit: 'tronçons'
      },
      {
        label: 'Linéaire total',
        value: parseFloat(kpiRow.km_collecteurs_publics) || 0,
        unit: 'km'
      },
      {
        label: 'Types de réseau',
        value: parseInt(kpiRow.nb_types) || 0,
        unit: 'types'
      }
    ];

    const collecteursParType = {
      labels: typeResult.rows.map(r => r.type_eau),
      datasets: [{
        label: 'Kilomètres',
        data: typeResult.rows.map(r => parseFloat(r.km))
      }]
    };

    const collecteursParEtat = {
      labels: etatResult.rows.map(r => r.etat),
      datasets: [{
        label: 'Kilomètres',
        data: etatResult.rows.map(r => parseFloat(r.km))
      }]
    };

    const chambresParType = {
      labels: chambresResult.rows.map(r => r.type),
      datasets: [{
        label: 'Nombre',
        data: chambresResult.rows.map(r => parseInt(r.nb))
      }]
    };

    res.json({
      kpis,
      collecteursParType,
      collecteursParEtat,
      chambresParType,
      rawData: {
        types: typeResult.rows,
        etats: etatResult.rows,
        chambres: chambresResult.rows
      }
    });

  } catch (error) {
    console.error('[Stats] Error loading assainissement stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/stats/cadastre/:connectionId
 * Statistiques pré-calculées pour le cadastre
 */
app.get('/api/stats/cadastre/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const conn = connections.getConnection(connectionId);
    if (!conn || conn.type !== 'postgresql') {
      return res.status(400).json({ error: 'Connexion PostgreSQL non trouvée' });
    }

    await connections.connect(connectionId);

    // 1. KPIs principaux
    const kpisQuery = `
      SELECT
        COUNT(*) as nb_parcelles,
        ROUND(SUM(ST_Area(geom))::numeric, 0) as surface_totale_m2,
        COUNT(DISTINCT proprietaire) as nb_proprietaires
      FROM bdco.parcelles
    `;
    let kpisResult = { rows: [{}] };
    try {
      kpisResult = await connections.executeSQL(connectionId, kpisQuery);
    } catch (e) {
      console.log('[Stats] Table parcelles non disponible:', e.message);
    }
    const kpiRow = kpisResult.rows[0] || {};

    // 2. Parcelles par type
    const typeQuery = `
      SELECT
        COALESCE(type_propriete, 'Non renseigné') as type,
        COUNT(*) as nb_parcelles,
        ROUND(SUM(ST_Area(geom))::numeric, 0) as surface_m2
      FROM bdco.parcelles
      GROUP BY type_propriete
      ORDER BY surface_m2 DESC
      LIMIT 10
    `;
    let typeResult = { rows: [] };
    try {
      typeResult = await connections.executeSQL(connectionId, typeQuery);
    } catch (e) {
      console.log('[Stats] Statistiques parcelles non disponibles:', e.message);
    }

    // 3. Surfaces par propriétaire (top 10)
    const propQuery = `
      SELECT
        COALESCE(proprietaire, 'Non renseigné') as proprietaire,
        COUNT(*) as nb_parcelles,
        ROUND(SUM(ST_Area(geom))::numeric, 0) as surface_m2
      FROM bdco.parcelles
      GROUP BY proprietaire
      ORDER BY surface_m2 DESC
      LIMIT 10
    `;
    let propResult = { rows: [] };
    try {
      propResult = await connections.executeSQL(connectionId, propQuery);
    } catch (e) {
      console.log('[Stats] Statistiques propriétaires non disponibles:', e.message);
    }

    // Construire la réponse
    const kpis = [
      {
        label: 'Parcelles',
        value: parseInt(kpiRow.nb_parcelles) || 0,
        unit: ''
      },
      {
        label: 'Surface totale',
        value: Math.round((parseFloat(kpiRow.surface_totale_m2) || 0) / 10000),
        unit: 'ha'
      },
      {
        label: 'Propriétaires',
        value: parseInt(kpiRow.nb_proprietaires) || 0,
        unit: ''
      }
    ];

    const parcellesParType = typeResult.rows.length > 0 ? {
      labels: typeResult.rows.map(r => r.type),
      datasets: [{
        label: 'Parcelles',
        data: typeResult.rows.map(r => parseInt(r.nb_parcelles))
      }]
    } : null;

    const surfacesParProprietaire = propResult.rows.length > 0 ? {
      labels: propResult.rows.map(r => r.proprietaire?.substring(0, 20) || 'N/A'),
      datasets: [{
        label: 'Surface (m²)',
        data: propResult.rows.map(r => parseInt(r.surface_m2))
      }]
    } : null;

    res.json({
      kpis,
      parcellesParType,
      surfacesParProprietaire,
      rawData: {
        types: typeResult.rows,
        proprietaires: propResult.rows
      }
    });

  } catch (error) {
    console.error('[Stats] Error loading cadastre stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/stats/query
 * Requête statistique ad-hoc (onglet Général)
 */
app.post('/api/stats/query', async (req, res) => {
  try {
    const { connectionId, schema, table, groupBy, aggregation, aggregationColumn } = req.body;

    if (!connectionId || !schema || !table || !groupBy) {
      return res.status(400).json({ error: 'Paramètres manquants' });
    }

    const conn = connections.getConnection(connectionId);
    if (!conn || conn.type !== 'postgresql') {
      return res.status(400).json({ error: 'Connexion PostgreSQL non trouvée' });
    }

    await connections.connect(connectionId);

    // Construire la requête selon l'agrégation
    let aggExpression;
    let valueColumn = 'valeur';
    switch (aggregation) {
      case 'SUM':
        if (!aggregationColumn) {
          return res.status(400).json({ error: 'Colonne requise pour SUM' });
        }
        aggExpression = `SUM("${aggregationColumn}")`;
        valueColumn = `sum_${aggregationColumn}`;
        break;
      case 'AVG':
        if (!aggregationColumn) {
          return res.status(400).json({ error: 'Colonne requise pour AVG' });
        }
        aggExpression = `ROUND(AVG("${aggregationColumn}")::numeric, 2)`;
        valueColumn = `avg_${aggregationColumn}`;
        break;
      default:
        aggExpression = 'COUNT(*)';
        valueColumn = 'count';
    }

    const query = `
      SELECT
        COALESCE("${groupBy}"::text, 'Non renseigné') as "${groupBy}",
        ${aggExpression} as "${valueColumn}"
      FROM "${schema}"."${table}"
      GROUP BY "${groupBy}"
      ORDER BY "${valueColumn}" DESC
      LIMIT 20
    `;

    const result = await connections.executeSQL(connectionId, query);

    // Construire les données pour le graphique
    const chartData = {
      labels: result.rows.map(r => String(r[groupBy])?.substring(0, 30) || 'N/A'),
      datasets: [{
        label: valueColumn,
        data: result.rows.map(r => parseFloat(r[valueColumn]) || 0)
      }]
    };

    res.json({
      results: result.rows,
      columns: [groupBy, valueColumn],
      chartData
    });

  } catch (error) {
    console.error('[Stats] Error executing query:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// START SERVER
// ============================================

// Fonction de démarrage avec nettoyage du port
async function startServer() {
  // Initialiser les connexions par défaut
  initDefaultConnections();
  // D'abord, libérer le port si occupé
  await killProcessOnPort(PORT);

  const server = app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║          GeoMind Backend Server            ║
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
  global.geomindServer = server;
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
