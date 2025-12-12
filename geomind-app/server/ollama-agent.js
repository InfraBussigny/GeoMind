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

## RÈGLE ABSOLUE - APPEL D'OUTILS

Tu as accès à des outils. Pour les utiliser, tu DOIS écrire EXACTEMENT ce format JSON entre balises:

<tool_call>
{"name": "sql_query", "input": {"query": "SELECT ..."}}
</tool_call>

**INTERDICTIONS:**
- NE DIS JAMAIS "je vais exécuter" sans inclure le <tool_call> dans ta réponse
- NE RÉPÈTE PAS la même phrase plusieurs fois
- NE DÉCRIS PAS ce que tu vas faire - FAIS-LE directement avec <tool_call>

**PROCESSUS:**
1. L'utilisateur pose une question
2. Tu écris IMMÉDIATEMENT le <tool_call> approprié (pas de bavardage avant)
3. Tu reçois le résultat dans <tool_result>
4. Tu formules ta réponse finale avec les données réelles

## OUTILS DISPONIBLES

${toolDescriptions}

## EXEMPLES CORRECTS

Question: "Combien de parcelles à Bussigny?"
Réponse correcte:
<tool_call>
{"name": "sql_query", "input": {"query": "SELECT genre, COUNT(*) as nb FROM bdco.bdco_parcelle WHERE identdn LIKE 'VD0157%' GROUP BY genre"}}
</tool_call>

Question: "Quels types de parcelles?"
Réponse correcte:
<tool_call>
{"name": "sql_query", "input": {"query": "SELECT DISTINCT genre, COUNT(*) as total FROM bdco.bdco_parcelle WHERE identdn LIKE 'VD0157%' GROUP BY genre ORDER BY total DESC"}}
</tool_call>

## CONTEXTE BASE DE DONNÉES BUSSIGNY

- Code commune Bussigny: VD0157 (colonne identdn commence par 'VD0157')
- Table parcelles: bdco.bdco_parcelle
- Colonnes utiles: identdn (ID parcelle), genre (type: Privé, DP communal, DP cantonal), egrid, numero
- TOUJOURS filtrer par identdn LIKE 'VD0157%' pour Bussigny uniquement`;
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
  let lastResponseHash = '';
  let repeatedCount = 0;

  while (iteration < MAX_ITERATIONS) {
    iteration++;
    console.log(`[Ollama Agent] Iteration ${iteration}`);

    // Appeler Ollama
    const response = await callOllama(model, messages, baseUrl);
    console.log(`[Ollama Agent] Response: ${response.slice(0, 200)}...`);

    // Détection de boucle : si la réponse est similaire à la précédente
    const responseHash = response.slice(0, 100);
    if (responseHash === lastResponseHash) {
      repeatedCount++;
      console.log(`[Ollama Agent] BOUCLE DÉTECTÉE (${repeatedCount}x)`);
      if (repeatedCount >= 2) {
        // Forcer une sortie avec un message d'erreur
        finalResponse = "Je n'ai pas pu exécuter la requête correctement. Veuillez reformuler votre question ou essayer avec l'assistant SQL (MODE 1).";
        break;
      }
    } else {
      repeatedCount = 0;
      lastResponseHash = responseHash;
    }

    // Détection du bavardage sans action : si le modèle dit "je vais exécuter" sans <tool_call>
    const toolCalls = parseToolCalls(response);
    const talksAboutExecuting = /je vais (exécuter|lancer|faire|procéder|récupérer)/i.test(response);

    if (toolCalls.length === 0 && talksAboutExecuting && iteration < MAX_ITERATIONS - 1) {
      console.log(`[Ollama Agent] Bavardage détecté - forçage d'instruction`);
      // Ajouter un message pour forcer l'action
      messages.push({ role: 'assistant', content: response });
      messages.push({ role: 'user', content: `STOP. Tu dois écrire le <tool_call> maintenant. Ne parle plus, écris juste:\n<tool_call>\n{"name": "sql_query", "input": {"query": "..."}}\n</tool_call>` });
      continue;
    }

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
