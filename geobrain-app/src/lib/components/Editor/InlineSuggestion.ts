/**
 * InlineSuggestion - Copilot-style inline code suggestions for Monaco Editor
 *
 * This module provides AI-powered inline code completions that appear as
 * ghost text in the editor. Press Tab to accept, Escape to dismiss.
 */

import type { editor, languages, CancellationToken, Position } from 'monaco-editor';

// Configuration
const DEBOUNCE_DELAY = 500; // ms before triggering suggestion
const MAX_CONTEXT_LINES = 50; // lines of context to send to AI
const API_ENDPOINT = 'http://localhost:3001/api/stream';

interface SuggestionConfig {
  enabled: boolean;
  debounceDelay: number;
  maxContextLines: number;
  apiEndpoint: string;
}

const defaultConfig: SuggestionConfig = {
  enabled: true,
  debounceDelay: DEBOUNCE_DELAY,
  maxContextLines: MAX_CONTEXT_LINES,
  apiEndpoint: API_ENDPOINT,
};

let config = { ...defaultConfig };

// State
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let currentRequest: AbortController | null = null;
let isProcessing = false;

/**
 * Configure the inline suggestion system
 */
export function configure(options: Partial<SuggestionConfig>) {
  config = { ...config, ...options };
}

/**
 * Extract context around cursor position
 */
function extractContext(
  model: editor.ITextModel,
  position: Position
): { before: string; after: string; currentLine: string } {
  const lineNumber = position.lineNumber;
  const column = position.column;

  // Get lines before cursor (up to maxContextLines)
  const startLine = Math.max(1, lineNumber - config.maxContextLines);
  const beforeLines: string[] = [];
  for (let i = startLine; i < lineNumber; i++) {
    beforeLines.push(model.getLineContent(i));
  }

  // Current line up to cursor
  const currentLineContent = model.getLineContent(lineNumber);
  const currentLineBefore = currentLineContent.substring(0, column - 1);
  beforeLines.push(currentLineBefore);

  // Get lines after cursor
  const endLine = Math.min(model.getLineCount(), lineNumber + 10);
  const afterLines: string[] = [];
  const currentLineAfter = currentLineContent.substring(column - 1);
  if (currentLineAfter.trim()) {
    afterLines.push(currentLineAfter);
  }
  for (let i = lineNumber + 1; i <= endLine; i++) {
    afterLines.push(model.getLineContent(i));
  }

  return {
    before: beforeLines.join('\n'),
    after: afterLines.join('\n'),
    currentLine: currentLineContent,
  };
}

/**
 * Build the prompt for the AI
 */
function buildPrompt(
  context: { before: string; after: string; currentLine: string },
  language: string
): string {
  return `Tu es un assistant de code. Complete le code ${language} suivant.
Donne UNIQUEMENT le code a inserer, sans explication ni commentaire.
Le code doit etre syntaxiquement correct et suivre les conventions du langage.

Code avant le curseur:
\`\`\`${language}
${context.before}
\`\`\`

${context.after ? `Code apres le curseur:
\`\`\`${language}
${context.after}
\`\`\`` : ''}

Complete la ligne actuelle et les lignes suivantes si necessaire. Reponds UNIQUEMENT avec le code a inserer:`;
}

/**
 * Fetch inline suggestion from AI
 */
async function fetchSuggestion(
  model: editor.ITextModel,
  position: Position,
  language: string,
  signal: AbortSignal
): Promise<string | null> {
  const context = extractContext(model, position);

  // Don't suggest if line is empty and at start
  if (!context.before.trim() && !context.after.trim()) {
    return null;
  }

  const prompt = buildPrompt(context, language);

  try {
    const response = await fetch(config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: prompt,
        stream: false, // For inline suggestions, we want the full response
      }),
      signal,
    });

    if (!response.ok) {
      console.error('InlineSuggestion: API error', response.status);
      return null;
    }

    // Handle streaming response
    const reader = response.body?.getReader();
    if (!reader) return null;

    let fullText = '';
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
            if (data.content) {
              fullText += data.content;
            }
            if (data.done) {
              break;
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }

    // Clean up the suggestion
    let suggestion = fullText.trim();

    // Remove markdown code blocks if present
    if (suggestion.startsWith('```')) {
      const lines = suggestion.split('\n');
      suggestion = lines.slice(1, -1).join('\n');
    }

    // Limit suggestion length
    const suggestionLines = suggestion.split('\n');
    if (suggestionLines.length > 5) {
      suggestion = suggestionLines.slice(0, 5).join('\n');
    }

    return suggestion || null;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return null;
    }
    console.error('InlineSuggestion: Fetch error', error);
    return null;
  }
}

