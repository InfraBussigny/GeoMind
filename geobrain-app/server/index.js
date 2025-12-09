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
import memory from './memory.js';
import geoportalProxy from './geoportal-proxy.js';

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
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', default: true },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
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
  }
};

// ============================================
// API ROUTES
// ============================================

// Get available providers and their status
app.get('/api/providers', async (req, res) => {
  const claudeCredentials = await getClaudeCredentials();
  const config = await getGeoBrainConfig();

  const providers = Object.entries(PROVIDERS).map(([id, provider]) => {
    let isConfigured = false;
    let authMethod = null;

    if (id === 'claude' && claudeCredentials?.claudeAiOauth) {
      isConfigured = true;
      authMethod = 'Claude Code OAuth';
    } else if (config.providers?.[id]?.apiKey) {
      isConfigured = true;
      authMethod = 'API Key';
    }

    return {
      id,
      ...provider,
      isConfigured,
      authMethod
    };
  });

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
// CLAUDE API IMPLEMENTATION
// ============================================

async function getClaudeAuth() {
  const credentials = await getClaudeCredentials();
  if (credentials?.claudeAiOauth) {
    return {
      type: 'oauth',
      token: credentials.claudeAiOauth.accessToken,
      refreshToken: credentials.claudeAiOauth.refreshToken,
      expiresAt: credentials.claudeAiOauth.expiresAt
    };
  }

  const config = await getGeoBrainConfig();
  if (config.providers?.claude?.apiKey) {
    return {
      type: 'apikey',
      key: config.providers.claude.apiKey
    };
  }

  throw new Error('Claude not configured. Please run "claude login" or add an API key.');
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
// FILE SYSTEM TOOLS
// ============================================

app.post('/api/tools/read-file', async (req, res) => {
  try {
    const { path } = req.body;
    const content = await readFile(path, 'utf-8');
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tools/write-file', async (req, res) => {
  try {
    const { path, content } = req.body;
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

app.post('/api/tools/execute-command', async (req, res) => {
  try {
    const { command, cwd } = req.body;
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
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║         GeoBrain Backend Server            ║
║════════════════════════════════════════════║
║  Running on: http://localhost:${PORT}         ║
║  Press Ctrl+C to stop                      ║
╚════════════════════════════════════════════╝
  `);
});
