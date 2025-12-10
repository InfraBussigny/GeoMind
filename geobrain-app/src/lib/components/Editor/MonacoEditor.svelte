<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  interface Props {
    value?: string;
    language?: string;
    readonly?: boolean;
    minimap?: boolean;
    lineNumbers?: 'on' | 'off';
    wordWrap?: 'on' | 'off';
    folding?: boolean;
    onchange?: (value: string) => void;
    onmount?: (editor: any) => void;
    onselectionchange?: (selection: string) => void;
  }

  let {
    value = $bindable(''),
    language = $bindable('plaintext'),
    readonly = false,
    minimap = false,
    lineNumbers = 'on',
    wordWrap = 'off',
    folding = true,
    onchange,
    onmount,
    onselectionchange
  }: Props = $props();

  let container: HTMLDivElement;
  let editor: any = null;
  let monaco: any = null;
  let isUpdating = false;

  // Theme definition
  const GEOBRAIN_THEME = {
    base: 'vs-dark' as const,
    inherit: true,
    rules: [
      { token: '', foreground: 'f0f0f5', background: '0a0a0f' },
      { token: 'comment', foreground: '7a7a8a', fontStyle: 'italic' },
      { token: 'keyword', foreground: '00ff88', fontStyle: 'bold' },
      { token: 'keyword.control', foreground: '00ff88' },
      { token: 'keyword.operator', foreground: '00ff88' },
      { token: 'string', foreground: '00d4ff' },
      { token: 'string.sql', foreground: '00d4ff' },
      { token: 'number', foreground: 'a855f7' },
      { token: 'number.float', foreground: 'a855f7' },
      { token: 'type', foreground: 'ff0080' },
      { token: 'type.identifier', foreground: 'ff0080' },
      { token: 'class', foreground: 'ff0080' },
      { token: 'function', foreground: 'ffaa00' },
      { token: 'function.call', foreground: 'ffaa00' },
      { token: 'variable', foreground: 'f0f0f5' },
      { token: 'variable.predefined', foreground: '00d4ff' },
      { token: 'constant', foreground: 'a855f7' },
      { token: 'operator', foreground: '00ff88' },
      { token: 'delimiter', foreground: '8a8a9a' },
      { token: 'delimiter.bracket', foreground: 'c0c0cc' },
      { token: 'tag', foreground: '00ff88' },
      { token: 'attribute.name', foreground: 'ffaa00' },
      { token: 'attribute.value', foreground: '00d4ff' },
      // SQL specific
      { token: 'predefined.sql', foreground: 'ff0080' },
      { token: 'operator.sql', foreground: '00ff88' },
      // Python specific
      { token: 'keyword.python', foreground: '00ff88' },
      { token: 'string.escape', foreground: 'a855f7' },
    ],
    colors: {
      'editor.background': '#0a0a0f',
      'editor.foreground': '#f0f0f5',
      'editor.lineHighlightBackground': '#12121a',
      'editor.selectionBackground': 'rgba(0, 255, 136, 0.25)',
      'editor.inactiveSelectionBackground': 'rgba(0, 255, 136, 0.15)',
      'editorCursor.foreground': '#00ff88',
      'editorWhitespace.foreground': '#2a2a38',
      'editorIndentGuide.background': '#2a2a38',
      'editorIndentGuide.activeBackground': '#3a3a4a',
      'editorLineNumber.foreground': '#5a5a6a',
      'editorLineNumber.activeForeground': '#00ff88',
      'editorGutter.background': '#0a0a0f',
      'editorWidget.background': '#12121a',
      'editorWidget.border': '#2a2a38',
      'editorSuggestWidget.background': '#12121a',
      'editorSuggestWidget.border': '#2a2a38',
      'editorSuggestWidget.selectedBackground': 'rgba(0, 255, 136, 0.2)',
      'editorSuggestWidget.highlightForeground': '#00ff88',
      'editorHoverWidget.background': '#12121a',
      'editorHoverWidget.border': '#00ff88',
      'scrollbar.shadow': '#000000',
      'scrollbarSlider.background': 'rgba(42, 42, 56, 0.6)',
      'scrollbarSlider.hoverBackground': 'rgba(58, 58, 74, 0.8)',
      'scrollbarSlider.activeBackground': '#00ff88',
      'minimap.background': '#0a0a0f',
      'minimap.selectionHighlight': 'rgba(0, 255, 136, 0.3)',
    }
  };

  // Language detection from content
  function detectLanguage(content: string): string {
    // Shebang detection
    if (content.startsWith('#!/usr/bin/python') || content.startsWith('#!/usr/bin/env python')) {
      return 'python';
    }
    if (content.startsWith('#!/bin/bash') || content.startsWith('#!/bin/sh')) {
      return 'shell';
    }

    // SQL pattern detection
    if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\s+/im.test(content)) {
      return 'sql';
    }

    // JSON detection
    if (/^\s*[\[{]/.test(content) && /[\]}]\s*$/.test(content)) {
      try {
        JSON.parse(content);
        return 'json';
      } catch {}
    }

    // Python detection
    if (/^(import |from |def |class |if __name__|@)/m.test(content)) {
      return 'python';
    }

    // JavaScript detection
    if (/^(const |let |var |function |import |export |class )/m.test(content)) {
      return 'javascript';
    }

    // XML/HTML detection
    if (/^\s*<[?!]?[a-zA-Z]/.test(content)) {
      if (/<html/i.test(content)) return 'html';
      return 'xml';
    }

    return 'plaintext';
  }

  onMount(async () => {
    if (!browser) return;

    // Dynamic import Monaco
    monaco = await import('monaco-editor');

    // Setup Monaco environment for workers
    // Note: Each URL must be a static string for Vite to process correctly
    self.MonacoEnvironment = {
      getWorker: function (_moduleId: string, label: string) {
        switch (label) {
          case 'json':
            return new Worker(
              new URL('monaco-editor/esm/vs/language/json/json.worker.js', import.meta.url),
              { type: 'module' }
            );
          case 'css':
          case 'scss':
          case 'less':
            return new Worker(
              new URL('monaco-editor/esm/vs/language/css/css.worker.js', import.meta.url),
              { type: 'module' }
            );
          case 'html':
          case 'handlebars':
          case 'razor':
            return new Worker(
              new URL('monaco-editor/esm/vs/language/html/html.worker.js', import.meta.url),
              { type: 'module' }
            );
          case 'typescript':
          case 'javascript':
            return new Worker(
              new URL('monaco-editor/esm/vs/language/typescript/ts.worker.js', import.meta.url),
              { type: 'module' }
            );
          default:
            return new Worker(
              new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
              { type: 'module' }
            );
        }
      }
    };

    // Register custom theme
    monaco.editor.defineTheme('geobrain-cyber', GEOBRAIN_THEME);

    // Auto-detect language if plaintext
    let initialLanguage = language;
    if (language === 'plaintext' && value) {
      initialLanguage = detectLanguage(value);
      language = initialLanguage;
    }

    // Create editor instance
    editor = monaco.editor.create(container, {
      value: value,
      language: initialLanguage,
      theme: 'geobrain-cyber',
      readOnly: readonly,
      minimap: { enabled: minimap },
      lineNumbers: lineNumbers,
      wordWrap: wordWrap,
      folding: folding,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
      fontLigatures: true,
      tabSize: 2,
      insertSpaces: true,
      automaticLayout: true,
      scrollBeyondLastLine: false,
      renderWhitespace: 'selection',
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        indentation: true
      },
      suggest: {
        showKeywords: true,
        showSnippets: true,
        showFunctions: true,
        showVariables: true
      },
      quickSuggestions: {
        other: true,
        comments: false,
        strings: false
      },
      padding: { top: 8, bottom: 8 },
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
    });

    // Listen to content changes
    editor.onDidChangeModelContent(() => {
      if (isUpdating) return;
      const newValue = editor.getValue();
      value = newValue;
      onchange?.(newValue);
    });

    // Listen to selection changes
    editor.onDidChangeCursorSelection(() => {
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        const selectedText = editor.getModel()?.getValueInRange(selection) || '';
        onselectionchange?.(selectedText);
      } else {
        onselectionchange?.('');
      }
    });

    // Expose editor instance
    onmount?.(editor);

    return () => {
      editor?.dispose();
    };
  });

  // Update editor when value prop changes externally
  $effect(() => {
    if (editor && value !== editor.getValue()) {
      isUpdating = true;
      editor.setValue(value);
      isUpdating = false;
    }
  });

  // Update language when it changes
  $effect(() => {
    if (editor && monaco) {
      const model = editor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, language);
      }
    }
  });

  // Expose methods
  export function getValue(): string {
    return editor?.getValue() || '';
  }

  export function setValue(newValue: string) {
    if (editor) {
      isUpdating = true;
      editor.setValue(newValue);
      isUpdating = false;
    }
  }

  export function getSelection(): string {
    if (!editor) return '';
    const selection = editor.getSelection();
    if (selection && !selection.isEmpty()) {
      return editor.getModel()?.getValueInRange(selection) || '';
    }
    return '';
  }

  export function insertText(text: string) {
    if (!editor) return;
    const selection = editor.getSelection();
    editor.executeEdits('insert', [{
      range: selection,
      text: text,
      forceMoveMarkers: true
    }]);
  }

  export function format() {
    editor?.getAction('editor.action.formatDocument')?.run();
  }

  export function focus() {
    editor?.focus();
  }

  export function getEditor() {
    return editor;
  }
</script>

<div class="monaco-container" bind:this={container}></div>

<style>
  .monaco-container {
    width: 100%;
    height: 100%;
    min-height: 200px;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    overflow: hidden;
  }
</style>