/**
 * Create an inline completions provider for Monaco
 */
export function createInlineCompletionsProvider(
  getLanguage: () => string
): languages.InlineCompletionsProvider {
  return {
    provideInlineCompletions: async (
      model: editor.ITextModel,
      position: Position,
      context: languages.InlineCompletionContext,
      token: CancellationToken
    ): Promise<languages.InlineCompletions | null> => {
      if (!config.enabled) {
        return null;
      }

      // Cancel previous request
      if (currentRequest) {
        currentRequest.abort();
        currentRequest = null;
      }

      // Clear previous timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }

      // Skip if triggered by specific characters
      if (context.triggerKind === 1) { // Automatic
        const lineContent = model.getLineContent(position.lineNumber);
        const charBefore = lineContent[position.column - 2] || '';

        // Skip for certain characters
        if (['(', '[', '{', '"', "'", '`', ' ', '\t'].includes(charBefore)) {
          return null;
        }
      }

      // Debounce
      return new Promise((resolve) => {
        debounceTimer = setTimeout(async () => {
          if (token.isCancellationRequested || isProcessing) {
            resolve(null);
            return;
          }

          isProcessing = true;
          currentRequest = new AbortController();

          const language = getLanguage();
          const suggestion = await fetchSuggestion(
            model,
            position,
            language,
            currentRequest.signal
          );

          isProcessing = false;
          currentRequest = null;

          if (token.isCancellationRequested || !suggestion) {
            resolve(null);
            return;
          }

          resolve({
            items: [
              {
                insertText: suggestion,
                range: {
                  startLineNumber: position.lineNumber,
                  startColumn: position.column,
                  endLineNumber: position.lineNumber,
                  endColumn: position.column,
                },
              },
            ],
          });
        }, config.debounceDelay);
      });
    },

    // Required by Monaco API - cleanup method
    disposeInlineCompletions: () => {
      if (currentRequest) {
        currentRequest.abort();
        currentRequest = null;
      }
    },
  };
}

/**
 * Register the inline completions provider with Monaco
 */
export function registerInlineSuggestions(
  monaco: typeof import('monaco-editor'),
  getLanguage: () => string
): { dispose: () => void } {
  const provider = createInlineCompletionsProvider(getLanguage);

  // Register for all languages
  const disposable = monaco.languages.registerInlineCompletionsProvider(
    { pattern: '**' },
    provider
  );

  return {
    dispose: () => {
      disposable.dispose();
      if (currentRequest) {
        currentRequest.abort();
      }
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    },
  };
}

/**
 * Manual trigger for inline suggestion (Ctrl+Space alternative)
 */
export async function triggerInlineSuggestion(
  editor: editor.IStandaloneCodeEditor,
  language: string
): Promise<void> {
  const model = editor.getModel();
  const position = editor.getPosition();

  if (!model || !position) {
    return;
  }

  // Cancel any existing request
  if (currentRequest) {
    currentRequest.abort();
  }

  isProcessing = true;
  currentRequest = new AbortController();

  const suggestion = await fetchSuggestion(
    model,
    position,
    language,
    currentRequest.signal
  );

  isProcessing = false;
  currentRequest = null;

  if (suggestion) {
    // Insert as ghost text would, but we'll insert directly for now
    editor.trigger('inline-suggestion', 'editor.action.inlineSuggest.trigger', {});
  }
}

/**
 * Enable/disable inline suggestions
 */
export function setEnabled(enabled: boolean): void {
  config.enabled = enabled;
}

/**
 * Check if inline suggestions are enabled
 */
export function isEnabled(): boolean {
  return config.enabled;
}
