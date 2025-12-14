/**
 * Store de configuration des portails de recherche
 * Gere l'ordre, l'activation et le portail par defaut
 */
import { writable, derived, get } from 'svelte/store';

// Types de requetes supportes
export type QueryType = 'parcelle' | 'adresse' | 'commune' | 'coordonnees' | 'lieu' | 'unknown';

// Configuration d'un portail
export interface PortalConfig {
  id: string;
  name: string;
  tabId: string; // ID de l'onglet dans CanvasModule
  enabled: boolean;
  order: number;
  isDefault: boolean;
  icon: string;
  // Types de requetes pour lesquels ce portail est pertinent
  relevantFor: QueryType[];
}

// Configuration par defaut des portails
const DEFAULT_PORTALS: PortalConfig[] = [
  {
    id: 'geovd',
    name: 'Geoportail VD Pro',
    tabId: 'geovd',
    enabled: true,
    order: 0,
    isDefault: true,
    icon: 'map',
    relevantFor: ['parcelle', 'adresse', 'commune', 'coordonnees', 'lieu']
  },
  {
    id: 'swisstopo',
    name: 'Swisstopo',
    tabId: 'swisstopo',
    enabled: true,
    order: 1,
    isDefault: false,
    icon: 'mountain',
    relevantFor: ['adresse', 'commune', 'coordonnees', 'lieu']
  },
  {
    id: 'rdppf',
    name: 'RDPPF VD',
    tabId: 'rdppf',
    enabled: true,
    order: 2,
    isDefault: false,
    icon: 'document',
    relevantFor: ['parcelle', 'commune']
  },
  {
    id: 'rf',
    name: 'Registre foncier',
    tabId: 'rf',
    enabled: true,
    order: 3,
    isDefault: false,
    icon: 'building',
    relevantFor: ['parcelle', 'commune', 'adresse']
  },
  {
    id: 'capitastra',
    name: 'Capitastra VD',
    tabId: 'capitastra',
    enabled: true,
    order: 4,
    isDefault: false,
    icon: 'file-text',
    relevantFor: ['parcelle', 'commune', 'adresse']
  },
  {
    id: 'geoportail',
    name: 'Geoportail Bussigny',
    tabId: 'geoportail',
    enabled: true,
    order: 5,
    isDefault: false,
    icon: 'globe',
    relevantFor: ['parcelle', 'adresse', 'coordonnees', 'lieu']
  }
];

const STORAGE_KEY = 'geomind-portal-config';

// Charger la config depuis localStorage
function loadConfig(): PortalConfig[] {
  if (typeof window === 'undefined') return DEFAULT_PORTALS;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as PortalConfig[];
      // Merger avec les defauts pour ajouter les nouveaux portails
      const merged = DEFAULT_PORTALS.map(defaultPortal => {
        const stored = parsed.find(p => p.id === defaultPortal.id);
        if (stored) {
          return { ...defaultPortal, ...stored, relevantFor: defaultPortal.relevantFor };
        }
        return defaultPortal;
      });
      return merged.sort((a, b) => a.order - b.order);
    }
  } catch (e) {
    console.warn('Failed to load portal config:', e);
  }
  return DEFAULT_PORTALS;
}

// Sauvegarder la config dans localStorage
function saveConfig(config: PortalConfig[]) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save portal config:', e);
  }
}

// Creer le store
function createPortalConfigStore() {
  const { subscribe, set, update } = writable<PortalConfig[]>(loadConfig());

  return {
    subscribe,

    // Reinitialiser aux valeurs par defaut
    reset: () => {
      set(DEFAULT_PORTALS);
      saveConfig(DEFAULT_PORTALS);
    },

    // Activer/desactiver un portail
    toggle: (id: string) => {
      update(portals => {
        const updated = portals.map(p =>
          p.id === id ? { ...p, enabled: !p.enabled } : p
        );
        saveConfig(updated);
        return updated;
      });
    },

    // Definir comme portail par defaut
    setDefault: (id: string) => {
      update(portals => {
        const updated = portals.map(p => ({
          ...p,
          isDefault: p.id === id
        }));
        saveConfig(updated);
        return updated;
      });
    },

    // Reordonner les portails (apres drag & drop)
    reorder: (fromIndex: number, toIndex: number) => {
      update(portals => {
        const updated = [...portals];
        const [moved] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, moved);
        // Mettre a jour les ordres
        const reordered = updated.map((p, i) => ({ ...p, order: i }));
        saveConfig(reordered);
        return reordered;
      });
    },

    // Definir un nouvel ordre complet
    setOrder: (orderedIds: string[]) => {
      update(portals => {
        const updated = orderedIds
          .map((id, index) => {
            const portal = portals.find(p => p.id === id);
            return portal ? { ...portal, order: index } : null;
          })
          .filter((p): p is PortalConfig => p !== null);
        saveConfig(updated);
        return updated;
      });
    },

    // Activer un portail specifique
    enable: (id: string, enabled: boolean) => {
      update(portals => {
        const updated = portals.map(p =>
          p.id === id ? { ...p, enabled } : p
        );
        saveConfig(updated);
        return updated;
      });
    }
  };
}

export const portalConfig = createPortalConfigStore();

// Store derive: portails actifs tries par ordre
export const enabledPortals = derived(portalConfig, $config =>
  $config.filter(p => p.enabled).sort((a, b) => a.order - b.order)
);

// Store derive: portail par defaut
export const defaultPortal = derived(portalConfig, $config =>
  $config.find(p => p.isDefault && p.enabled) || $config.find(p => p.enabled) || null
);

// Fonction utilitaire: obtenir les portails pertinents pour un type de requete
export function getRelevantPortals(queryType: QueryType): PortalConfig[] {
  const config = get(portalConfig);
  return config
    .filter(p => p.enabled && p.relevantFor.includes(queryType))
    .sort((a, b) => a.order - b.order);
}

// Fonction utilitaire: obtenir les portails non pertinents pour un type de requete
export function getNonRelevantPortals(queryType: QueryType): PortalConfig[] {
  const config = get(portalConfig);
  return config
    .filter(p => p.enabled && !p.relevantFor.includes(queryType))
    .sort((a, b) => a.order - b.order);
}
