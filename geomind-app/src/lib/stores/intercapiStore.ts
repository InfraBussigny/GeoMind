/**
 * Store Intercapi - Gestion du module Registre Foncier
 * Historique des recherches, favoris, et configuration
 */
import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';

// Types
export interface IntercapiSearch {
  id: string;
  type: 'parcelle' | 'adresse' | 'proprietaire' | 'egrid';
  query: string;
  commune?: string;
  parcelle?: string;
  timestamp: number;
  label?: string;
}

export interface IntercapiFavorite {
  id: string;
  type: 'parcelle' | 'immeuble';
  commune: string;
  parcelle: string;
  egrid?: string;
  label: string;
  notes?: string;
  addedAt: number;
}

export interface IntercapiConfig {
  // URL de base Intercapi
  baseUrl: string;
  // Dernière commune utilisée (pour pré-remplir)
  lastCommune: string;
  // Afficher la barre de recherche rapide
  showQuickSearch: boolean;
  // Nombre max d'éléments dans l'historique
  maxHistory: number;
  // Zoom automatique sur la parcelle après recherche
  autoZoom: boolean;
}

interface IntercapiState {
  config: IntercapiConfig;
  history: IntercapiSearch[];
  favorites: IntercapiFavorite[];
  isLoading: boolean;
  lastError: string | null;
  currentSearch: IntercapiSearch | null;
}

// Configuration par défaut
const DEFAULT_CONFIG: IntercapiConfig = {
  baseUrl: 'https://intercapi.vd.ch/territoire/intercapi/ui/home/dashboard',
  lastCommune: 'Bussigny',
  showQuickSearch: true,
  maxHistory: 50,
  autoZoom: true
};

const STORAGE_KEY = 'geomind-intercapi';

// Charger depuis localStorage
function loadState(): IntercapiState {
  const defaultState: IntercapiState = {
    config: DEFAULT_CONFIG,
    history: [],
    favorites: [],
    isLoading: false,
    lastError: null,
    currentSearch: null
  };

  if (!browser) return defaultState;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...defaultState,
        config: { ...DEFAULT_CONFIG, ...parsed.config },
        history: parsed.history || [],
        favorites: parsed.favorites || []
      };
    }
  } catch (e) {
    console.warn('Failed to load Intercapi state:', e);
  }

  return defaultState;
}

// Sauvegarder dans localStorage
function saveState(state: IntercapiState) {
  if (!browser) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      config: state.config,
      history: state.history,
      favorites: state.favorites
    }));
  } catch (e) {
    console.warn('Failed to save Intercapi state:', e);
  }
}

// Générer un ID unique
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Créer le store
function createIntercapiStore() {
  const { subscribe, set, update } = writable<IntercapiState>(loadState());

  return {
    subscribe,

    // === Configuration ===
    updateConfig: (partial: Partial<IntercapiConfig>) => {
      update(state => {
        const newState = {
          ...state,
          config: { ...state.config, ...partial }
        };
        saveState(newState);
        return newState;
      });
    },

    setLastCommune: (commune: string) => {
      update(state => {
        const newState = {
          ...state,
          config: { ...state.config, lastCommune: commune }
        };
        saveState(newState);
        return newState;
      });
    },

    // === Historique ===
    addToHistory: (search: Omit<IntercapiSearch, 'id' | 'timestamp'>) => {
      update(state => {
        const newSearch: IntercapiSearch = {
          ...search,
          id: generateId(),
          timestamp: Date.now()
        };

        // Éviter les doublons consécutifs
        const lastSearch = state.history[0];
        if (lastSearch && lastSearch.query === search.query && lastSearch.type === search.type) {
          return state;
        }

        const newHistory = [newSearch, ...state.history].slice(0, state.config.maxHistory);
        const newState = {
          ...state,
          history: newHistory,
          currentSearch: newSearch
        };
        saveState(newState);
        return newState;
      });
    },

    removeFromHistory: (id: string) => {
      update(state => {
        const newState = {
          ...state,
          history: state.history.filter(h => h.id !== id)
        };
        saveState(newState);
        return newState;
      });
    },

    clearHistory: () => {
      update(state => {
        const newState = { ...state, history: [] };
        saveState(newState);
        return newState;
      });
    },

    // === Favoris ===
    addFavorite: (favorite: Omit<IntercapiFavorite, 'id' | 'addedAt'>) => {
      update(state => {
        // Vérifier si déjà en favori
        const exists = state.favorites.some(
          f => f.commune === favorite.commune && f.parcelle === favorite.parcelle
        );
        if (exists) return state;

        const newFavorite: IntercapiFavorite = {
          ...favorite,
          id: generateId(),
          addedAt: Date.now()
        };

        const newState = {
          ...state,
          favorites: [...state.favorites, newFavorite]
        };
        saveState(newState);
        return newState;
      });
    },

    removeFavorite: (id: string) => {
      update(state => {
        const newState = {
          ...state,
          favorites: state.favorites.filter(f => f.id !== id)
        };
        saveState(newState);
        return newState;
      });
    },

    updateFavoriteNotes: (id: string, notes: string) => {
      update(state => {
        const newState = {
          ...state,
          favorites: state.favorites.map(f =>
            f.id === id ? { ...f, notes } : f
          )
        };
        saveState(newState);
        return newState;
      });
    },

    isFavorite: (commune: string, parcelle: string): boolean => {
      const state = get({ subscribe });
      return state.favorites.some(
        f => f.commune === commune && f.parcelle === parcelle
      );
    },

    // === État de chargement ===
    setLoading: (loading: boolean) => {
      update(state => ({ ...state, isLoading: loading }));
    },

    setError: (error: string | null) => {
      update(state => ({ ...state, lastError: error }));
    },

    setCurrentSearch: (search: IntercapiSearch | null) => {
      update(state => ({ ...state, currentSearch: search }));
    },

    // === Reset ===
    reset: () => {
      const defaultState: IntercapiState = {
        config: DEFAULT_CONFIG,
        history: [],
        favorites: [],
        isLoading: false,
        lastError: null,
        currentSearch: null
      };
      set(defaultState);
      saveState(defaultState);
    }
  };
}

