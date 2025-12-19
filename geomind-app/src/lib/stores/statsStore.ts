import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

// Types
export type StatsTab = 'assainissement' | 'cadastre' | 'general';

export interface StatsKPI {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  description?: string;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
  }[];
}

export interface QueryDefinition {
  table: string;
  columns: string[];
  aggregations: { column: string; func: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' }[];
  groupBy: string[];
  filters: { column: string; operator: string; value: string }[];
  orderBy?: { column: string; direction: 'ASC' | 'DESC' };
}

export interface StatsConfig {
  id: string;
  name: string;
  theme: StatsTab;
  query: QueryDefinition;
  chartType?: 'bar' | 'pie' | 'line' | 'doughnut';
  createdAt: Date;
}

// Stores
export const activeStatsTab = writable<StatsTab>('assainissement');
export const selectedConnection = writable<string | null>(null);
export const isLoading = writable(false);
export const statsError = writable<string | null>(null);

// Données des stats par thématique
export const assainissementData = writable<{
  kpis: StatsKPI[];
  collecteursParType: ChartData | null;
  collecteursParEtat: ChartData | null;
  chambresParType: ChartData | null;
  rawData: any[];
} | null>(null);

export const cadastreData = writable<{
  kpis: StatsKPI[];
  parcellesParType: ChartData | null;
  surfacesParProprietaire: ChartData | null;
  rawData: any[];
} | null>(null);

export const generalData = writable<{
  results: any[];
  columns: string[];
  chartData: ChartData | null;
} | null>(null);

// Configurations sauvegardées
export const savedConfigs = writable<StatsConfig[]>([]);

// Charger les configs depuis localStorage
if (browser) {
  const stored = localStorage.getItem('geomind-stats-configs');
  if (stored) {
    try {
      savedConfigs.set(JSON.parse(stored));
    } catch (e) {
      console.error('Error loading stats configs:', e);
    }
  }
}

// Sauvegarder automatiquement
savedConfigs.subscribe(configs => {
  if (browser) {
    localStorage.setItem('geomind-stats-configs', JSON.stringify(configs));
  }
});

// Actions
export function addConfig(config: Omit<StatsConfig, 'id' | 'createdAt'>) {
  const newConfig: StatsConfig = {
    ...config,
    id: crypto.randomUUID(),
    createdAt: new Date()
  };
  savedConfigs.update(configs => [...configs, newConfig]);
  return newConfig;
}

export function removeConfig(id: string) {
  savedConfigs.update(configs => configs.filter(c => c.id !== id));
}

export function clearStats() {
  assainissementData.set(null);
  cadastreData.set(null);
  generalData.set(null);
  statsError.set(null);
}
