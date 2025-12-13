/**
 * GeoMind Ghostwriter Service
 * Auto-complétion intelligente pour le chat et l'éditeur
 *
 * Fonctionnalités:
 * - Suggestions basées sur contexte
 * - Historique des commandes fréquentes
 * - Templates SQL/Python/FME
 * - Snippets personnalisés
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';

// ============================================
// Types
// ============================================

export interface Suggestion {
  id: string;
  text: string;
  preview: string; // Version courte affichée
  category: 'command' | 'template' | 'history' | 'snippet' | 'ai';
  language?: string;
  score: number; // Pertinence 0-1
  usageCount: number;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  content: string;
  language: string;
  tags: string[];
  variables: TemplateVariable[];
}

export interface TemplateVariable {
  name: string;
  placeholder: string;
  description: string;
  default?: string;
}

export interface Snippet {
  id: string;
  trigger: string; // Ex: "sel" -> SELECT * FROM
  content: string;
  language: string;
  description: string;
}

// ============================================
// Constants
// ============================================

const STORAGE_KEY = 'geomind_ghostwriter';
const MAX_HISTORY = 100;
const MAX_SUGGESTIONS = 8;

// Templates SQL prédéfinis
const SQL_TEMPLATES: Template[] = [
  {
    id: 'sql_select_basic',
    name: 'SELECT basique',
    description: 'Requête SELECT simple avec WHERE',
    language: 'sql',
    tags: ['select', 'query', 'basic'],
    content: `SELECT ${'{columns}'}
FROM ${'{schema}'}.${'{table}'}
WHERE ${'{condition}'}
ORDER BY ${'{order_column}'};`,
    variables: [
      { name: 'columns', placeholder: '*', description: 'Colonnes à sélectionner' },
      { name: 'schema', placeholder: 'public', description: 'Schéma de la table' },
      { name: 'table', placeholder: 'table_name', description: 'Nom de la table' },
      { name: 'condition', placeholder: '1=1', description: 'Condition WHERE' },
      { name: 'order_column', placeholder: 'id', description: 'Colonne de tri' }
    ]
  },
  {
    id: 'sql_spatial_intersects',
    name: 'Intersection spatiale',
    description: 'Trouver les géométries qui intersectent',
    language: 'sql',
    tags: ['postgis', 'spatial', 'intersects'],
    content: `SELECT a.*, b.${'{b_column}'}
FROM ${'{schema_a}'}.${'{table_a}'} a
JOIN ${'{schema_b}'}.${'{table_b}'} b
  ON ST_Intersects(a.${'{geom_a}'}, b.${'{geom_b}'})
WHERE ${'{condition}'};`,
    variables: [
      { name: 'schema_a', placeholder: 'public', description: 'Schéma table A' },
      { name: 'table_a', placeholder: 'parcelles', description: 'Table A' },
      { name: 'schema_b', placeholder: 'public', description: 'Schéma table B' },
      { name: 'table_b', placeholder: 'zones', description: 'Table B' },
      { name: 'geom_a', placeholder: 'geom', description: 'Colonne géométrie A' },
      { name: 'geom_b', placeholder: 'geom', description: 'Colonne géométrie B' },
      { name: 'b_column', placeholder: 'nom', description: 'Colonne de B à récupérer' },
      { name: 'condition', placeholder: '1=1', description: 'Condition WHERE' }
    ]
  },
  {
    id: 'sql_spatial_buffer',
    name: 'Buffer spatial',
    description: 'Créer un buffer autour des géométries',
    language: 'sql',
    tags: ['postgis', 'spatial', 'buffer'],
    content: `SELECT id, nom,
  ST_Buffer(${'{geom_column}'}::geography, ${'{distance}'})::geometry AS geom_buffer
FROM ${'{schema}'}.${'{table}'}
WHERE ${'{condition}'};`,
    variables: [
      { name: 'schema', placeholder: 'public', description: 'Schéma' },
      { name: 'table', placeholder: 'points', description: 'Table source' },
      { name: 'geom_column', placeholder: 'geom', description: 'Colonne géométrie' },
      { name: 'distance', placeholder: '100', description: 'Distance buffer (mètres)' },
      { name: 'condition', placeholder: '1=1', description: 'Condition WHERE' }
    ]
  },
  {
    id: 'sql_count_group',
    name: 'Comptage par groupe',
    description: 'Compter les enregistrements groupés',
    language: 'sql',
    tags: ['count', 'group', 'aggregate'],
    content: `SELECT ${'{group_column}'}, COUNT(*) AS nb
FROM ${'{schema}'}.${'{table}'}
WHERE ${'{condition}'}
GROUP BY ${'{group_column}'}
ORDER BY nb DESC;`,
    variables: [
      { name: 'schema', placeholder: 'public', description: 'Schéma' },
      { name: 'table', placeholder: 'table_name', description: 'Table' },
      { name: 'group_column', placeholder: 'type', description: 'Colonne de groupement' },
      { name: 'condition', placeholder: '1=1', description: 'Condition WHERE' }
    ]
  },
  {
    id: 'sql_surface_calc',
    name: 'Calcul de surface',
    description: 'Calculer la surface des polygones',
    language: 'sql',
    tags: ['postgis', 'area', 'surface'],
    content: `SELECT id, nom,
  ST_Area(${'{geom_column}'}::geography) AS surface_m2,
  ST_Area(${'{geom_column}'}::geography) / 10000 AS surface_ha
FROM ${'{schema}'}.${'{table}'}
WHERE ${'{condition}'}
ORDER BY surface_m2 DESC;`,
    variables: [
      { name: 'schema', placeholder: 'bdco', description: 'Schéma' },
      { name: 'table', placeholder: 'parcelle', description: 'Table' },
      { name: 'geom_column', placeholder: 'geom', description: 'Colonne géométrie' },
      { name: 'condition', placeholder: '1=1', description: 'Condition WHERE' }
    ]
  }
];

// Templates Python prédéfinis
const PYTHON_TEMPLATES: Template[] = [
  {
    id: 'py_qgis_layer',
    name: 'Charger couche QGIS',
    description: 'Ajouter une couche depuis PostGIS',
    language: 'python',
    tags: ['qgis', 'postgis', 'layer'],
    content: `from qgis.core import QgsVectorLayer, QgsProject

# Connexion PostGIS
uri = QgsDataSourceUri()
uri.setConnection("${'{host}'}", "${'{port}'}", "${'{database}'}", "${'{user}'}", "${'{password}'}")
uri.setDataSource("${'{schema}'}", "${'{table}'}", "${'{geom_column}'}")

# Charger la couche
layer = QgsVectorLayer(uri.uri(), "${'{layer_name}'}", "postgres")

if layer.isValid():
    QgsProject.instance().addMapLayer(layer)
    print(f"Couche {layer.name()} chargée: {layer.featureCount()} entités")
else:
    print("Erreur: couche invalide")`,
    variables: [
      { name: 'host', placeholder: 'localhost', description: 'Hôte PostgreSQL' },
      { name: 'port', placeholder: '5432', description: 'Port' },
      { name: 'database', placeholder: 'geodb', description: 'Base de données' },
      { name: 'user', placeholder: 'postgres', description: 'Utilisateur' },
      { name: 'password', placeholder: '', description: 'Mot de passe' },
      { name: 'schema', placeholder: 'public', description: 'Schéma' },
      { name: 'table', placeholder: 'parcelles', description: 'Table' },
      { name: 'geom_column', placeholder: 'geom', description: 'Colonne géométrie' },
      { name: 'layer_name', placeholder: 'Parcelles', description: 'Nom affiché' }
    ]
  },
  {
    id: 'py_pandas_postgis',
    name: 'DataFrame depuis PostGIS',
    description: 'Charger des données PostGIS dans pandas',
    language: 'python',
    tags: ['pandas', 'geopandas', 'postgis'],
    content: `import geopandas as gpd
from sqlalchemy import create_engine

# Connexion
engine = create_engine("postgresql://${'{user}'}:${'{password}'}@${'{host}'}:${'{port}'}/${'{database}'}")

# Requête
sql = """
SELECT * FROM ${'{schema}'}.${'{table}'}
WHERE ${'{condition}'}
"""

# Charger en GeoDataFrame
gdf = gpd.read_postgis(sql, engine, geom_col="${'{geom_column}'}")

print(f"Chargé: {len(gdf)} lignes")
print(gdf.head())`,
    variables: [
      { name: 'host', placeholder: 'localhost', description: 'Hôte' },
      { name: 'port', placeholder: '5432', description: 'Port' },
      { name: 'database', placeholder: 'geodb', description: 'Base' },
      { name: 'user', placeholder: 'postgres', description: 'User' },
      { name: 'password', placeholder: '', description: 'Password' },
      { name: 'schema', placeholder: 'public', description: 'Schéma' },
      { name: 'table', placeholder: 'data', description: 'Table' },
      { name: 'geom_column', placeholder: 'geom', description: 'Géométrie' },
      { name: 'condition', placeholder: '1=1', description: 'WHERE' }
    ]
  }
];

// Snippets rapides
const DEFAULT_SNIPPETS: Snippet[] = [
  // SQL
  { id: 'snp_sel', trigger: 'sel', content: 'SELECT * FROM ', language: 'sql', description: 'SELECT basique' },
  { id: 'snp_selw', trigger: 'selw', content: 'SELECT * FROM  WHERE ', language: 'sql', description: 'SELECT avec WHERE' },
  { id: 'snp_cnt', trigger: 'cnt', content: 'SELECT COUNT(*) FROM ', language: 'sql', description: 'COUNT' },
  { id: 'snp_grp', trigger: 'grp', content: 'GROUP BY ', language: 'sql', description: 'GROUP BY' },
  { id: 'snp_ord', trigger: 'ord', content: 'ORDER BY ', language: 'sql', description: 'ORDER BY' },
  { id: 'snp_lim', trigger: 'lim', content: 'LIMIT ', language: 'sql', description: 'LIMIT' },
  { id: 'snp_join', trigger: 'jn', content: 'JOIN  ON ', language: 'sql', description: 'JOIN' },
  { id: 'snp_ljoin', trigger: 'ljn', content: 'LEFT JOIN  ON ', language: 'sql', description: 'LEFT JOIN' },

  // PostGIS
  { id: 'snp_stint', trigger: 'stint', content: 'ST_Intersects(a.geom, b.geom)', language: 'sql', description: 'ST_Intersects' },
  { id: 'snp_stbuf', trigger: 'stbuf', content: 'ST_Buffer(geom::geography, )::geometry', language: 'sql', description: 'ST_Buffer' },
  { id: 'snp_starea', trigger: 'starea', content: 'ST_Area(geom::geography)', language: 'sql', description: 'ST_Area' },
  { id: 'snp_stcent', trigger: 'stcent', content: 'ST_Centroid(geom)', language: 'sql', description: 'ST_Centroid' },
  { id: 'snp_stdist', trigger: 'stdist', content: 'ST_Distance(a.geom::geography, b.geom::geography)', language: 'sql', description: 'ST_Distance' },
  { id: 'snp_stcont', trigger: 'stcont', content: 'ST_Contains(a.geom, b.geom)', language: 'sql', description: 'ST_Contains' },
  { id: 'snp_stwith', trigger: 'stwith', content: 'ST_Within(a.geom, b.geom)', language: 'sql', description: 'ST_Within' },

  // Python
  { id: 'snp_pydef', trigger: 'def', content: 'def ():\n    ', language: 'python', description: 'Fonction' },
  { id: 'snp_pyclass', trigger: 'class', content: 'class ():\n    def __init__(self):\n        ', language: 'python', description: 'Classe' },
  { id: 'snp_pyfor', trigger: 'for', content: 'for  in :\n    ', language: 'python', description: 'Boucle for' },
  { id: 'snp_pyif', trigger: 'if', content: 'if :\n    ', language: 'python', description: 'Condition if' },
  { id: 'snp_pytry', trigger: 'try', content: 'try:\n    \nexcept Exception as e:\n    print(f"Erreur: {e}")', language: 'python', description: 'Try/except' },
  { id: 'snp_pywith', trigger: 'with', content: 'with open("", "r") as f:\n    ', language: 'python', description: 'Context manager' }
];

// Commandes chat fréquentes
const CHAT_COMMANDS = [
  { text: 'Montre-moi les parcelles du secteur', category: 'command' as const },
  { text: 'Quelle est la surface totale des zones à bâtir ?', category: 'command' as const },
  { text: 'Liste les schémas disponibles dans la base', category: 'command' as const },
  { text: 'Affiche la structure de la table ', category: 'command' as const },
  { text: 'Combien de parcelles ont une surface > 1000 m² ?', category: 'command' as const },
  { text: 'Exporte les résultats en GeoJSON', category: 'command' as const },
  { text: 'Crée une requête pour trouver ', category: 'command' as const },
  { text: 'Optimise cette requête SQL', category: 'command' as const }
];

// ============================================
// Stores
// ============================================

interface GhostwriterState {
  history: string[];
  customSnippets: Snippet[];
  enabled: boolean;
  showPreview: boolean;
}

const defaultState: GhostwriterState = {
  history: [],
  customSnippets: [],
  enabled: true,
  showPreview: true
};

function createGhostwriterStore() {
  const stored = browser ? localStorage.getItem(STORAGE_KEY) : null;
  const initial: GhostwriterState = stored ? { ...defaultState, ...JSON.parse(stored) } : defaultState;

  const { subscribe, set, update } = writable<GhostwriterState>(initial);

  // Auto-save
  if (browser) {
    subscribe(state => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    });
  }

  return {
    subscribe,

    addToHistory(text: string) {
      update(state => {
        const filtered = state.history.filter(h => h !== text);
        return {
          ...state,
          history: [text, ...filtered].slice(0, MAX_HISTORY)
        };
      });
    },

    addSnippet(snippet: Omit<Snippet, 'id'>) {
      update(state => ({
        ...state,
        customSnippets: [
          ...state.customSnippets,
          { ...snippet, id: `custom_${Date.now()}` }
        ]
      }));
    },

    removeSnippet(id: string) {
      update(state => ({
        ...state,
        customSnippets: state.customSnippets.filter(s => s.id !== id)
      }));
    },

    toggle() {
      update(state => ({ ...state, enabled: !state.enabled }));
    },

    togglePreview() {
      update(state => ({ ...state, showPreview: !state.showPreview }));
    },

    clearHistory() {
      update(state => ({ ...state, history: [] }));
    },

    reset() {
      set(defaultState);
    }
  };
}

export const ghostwriterStore = createGhostwriterStore();

// ============================================
// Suggestion Engine
// ============================================

export function getSuggestions(
  input: string,
  context: 'chat' | 'editor',
  language?: string
): Suggestion[] {
  const state = get(ghostwriterStore);
  if (!state.enabled || !input || input.length < 2) return [];

  const inputLower = input.toLowerCase().trim();
  const suggestions: Suggestion[] = [];

  // 1. Historique (priorité haute)
  const historyMatches = state.history
    .filter(h => h.toLowerCase().includes(inputLower))
    .slice(0, 3)
    .map((h, i) => ({
      id: `hist_${i}`,
      text: h,
      preview: h.length > 60 ? h.slice(0, 60) + '...' : h,
      category: 'history' as const,
      score: 0.9 - (i * 0.1),
      usageCount: 0
    }));
  suggestions.push(...historyMatches);

  // 2. Snippets (si contexte éditeur)
  if (context === 'editor') {
    const allSnippets = [...DEFAULT_SNIPPETS, ...state.customSnippets];
    const snippetMatches = allSnippets
      .filter(s =>
        (!language || s.language === language) &&
        (s.trigger.startsWith(inputLower) || s.description.toLowerCase().includes(inputLower))
      )
      .slice(0, 3)
      .map(s => ({
        id: s.id,
        text: s.content,
        preview: `${s.trigger} → ${s.description}`,
        category: 'snippet' as const,
        language: s.language,
        score: 0.85,
        usageCount: 0
      }));
    suggestions.push(...snippetMatches);
  }

  // 3. Commandes chat (si contexte chat)
  if (context === 'chat') {
    const cmdMatches = CHAT_COMMANDS
      .filter(c => c.text.toLowerCase().includes(inputLower))
      .slice(0, 3)
      .map((c, i) => ({
        id: `cmd_${i}`,
        text: c.text,
        preview: c.text,
        category: c.category,
        score: 0.7,
        usageCount: 0
      }));
    suggestions.push(...cmdMatches);
  }

  // Trier par score et limiter
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SUGGESTIONS);
}

// ============================================
// Templates
// ============================================

export function getTemplates(language?: string): Template[] {
  let templates = [...SQL_TEMPLATES, ...PYTHON_TEMPLATES];

  if (language) {
    templates = templates.filter(t => t.language === language);
  }

  return templates;
}

export function getTemplateById(id: string): Template | undefined {
  return [...SQL_TEMPLATES, ...PYTHON_TEMPLATES].find(t => t.id === id);
}

export function applyTemplate(template: Template, values: Record<string, string>): string {
  let result = template.content;

  for (const variable of template.variables) {
    const value = values[variable.name] || variable.placeholder;
    const pattern = new RegExp(`\\$\\{['"]?${variable.name}['"]?\\}`, 'g');
    result = result.replace(pattern, value);
  }

  return result;
}

export function searchTemplates(query: string): Template[] {
  const queryLower = query.toLowerCase();
  return [...SQL_TEMPLATES, ...PYTHON_TEMPLATES].filter(t =>
    t.name.toLowerCase().includes(queryLower) ||
    t.description.toLowerCase().includes(queryLower) ||
    t.tags.some(tag => tag.includes(queryLower))
  );
}

// ============================================
// Snippets
// ============================================

export function getSnippets(language?: string): Snippet[] {
  const state = get(ghostwriterStore);
  const all = [...DEFAULT_SNIPPETS, ...state.customSnippets];

  if (language) {
    return all.filter(s => s.language === language);
  }

  return all;
}

export function expandSnippet(trigger: string, language?: string): string | null {
  const snippets = getSnippets(language);
  const match = snippets.find(s => s.trigger === trigger);
  return match?.content || null;
}

// ============================================
// Auto-complete pour l'éditeur Monaco
// ============================================

export function getMonacoCompletionItems(
  input: string,
  language: string,
  position: { lineNumber: number; column: number }
) {
  const suggestions = getSuggestions(input, 'editor', language);

  return suggestions.map((s, i) => ({
    label: s.preview,
    kind: s.category === 'snippet' ? 27 : 1, // Monaco: Snippet vs Text
    insertText: s.text,
    detail: s.category,
    sortText: String(i).padStart(3, '0'),
    range: {
      startLineNumber: position.lineNumber,
      startColumn: position.column - input.length,
      endLineNumber: position.lineNumber,
      endColumn: position.column
    }
  }));
}

// ============================================
// Pattern Detection (for auto-generated functions)
// ============================================

interface PatternMatch {
  pattern: string;
  count: number;
  examples: string[];
  suggestedFunction: string;
}

export function detectPatterns(history: string[]): PatternMatch[] {
  const patterns: Map<string, { count: number; examples: string[] }> = new Map();

  // Analyser l'historique pour trouver des patterns répétitifs
  for (const entry of history) {
    // Pattern: SELECT ... FROM schema.table
    const selectMatch = entry.match(/SELECT\s+[\w\s,*]+\s+FROM\s+(\w+)\.(\w+)/i);
    if (selectMatch) {
      const pattern = `SELECT FROM ${selectMatch[1]}.${selectMatch[2]}`;
      const existing = patterns.get(pattern) || { count: 0, examples: [] };
      existing.count++;
      if (existing.examples.length < 3) existing.examples.push(entry);
      patterns.set(pattern, existing);
    }

    // Pattern: ST_Intersects avec tables spécifiques
    const intersectMatch = entry.match(/ST_Intersects\s*\(\s*(\w+)\.geom\s*,\s*(\w+)\.geom\s*\)/i);
    if (intersectMatch) {
      const pattern = `ST_Intersects ${intersectMatch[1]} x ${intersectMatch[2]}`;
      const existing = patterns.get(pattern) || { count: 0, examples: [] };
      existing.count++;
      if (existing.examples.length < 3) existing.examples.push(entry);
      patterns.set(pattern, existing);
    }
  }

  // Filtrer les patterns qui apparaissent >= 3 fois
  const results: PatternMatch[] = [];

  for (const [pattern, data] of patterns) {
    if (data.count >= 3) {
      results.push({
        pattern,
        count: data.count,
        examples: data.examples,
        suggestedFunction: generateFunctionSuggestion(pattern, data.examples)
      });
    }
  }

  return results.sort((a, b) => b.count - a.count);
}

function generateFunctionSuggestion(pattern: string, examples: string[]): string {
  // Génère une suggestion de fonction basée sur le pattern
  if (pattern.startsWith('SELECT FROM')) {
    const [, table] = pattern.match(/SELECT FROM (\w+\.\w+)/) || [];
    return `-- Fonction pour interroger ${table}
CREATE OR REPLACE FUNCTION query_${table?.replace('.', '_')}(condition TEXT DEFAULT '1=1')
RETURNS TABLE(...) AS $$
BEGIN
  RETURN QUERY EXECUTE format('SELECT * FROM ${table} WHERE %s', condition);
END;
$$ LANGUAGE plpgsql;`;
  }

  if (pattern.startsWith('ST_Intersects')) {
    const match = pattern.match(/ST_Intersects (\w+) x (\w+)/);
    if (match) {
      return `-- Fonction d'intersection ${match[1]} x ${match[2]}
CREATE OR REPLACE FUNCTION intersect_${match[1]}_${match[2]}()
RETURNS TABLE(...) AS $$
  SELECT a.*, b.*
  FROM ${match[1]} a
  JOIN ${match[2]} b ON ST_Intersects(a.geom, b.geom);
$$ LANGUAGE sql;`;
    }
  }

  return '-- Pattern détecté, fonction à créer manuellement';
}