export const intercapiStore = createIntercapiStore();

// Stores dérivés
export const intercapiHistory = derived(intercapiStore, $store => $store.history);
export const intercapiFavorites = derived(intercapiStore, $store => $store.favorites);
export const intercapiConfig = derived(intercapiStore, $store => $store.config);

// === Utilitaires de recherche ===

// Liste des communes vaudoises avec code OFS
export const COMMUNES_VD: Record<string, string> = {
  'bussigny': '5624',
  'lausanne': '5586',
  'prilly': '5589',
  'renens': '5591',
  'ecublens': '5518',
  'crissier': '5515',
  'chavannes-pres-renens': '5512',
  'villars-sainte-croix': '5544',
  'romanel-sur-lausanne': '5592',
  'cheseaux-sur-lausanne': '5513',
  'jouxtens-mezery': '5524',
  'le-mont-sur-lausanne': '5525',
  'epalinges': '5519',
  'pully': '5590',
  'lutry': '5583',
  'paudex': '5588',
  'belmont-sur-lausanne': '5582',
  'bourg-en-lavaux': '5606',
  'morges': '5642',
  'etoy': '5683',
  'aubonne': '5422',
  'rolle': '5490',
  'nyon': '5724',
  'gland': '5721',
  'vevey': '5890',
  'montreux': '5886',
  'yverdon-les-bains': '5938',
  'payerne': '5822',
  'moudon': '5765',
  'orbe': '5748',
  'grandson': '5554'
};

// Normaliser un nom de commune
export function normalizeCommune(commune: string): string {
  return commune
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Obtenir le code OFS d'une commune
export function getOfsCode(commune: string): string | null {
  const normalized = normalizeCommune(commune);
  return COMMUNES_VD[normalized] || null;
}

// Construire l'URL Intercapi pour une recherche
export function buildIntercapiUrl(
  type: 'parcelle' | 'adresse' | 'proprietaire' | 'egrid',
  params: {
    commune?: string;
    parcelle?: string;
    adresse?: string;
    proprietaire?: string;
    egrid?: string;
  }
): string {
  const baseUrl = 'https://intercapi.vd.ch/territoire/intercapi/ui/home/dashboard';

  // Intercapi utilise des paramètres d'URL pour la navigation
  // Format observé: /search?type=xxx&...
  const searchParams = new URLSearchParams();

  switch (type) {
    case 'parcelle':
      if (params.commune) {
        const ofsCode = getOfsCode(params.commune);
        if (ofsCode) {
          searchParams.set('noOfsCommune', ofsCode);
        } else {
          searchParams.set('commune', params.commune);
        }
      }
      if (params.parcelle) {
        searchParams.set('noParcelle', params.parcelle);
      }
      break;

    case 'adresse':
      if (params.adresse) {
        searchParams.set('adresse', params.adresse);
      }
      if (params.commune) {
        searchParams.set('commune', params.commune);
      }
      break;

    case 'proprietaire':
      if (params.proprietaire) {
        searchParams.set('proprietaire', params.proprietaire);
      }
      break;

    case 'egrid':
      if (params.egrid) {
        searchParams.set('egrid', params.egrid);
      }
      break;
  }

  const queryString = searchParams.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

// Parser une recherche textuelle
export function parseSearchQuery(query: string): {
  type: 'parcelle' | 'adresse' | 'egrid' | 'unknown';
  commune?: string;
  parcelle?: string;
  adresse?: string;
  egrid?: string;
} {
  const trimmed = query.trim();

  // E-GRID: Format CH + 15 caractères
  const egridMatch = trimmed.match(/^(CH[A-Z0-9]{15})$/i);
  if (egridMatch) {
    return { type: 'egrid', egrid: egridMatch[1].toUpperCase() };
  }

  // Parcelle: numéro seul ou avec commune
  // Format: "123" ou "Bussigny 123" ou "123 Bussigny"
  const parcelleMatch = trimmed.match(/^(?:(\w[\w\s-]*?)\s+)?(\d+)(?:\s+(\w[\w\s-]*))?$/i);
  if (parcelleMatch) {
    const commune = parcelleMatch[1] || parcelleMatch[3];
    return {
      type: 'parcelle',
      parcelle: parcelleMatch[2],
      commune: commune?.trim()
    };
  }

  // Adresse: contient un numéro suivi de texte ou texte suivi de numéro
  const adresseMatch = trimmed.match(/^(.+?\s+\d+|\d+\s+.+)$/);
  if (adresseMatch && trimmed.length > 5) {
    return { type: 'adresse', adresse: trimmed };
  }

  return { type: 'unknown' };
}
