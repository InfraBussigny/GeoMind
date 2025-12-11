/**
 * GeoMind Memory Service
 * Système de mémoire à 3 niveaux pour l'assistant IA
 *
 * Niveaux:
 * 1. Immédiate - Conversation courante (RAM)
 * 2. Session - Persiste jusqu'à fermeture app (sessionStorage)
 * 3. Persistante - Permanent (localStorage + fichier backend)
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';

// ============================================
// Types
// ============================================

export interface MemoryItem {
  id: string;
  type: 'fact' | 'preference' | 'context' | 'instruction' | 'entity';
  content: string;
  source: 'user' | 'assistant' | 'system';
  timestamp: Date;
  relevance: number; // 0-1, décroît avec le temps
  accessCount: number;
  lastAccessed: Date;
  tags: string[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface MemoryStats {
  immediate: { count: number; sizeKb: number };
  session: { count: number; sizeKb: number };
  persistent: { count: number; sizeKb: number };
  totalSizeKb: number;
}

// ============================================
// Constants
// ============================================

const STORAGE_KEYS = {
  SESSION: 'geobrain_session_memory',
  PERSISTENT: 'geobrain_persistent_memory',
  PREFERENCES: 'geobrain_preferences',
  CONVERSATION_HISTORY: 'geobrain_conversation_history'
};

const MAX_IMMEDIATE_MESSAGES = 50;
const MAX_SESSION_ITEMS = 100;
const MAX_PERSISTENT_ITEMS = 500;
const RELEVANCE_DECAY_RATE = 0.01; // Par heure

// ============================================
// Stores
// ============================================

// Mémoire immédiate (conversation courante)
export const immediateMemory = writable<ConversationMessage[]>([]);

// Mémoire de session
export const sessionMemory = writable<MemoryItem[]>([]);

// Mémoire persistante
export const persistentMemory = writable<MemoryItem[]>([]);

// Préférences utilisateur (persistantes)
export const userPreferences = writable<Record<string, unknown>>({});

// Stats dérivées
export const memoryStats = derived(
  [immediateMemory, sessionMemory, persistentMemory],
  ([$immediate, $session, $persistent]) => {
    const calcSize = (data: unknown) => new Blob([JSON.stringify(data)]).size / 1024;

    const stats: MemoryStats = {
      immediate: { count: $immediate.length, sizeKb: calcSize($immediate) },
      session: { count: $session.length, sizeKb: calcSize($session) },
      persistent: { count: $persistent.length, sizeKb: calcSize($persistent) },
      totalSizeKb: 0
    };

    stats.totalSizeKb = stats.immediate.sizeKb + stats.session.sizeKb + stats.persistent.sizeKb;
    return stats;
  }
);

// ============================================
// Initialization
// ============================================

export function initializeMemory(): void {
  if (!browser) return;

  // Charger la mémoire de session
  try {
    const sessionData = sessionStorage.getItem(STORAGE_KEYS.SESSION);
    if (sessionData) {
      const items = JSON.parse(sessionData) as MemoryItem[];
      sessionMemory.set(items.map(item => ({
        ...item,
        timestamp: new Date(item.timestamp),
        lastAccessed: new Date(item.lastAccessed)
      })));
    }
  } catch (e) {
    console.warn('Failed to load session memory:', e);
  }

  // Charger la mémoire persistante
  try {
    const persistentData = localStorage.getItem(STORAGE_KEYS.PERSISTENT);
    if (persistentData) {
      const items = JSON.parse(persistentData) as MemoryItem[];
      persistentMemory.set(items.map(item => ({
        ...item,
        timestamp: new Date(item.timestamp),
        lastAccessed: new Date(item.lastAccessed)
      })));
    }
  } catch (e) {
    console.warn('Failed to load persistent memory:', e);
  }

  // Charger les préférences
  try {
    const prefsData = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    if (prefsData) {
      userPreferences.set(JSON.parse(prefsData));
    }
  } catch (e) {
    console.warn('Failed to load preferences:', e);
  }

  // Auto-save sur changement
  sessionMemory.subscribe(items => {
    if (browser && items.length > 0) {
      sessionStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(items));
    }
  });

  persistentMemory.subscribe(items => {
    if (browser && items.length > 0) {
      localStorage.setItem(STORAGE_KEYS.PERSISTENT, JSON.stringify(items));
    }
  });

  userPreferences.subscribe(prefs => {
    if (browser && Object.keys(prefs).length > 0) {
      localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(prefs));
    }
  });

  // Appliquer la décroissance de pertinence périodiquement
  setInterval(applyRelevanceDecay, 60000); // Toutes les minutes
}

// ============================================
// Immediate Memory (Conversation)
// ============================================

export function addToConversation(role: 'user' | 'assistant' | 'system', content: string): void {
  immediateMemory.update(messages => {
    const newMessages = [...messages, {
      role,
      content,
      timestamp: new Date()
    }];

    // Garder seulement les derniers messages
    if (newMessages.length > MAX_IMMEDIATE_MESSAGES) {
      // Extraire les informations importantes avant de supprimer
      const removed = newMessages.slice(0, newMessages.length - MAX_IMMEDIATE_MESSAGES);
      extractAndPromote(removed);
      return newMessages.slice(-MAX_IMMEDIATE_MESSAGES);
    }

    return newMessages;
  });
}

export function getConversationContext(maxMessages = 20): ConversationMessage[] {
  return get(immediateMemory).slice(-maxMessages);
}

export function clearConversation(): void {
  // Extraire les informations importantes avant de clear
  const current = get(immediateMemory);
  if (current.length > 0) {
    extractAndPromote(current);
  }
  immediateMemory.set([]);
}

// ============================================
// Session Memory
// ============================================

export function addToSession(item: Omit<MemoryItem, 'id' | 'timestamp' | 'relevance' | 'accessCount' | 'lastAccessed'>): void {
  const newItem: MemoryItem = {
    ...item,
    id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    relevance: 1.0,
    accessCount: 0,
    lastAccessed: new Date()
  };

  sessionMemory.update(items => {
    // Vérifier les doublons
    const existing = items.find(i => i.content === newItem.content);
    if (existing) {
      existing.relevance = Math.min(1, existing.relevance + 0.1);
      existing.accessCount++;
      existing.lastAccessed = new Date();
      return [...items];
    }

    const newItems = [...items, newItem];

    // Limiter la taille
    if (newItems.length > MAX_SESSION_ITEMS) {
      return pruneMemory(newItems, MAX_SESSION_ITEMS);
    }

    return newItems;
  });
}

export function searchSession(query: string, limit = 10): MemoryItem[] {
  const items = get(sessionMemory);
  const queryLower = query.toLowerCase();

  return items
    .filter(item =>
      item.content.toLowerCase().includes(queryLower) ||
      item.tags.some(tag => tag.toLowerCase().includes(queryLower))
    )
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit)
    .map(item => {
      // Augmenter le compteur d'accès
      item.accessCount++;
      item.lastAccessed = new Date();
      item.relevance = Math.min(1, item.relevance + 0.05);
      return item;
    });
}

// ============================================
// Persistent Memory
// ============================================

export function addToPersistent(item: Omit<MemoryItem, 'id' | 'timestamp' | 'relevance' | 'accessCount' | 'lastAccessed'>): void {
  const newItem: MemoryItem = {
    ...item,
    id: `persistent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    relevance: 1.0,
    accessCount: 0,
    lastAccessed: new Date()
  };

  persistentMemory.update(items => {
    // Vérifier les doublons
    const existing = items.find(i => i.content === newItem.content);
    if (existing) {
      existing.relevance = Math.min(1, existing.relevance + 0.1);
      existing.accessCount++;
      existing.lastAccessed = new Date();
      return [...items];
    }

    const newItems = [...items, newItem];

    if (newItems.length > MAX_PERSISTENT_ITEMS) {
      return pruneMemory(newItems, MAX_PERSISTENT_ITEMS);
    }

    return newItems;
  });
}

export function searchPersistent(query: string, limit = 10): MemoryItem[] {
  const items = get(persistentMemory);
  const queryLower = query.toLowerCase();

  return items
    .filter(item =>
      item.content.toLowerCase().includes(queryLower) ||
      item.tags.some(tag => tag.toLowerCase().includes(queryLower))
    )
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);
}

export function removeFromPersistent(id: string): void {
  persistentMemory.update(items => items.filter(i => i.id !== id));
}

// ============================================
// Preferences
// ============================================

export function setPreference(key: string, value: unknown): void {
  userPreferences.update(prefs => ({ ...prefs, [key]: value }));
}

export function getPreference<T>(key: string, defaultValue: T): T {
  const prefs = get(userPreferences);
  return (prefs[key] as T) ?? defaultValue;
}

// ============================================
// Memory Management
// ============================================

function pruneMemory(items: MemoryItem[], maxItems: number): MemoryItem[] {
  // Trier par score composite (pertinence + accès + âge)
  return items
    .sort((a, b) => {
      const scoreA = calculateMemoryScore(a);
      const scoreB = calculateMemoryScore(b);
      return scoreB - scoreA;
    })
    .slice(0, maxItems);
}

function calculateMemoryScore(item: MemoryItem): number {
  const ageHours = (Date.now() - item.timestamp.getTime()) / (1000 * 60 * 60);
  const ageFactor = Math.exp(-ageHours * 0.01); // Décroissance exponentielle
  const accessFactor = Math.log(item.accessCount + 1) / 10;

  return (item.relevance * 0.5) + (ageFactor * 0.3) + (accessFactor * 0.2);
}

function applyRelevanceDecay(): void {
  const now = Date.now();

  sessionMemory.update(items =>
    items.map(item => {
      const hoursSinceAccess = (now - item.lastAccessed.getTime()) / (1000 * 60 * 60);
      item.relevance = Math.max(0.1, item.relevance - (hoursSinceAccess * RELEVANCE_DECAY_RATE));
      return item;
    })
  );

  persistentMemory.update(items =>
    items.map(item => {
      const hoursSinceAccess = (now - item.lastAccessed.getTime()) / (1000 * 60 * 60);
      item.relevance = Math.max(0.1, item.relevance - (hoursSinceAccess * RELEVANCE_DECAY_RATE * 0.5)); // Decay plus lent
      return item;
    })
  );
}

// ============================================
// Auto-extraction et promotion
// ============================================

function extractAndPromote(messages: ConversationMessage[]): void {
  // Patterns pour extraire des informations importantes
  const patterns = {
    preference: /(?:je préfère|j'aime|je veux toujours|par défaut|utiliser|configurer)/i,
    fact: /(?:le|la|les|ce|cette|mon|ma|mes|notre|nos)\s+\w+\s+(?:est|sont|s'appelle|se trouve)/i,
    instruction: /(?:rappelle-toi|n'oublie pas|retiens|mémorise|toujours|jamais)/i,
    entity: /(?:@\w+|#\w+|\b[A-Z][a-z]+\s+[A-Z][a-z]+\b)/ // Noms propres, @mentions, #tags
  };

  for (const msg of messages) {
    if (msg.role !== 'user') continue;

    const content = msg.content;

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(content)) {
        addToSession({
          type: type as MemoryItem['type'],
          content: content.slice(0, 500), // Limiter la taille
          source: 'user',
          tags: extractTags(content)
        });
        break; // Un seul type par message
      }
    }
  }
}

function extractTags(content: string): string[] {
  const tags: string[] = [];

  // Extraire les hashtags
  const hashtags = content.match(/#\w+/g);
  if (hashtags) tags.push(...hashtags);

  // Extraire les mots-clés importants (noms propres, acronymes)
  const keywords = content.match(/\b[A-Z][A-Z]+\b|\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g);
  if (keywords) tags.push(...keywords.slice(0, 5));

  return [...new Set(tags)]; // Dédupliquer
}

// ============================================
// Context Builder pour l'API
// ============================================

export function buildContextForAPI(query: string): string {
  const contextParts: string[] = [];

  // 1. Préférences utilisateur pertinentes
  const prefs = get(userPreferences);
  if (Object.keys(prefs).length > 0) {
    contextParts.push(`[Préférences utilisateur: ${JSON.stringify(prefs)}]`);
  }

  // 2. Mémoire persistante pertinente
  const relevantPersistent = searchPersistent(query, 5);
  if (relevantPersistent.length > 0) {
    const facts = relevantPersistent.map(i => i.content).join('\n- ');
    contextParts.push(`[Informations mémorisées:\n- ${facts}]`);
  }

  // 3. Mémoire de session pertinente
  const relevantSession = searchSession(query, 3);
  if (relevantSession.length > 0) {
    const sessionFacts = relevantSession.map(i => i.content).join('\n- ');
    contextParts.push(`[Contexte de session:\n- ${sessionFacts}]`);
  }

  return contextParts.join('\n\n');
}

// ============================================
// Export/Import
// ============================================

export function exportMemory(): string {
  return JSON.stringify({
    session: get(sessionMemory),
    persistent: get(persistentMemory),
    preferences: get(userPreferences),
    exportDate: new Date().toISOString()
  }, null, 2);
}

export function importMemory(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);

    if (data.session) {
      sessionMemory.set(data.session.map((item: MemoryItem) => ({
        ...item,
        timestamp: new Date(item.timestamp),
        lastAccessed: new Date(item.lastAccessed)
      })));
    }

    if (data.persistent) {
      persistentMemory.set(data.persistent.map((item: MemoryItem) => ({
        ...item,
        timestamp: new Date(item.timestamp),
        lastAccessed: new Date(item.lastAccessed)
      })));
    }

    if (data.preferences) {
      userPreferences.set(data.preferences);
    }

    return true;
  } catch (e) {
    console.error('Failed to import memory:', e);
    return false;
  }
}

// ============================================
// Cleanup
// ============================================

export function clearSessionMemory(): void {
  sessionMemory.set([]);
  if (browser) {
    sessionStorage.removeItem(STORAGE_KEYS.SESSION);
  }
}

export function clearPersistentMemory(): void {
  persistentMemory.set([]);
  if (browser) {
    localStorage.removeItem(STORAGE_KEYS.PERSISTENT);
  }
}

export function clearAllMemory(): void {
  immediateMemory.set([]);
  clearSessionMemory();
  clearPersistentMemory();
  userPreferences.set({});
  if (browser) {
    localStorage.removeItem(STORAGE_KEYS.PREFERENCES);
  }
}

// ============================================
// Defragmentation
// ============================================

export function defragmentMemory(): { merged: number; removed: number } {
  let merged = 0;
  let removed = 0;

  // Fusionner les items similaires dans la mémoire persistante
  persistentMemory.update(items => {
    const seen = new Map<string, MemoryItem>();

    for (const item of items) {
      const key = item.content.toLowerCase().trim();

      if (seen.has(key)) {
        // Fusionner avec l'existant
        const existing = seen.get(key)!;
        existing.relevance = Math.min(1, existing.relevance + item.relevance * 0.5);
        existing.accessCount += item.accessCount;
        existing.tags = [...new Set([...existing.tags, ...item.tags])];
        merged++;
      } else if (item.relevance < 0.2) {
        // Supprimer les items de faible pertinence
        removed++;
      } else {
        seen.set(key, item);
      }
    }

    return Array.from(seen.values());
  });

  return { merged, removed };
}
