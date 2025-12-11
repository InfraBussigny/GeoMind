/**
 * Ollama Agent - Système d'outils pour modèles locaux
 * Permet aux modèles Ollama d'utiliser les mêmes outils que Claude
 */

import { TOOL_DEFINITIONS, executeTool, AGENT_SYSTEM_PROMPT } from './tools.js';

// Configuration
const MAX_ITERATIONS = 10;
const OLLAMA_URL = 'http://localhost:11434';

/**
 * Génère le prompt système avec les outils disponibles pour Ollama
 */
function generateToolPrompt() {
  const toolDescriptions = TOOL_DEFINITIONS.map(tool => {
    const params = Object.entries(tool.input_schema.properties || {})
      .map(([name, prop]) => `    - ${name}: ${prop.description}${tool.input_schema.required?.includes(name) ? ' (requis)' : ' (optionnel)'}`)
      .join('\n');

    return `### ${tool.name}
${tool.description}
Paramètres:
${params || '    Aucun paramètre'}`;
  }).join('\n\n');

  return `${AGENT_SYSTEM_PROMPT}

## FORMAT D'APPEL D'OUTILS

Quand tu dois utiliser un outil, réponds EXACTEMENT dans ce format:

<tool_call>
{"name": "nom_outil", "input": {"param1": "valeur1", "param2": "valeur2"}}
</tool_call>

Tu peux appeler plusieurs outils en séquence. Après avoir reçu les résultats, continue ta réponse ou appelle un autre outil si nécessaire.

## OUTILS DISPONIBLES

${toolDescriptions}

## EXEMPLES D'APPELS

Pour compter les parcelles:
<tool_call>
{"name": "sql_query", "input": {"query": "SELECT COUNT(*) as total FROM bdco.bdco_parcelle"}}
</tool_call>

Pour lister les connexions:
<tool_call>
{"name": "list_db_connections", "input": {}}
</tool_call>

Pour lire un fichier:
<tool_call>
{"name": "read_file", "input": {"path": "C:\\\\Users\\\\zema\\\\GeoBrain\\\\memory\\\\context.md"}}
</tool_call>

## IMPORTANT
- Utilise TOUJOURS le format <tool_call>...</tool_call> pour appeler un outil
- N'invente JAMAIS de données - utilise les outils pour obtenir les vraies informations
- Après un appel d'outil, tu recevras le résultat entre <tool_result>...</tool_result>
- Analyse le résultat et formule ta réponse finale à l'utilisateur`;
}

/**
 * Parse la réponse pour extraire les appels d'outils
 */
function parseToolCalls(response) {
  const toolCalls = [];
  const regex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
  let match;

  while ((match = regex.exec(response)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.name && parsed.input !== undefined) {
        toolCalls.push({
          name: parsed.name,
          input: parsed.input,
          raw: match[0]
        });
      }
    } catch (e) {
      console.error('[Ollama Agent] Failed to parse tool call:', match[1], e.message);
    }
  }

  return toolCalls;
}

/**
 * Extrait le texte de réponse sans les appels d'outils
 */
function extractResponseText(response) {
  return response
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
    .replace(/<tool_result>[\s\S]*?<\/tool_result>/g, '')
    .trim();
}

/**
 * Appelle Ollama API
 */
async function callOllama(model, messages, baseUrl = OLLAMA_URL) {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: {
        temperature: 0.3, // Plus bas pour plus de précision avec les outils
        num_predict: 4096
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.message?.content || '';
}

/**
 * Agent principal avec boucle d'outils
 * @param {string} model - Modèle Ollama à utiliser
 * @param {Array} userMessages - Messages de la conversation
 * @param {Object} options - Options de configuration
 * @param {string} options.baseUrl - URL du serveur Ollama
 * @param {string} options.sharedContext - Contexte partagé (mémoire, personnalité, etc.)
 * @param {Function} options.onToolCall - Callback lors d'un appel d'outil
 * @param {Function} options.onToolResult - Callback lors d'un résultat d'outil
 */
export async function runOllamaAgent(model, userMessages, options = {}) {
  const { baseUrl = OLLAMA_URL, sharedContext = '', onToolCall, onToolResult, onChunk } = options;

  // Préparer les messages avec le system prompt ET le contexte partagé
  const toolPrompt = generateToolPrompt();

  // Combiner le contexte partagé avec le prompt des outils
  const fullSystemPrompt = sharedContext
    ? `${sharedContext}\n\n---\n\n${toolPrompt}`
    : toolPrompt;

  const messages = [
    { role: 'system', content: fullSystemPrompt },
    ...userMessages
  ];

  let iteration = 0;
  let finalResponse = '';
  const toolResults = [];

  while (iteration < MAX_ITERATIONS) {
    iteration++;
    console.log(`[Ollama Agent] Iteration ${iteration}`);

    // Appeler Ollama
    const response = await callOllama(model, messages, baseUrl);
    console.log(`[Ollama Agent] Response: ${response.slice(0, 200)}...`);

    // Parser les appels d'outils
    const toolCalls = parseToolCalls(response);

    if (toolCalls.length === 0) {
      // Pas d'appel d'outil = réponse finale
      finalResponse = response;
      break;
    }

    // Exécuter les outils
    const resultsText = [];

    for (const call of toolCalls) {
      console.log(`[Ollama Agent] Tool call: ${call.name}`, call.input);

      if (onToolCall) {
        onToolCall(call.name, call.input);
      }

      try {
        const result = await executeTool(call.name, call.input);
        console.log(`[Ollama Agent] Tool result:`, JSON.stringify(result).slice(0, 200));

        if (onToolResult) {
          onToolResult(call.name, result);
        }

        toolResults.push({ tool: call.name, result });
        resultsText.push(`<tool_result name="${call.name}">\n${JSON.stringify(result, null, 2)}\n</tool_result>`);
      } catch (error) {
        const errorResult = { success: false, error: error.message };
        toolResults.push({ tool: call.name, result: errorResult });
        resultsText.push(`<tool_result name="${call.name}">\n${JSON.stringify(errorResult)}\n</tool_result>`);
      }
    }

    // Ajouter la réponse du modèle et les résultats des outils au contexte
    messages.push({ role: 'assistant', content: response });
    messages.push({ role: 'user', content: `Résultats des outils:\n\n${resultsText.join('\n\n')}\n\nAnalyse ces résultats et fournis ta réponse à l'utilisateur.` });
  }

  // Extraire le texte final sans les balises d'outils
  const cleanResponse = extractResponseText(finalResponse);

  return {
    content: cleanResponse || finalResponse,
    toolCalls: toolResults,
    iterations: iteration,
    model
  };
}

/**
 * Endpoint simplifié pour le chat avec outils
 */
export async function chatWithTools(model, messages, baseUrl) {
  return runOllamaAgent(model, messages, { baseUrl });
}

export { generateToolPrompt, parseToolCalls };
