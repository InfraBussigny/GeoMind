/**
 * Service de recherche universelle pour les portails cartographiques
 * Parse les requêtes et génère des URLs adaptées pour chaque portail
 */

import { get } from 'svelte/store';
import { portalConfig, type PortalConfig, type QueryType } from '$lib/stores/portalConfig';

// Types de requêtes supportées
export interface ParsedQuery {
  type: QueryType;
  commune?: string;
  parcelle?: string;
  adresse?: string;
  rue?: string;
  numero?: string;
  npa?: string;
  coordX?: number;
  coordY?: number;
  lieu?: string;
  raw: string;
}

// Résultat de recherche pour un portail
export interface PortalSearchResult {
  portalId: string;
  portalName: string;
  tabId: string;
  url: string | null;
  supported: boolean;
  method: 'url' | 'api' | 'manual';
  description: string;
  isRelevant: boolean;
  isDefault: boolean;
  order: number;
  icon: string;
}

// Liste des communes vaudoises (principales)
const COMMUNES_VD = [
  'Bussigny', 'Lausanne', 'Renens', 'Prilly', 'Écublens', 'Crissier',
  'Chavannes', 'Saint-Sulpice', 'Villars-Sainte-Croix', 'Bremblens',
  'Denges', 'Échandens', 'Lonay', 'Préverenges', 'Tolochenaz',
  'Morges', 'Nyon', 'Vevey', 'Montreux', 'Yverdon', 'Pully', 'Lutry'
];

// Code OFS des communes (exemples)
const COMMUNE_OFS: Record<string, string> = {
  'bussigny': '5624',
  'lausanne': '5586',
  'renens': '5591',
  'prilly': '5590',
  'ecublens': '5518',
  'crissier': '5514'
};

/**
 * Parse une requête utilisateur en composants structurés
 */
export function parseQuery(query: string): ParsedQuery {
  const raw = query.trim();
  const normalized = raw.toLowerCase();

  // Pattern: coordonnées MN95 (ex: "2538000 1152000" ou "2538000, 1152000")
  const coordPattern = /(\d{6,7})[,\s]+(\d{6,7})/;
  const coordMatch = normalized.match(coordPattern);
  if (coordMatch) {
    const x = parseInt(coordMatch[1]);
    const y = parseInt(coordMatch[2]);
    // Vérifier si c'est du MN95 (X: 2480000-2840000, Y: 1070000-1300000)
    if (x >= 2480000 && x <= 2840000 && y >= 1070000 && y <= 1300000) {
      return { type: 'coordonnees', coordX: x, coordY: y, raw };
    }
  }

  // Pattern: parcelle avec commune (ex: "Bussigny parcelle 791", "Bussigny 791", "parcelle 791 Bussigny")
  const parcellePatterns = [
    /(\w+)\s+(?:parcelle|parc\.?|p\.?)\s*(\d+)/i,
    /(?:parcelle|parc\.?|p\.?)\s*(\d+)\s+(\w+)/i,
    /(\w+)\s+(\d+)(?:\s|$)/i  // Simple: "Bussigny 791"
  ];

  for (const pattern of parcellePatterns) {
    const match = raw.match(pattern);
    if (match) {
      let commune = match[1];
      let parcelle = match[2];

      // Si le pattern a inversé l'ordre
      if (pattern === parcellePatterns[1]) {
        parcelle = match[1];
        commune = match[2];
      }

      // Vérifier si c'est une commune connue
      const communeNorm = commune.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const isCommune = COMMUNES_VD.some(c =>
        c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === communeNorm
      );

      if (isCommune) {
        // Capitaliser la commune
        const communeMatch = COMMUNES_VD.find(c =>
          c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === communeNorm
        );
        return {
          type: 'parcelle',
          commune: communeMatch || commune,
          parcelle,
          raw
        };
      }
    }
  }

  // Pattern: adresse (ex: "Rue de Lausanne 15, Bussigny" ou "15 rue de Lausanne Bussigny")
  const adressePatterns = [
    /(.+?)\s+(\d+[a-z]?)\s*,?\s*(\d{4})?\s*(\w+)?$/i,
    /(\d+[a-z]?)\s+(.+?)\s*,?\s*(\d{4})?\s*(\w+)?$/i
  ];

  for (const pattern of adressePatterns) {
    const match = raw.match(pattern);
    if (match && match[1] && match[2]) {
      // Détecter si c'est une rue
      const part1 = match[1].toLowerCase();
      const isRue = /^(rue|avenue|av\.|chemin|ch\.|route|rte\.|place|pl\.|boulevard|bd\.)/i.test(part1);

      if (isRue || pattern === adressePatterns[1]) {
        return {
          type: 'adresse',
          rue: pattern === adressePatterns[0] ? match[1] : match[2],
          numero: pattern === adressePatterns[0] ? match[2] : match[1],
          npa: match[3],
          commune: match[4],
          adresse: raw,
          raw
        };
      }
    }
  }

  // Pattern: commune seule
  const communeNorm = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const matchedCommune = COMMUNES_VD.find(c =>
    c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === communeNorm
  );
  if (matchedCommune) {
    return { type: 'commune', commune: matchedCommune, raw };
  }

  // Par défaut: lieu/texte libre
  return { type: 'lieu', lieu: raw, raw };
}

/**
 * Génère les URLs de recherche pour chaque portail
 */
export function generateSearchUrls(parsed: ParsedQuery): PortalSearchResult[] {
  const results: PortalSearchResult[] = [];

  // 1. Swisstopo (map.geo.admin.ch)
  results.push(generateSwisstopoUrl(parsed));

  // 2. Geoportail VD
  results.push(generateGeoportailVDUrl(parsed));

  // 3. RDPPF VD
  results.push(generateRDPPFUrl(parsed));

  // 4. Intercapi (Registre foncier)
  results.push(generateIntercapiUrl(parsed));

  // 5. Capitastra
  results.push(generateCapitrastraUrl(parsed));

  // 6. Géoportail Bussigny
  results.push(generateGeoportailBussignyUrl(parsed));

  return results;
}

function generateSwisstopoUrl(parsed: ParsedQuery): PortalSearchResult {
  const base = 'https://map.geo.admin.ch/#/map?lang=fr&topic=ech&bgLayer=ch.swisstopo.pixelkarte-farbe';

  let url: string | null = null;
  let description = '';

  switch (parsed.type) {
    case 'coordonnees':
      url = `${base}&center=${parsed.coordX},${parsed.coordY}&z=13`;
      description = `Centrer sur ${parsed.coordX}, ${parsed.coordY}`;
      break;
    case 'parcelle':
      url = `${base}&swisssearch=${encodeURIComponent(`${parsed.commune} parcelle ${parsed.parcelle}`)}`;
      description = `Recherche parcelle ${parsed.parcelle} à ${parsed.commune}`;
      break;
    case 'adresse':
      url = `${base}&swisssearch=${encodeURIComponent(parsed.adresse || parsed.raw)}`;
      description = `Recherche adresse`;
      break;
    case 'commune':
      url = `${base}&swisssearch=${encodeURIComponent(parsed.commune!)}`;
      description = `Recherche commune ${parsed.commune}`;
      break;
    case 'lieu':
    default:
      url = `${base}&swisssearch=${encodeURIComponent(parsed.raw)}`;
      description = `Recherche "${parsed.raw}"`;
  }

  return {
    portalId: 'swisstopo',
    portalName: 'Swisstopo',
    tabId: 'swisstopo',
    url,
    supported: true,
    method: 'url',
    description,
    isRelevant: false,
    isDefault: false,
    order: 0,
    icon: 'mountain'
  };
}

function generateGeoportailVDUrl(parsed: ParsedQuery): PortalSearchResult {
  const base = 'https://www.geo.vd.ch';

  let url: string | null = null;
  let description = '';

  // Geoportail VD utilise des paramètres URL pour la recherche
  switch (parsed.type) {
    case 'parcelle':
      // Format: /theme/localisation/?parcelle=COMMUNE-NUMERO
      url = `${base}/theme/localisation_thematique/?map_x=&map_y=&map_zoom=&parcelle=${parsed.commune}-${parsed.parcelle}`;
      description = `Parcelle ${parsed.parcelle} à ${parsed.commune}`;
      break;
    case 'coordonnees':
      url = `${base}/theme/localisation_thematique/?map_x=${parsed.coordX}&map_y=${parsed.coordY}&map_zoom=10`;
      description = `Coordonnées ${parsed.coordX}, ${parsed.coordY}`;
      break;
    case 'adresse':
    case 'commune':
    case 'lieu':
      // Recherche textuelle
      url = `${base}/?searchText=${encodeURIComponent(parsed.raw)}`;
      description = `Recherche "${parsed.raw}"`;
      break;
    default:
      url = `${base}/?searchText=${encodeURIComponent(parsed.raw)}`;
      description = `Recherche "${parsed.raw}"`;
  }

  return {
    portalId: 'geovd',
    portalName: 'Geoportail VD',
    tabId: 'geovd',
    url,
    supported: true,
    method: 'url',
    description,
    isRelevant: false,
    isDefault: false,
    order: 0,
    icon: 'map'
  };
}

function generateRDPPFUrl(parsed: ParsedQuery): PortalSearchResult {
  const base = 'https://www.rdppf.vd.ch';

  let url: string | null = null;
  let description = '';
  let supported = true;

  switch (parsed.type) {
    case 'parcelle':
      // RDPPF a un format spécifique pour les parcelles
      const ofsCode = COMMUNE_OFS[parsed.commune?.toLowerCase() || ''] || '';
      if (ofsCode) {
        url = `${base}/portail.aspx?no_commune=${ofsCode}&no_parcelle=${parsed.parcelle}`;
        description = `RDPPF parcelle ${parsed.parcelle} à ${parsed.commune}`;
      } else {
        url = `${base}/portail.aspx`;
        description = `Recherche manuelle requise (commune ${parsed.commune})`;
      }
      break;
    case 'commune':
      const communeOfs = COMMUNE_OFS[parsed.commune?.toLowerCase() || ''];
      if (communeOfs) {
        url = `${base}/portail.aspx?no_commune=${communeOfs}`;
        description = `RDPPF commune ${parsed.commune}`;
      } else {
        url = `${base}/portail.aspx`;
        description = `Recherche manuelle requise`;
      }
      break;
    default:
      url = `${base}/portail.aspx`;
      description = 'RDPPF - Recherche manuelle';
      supported = false;
  }

  return {
    portalId: 'rdppf',
    portalName: 'RDPPF VD',
    tabId: 'rdppf',
    url,
    supported,
    method: 'url',
    description,
    isRelevant: false,
    isDefault: false,
    order: 0,
    icon: 'document'
  };
}

function generateIntercapiUrl(parsed: ParsedQuery): PortalSearchResult {
  const base = 'https://www.intercapi.ch';

  let url: string | null = null;
  let description = '';
  let supported = true;

  switch (parsed.type) {
    case 'parcelle':
      // Intercapi recherche par canton/commune/parcelle
      url = `${base}/recherche?canton=VD&commune=${encodeURIComponent(parsed.commune || '')}&parcelle=${parsed.parcelle}`;
      description = `RF parcelle ${parsed.parcelle} à ${parsed.commune}`;
      break;
    case 'commune':
      url = `${base}/recherche?canton=VD&commune=${encodeURIComponent(parsed.commune || '')}`;
      description = `RF commune ${parsed.commune}`;
      break;
    default:
      url = base;
      description = 'Registre foncier - Recherche manuelle';
      supported = false;
  }

  return {
    portalId: 'rf',
    portalName: 'Registre foncier',
    tabId: 'rf',
    url,
    supported,
    method: 'url',
    description,
    isRelevant: false,
    isDefault: false,
    order: 0,
    icon: 'building'
  };
}

function generateCapitrastraUrl(parsed: ParsedQuery): PortalSearchResult {
  const base = 'https://www.capitastra.vd.ch';

  let url: string | null = null;
  let description = '';
  let supported = true;

  switch (parsed.type) {
    case 'parcelle':
      // Capitastra - recherche par commune et parcelle
      url = `${base}/hrcintapp/externalCall.action?commune=${encodeURIComponent(parsed.commune || '')}&parcelle=${parsed.parcelle}`;
      description = `Capitastra parcelle ${parsed.parcelle} à ${parsed.commune}`;
      break;
    case 'commune':
      url = `${base}/hrcintapp/externalCall.action?commune=${encodeURIComponent(parsed.commune || '')}`;
      description = `Capitastra commune ${parsed.commune}`;
      break;
    default:
      url = base;
      description = 'Capitastra - Recherche manuelle';
      supported = false;
  }

  return {
    portalId: 'capitastra',
    portalName: 'Capitastra VD',
    tabId: 'capitastra',
    url,
    supported,
    method: 'url',
    description,
    isRelevant: false,
    isDefault: false,
    order: 0,
    icon: 'file-text'
  };
}

function generateGeoportailBussignyUrl(parsed: ParsedQuery): PortalSearchResult {
  const base = 'https://geo.bussigny.ch';

  let url: string | null = null;
  let description = '';

  // Le géoportail Bussigny utilise probablement des paramètres similaires
  switch (parsed.type) {
    case 'parcelle':
      if (parsed.commune?.toLowerCase() === 'bussigny') {
        url = `${base}/?parcelle=${parsed.parcelle}`;
        description = `Géoportail parcelle ${parsed.parcelle}`;
      } else {
        url = base;
        description = 'Géoportail Bussigny uniquement';
      }
      break;
    case 'coordonnees':
      url = `${base}/?x=${parsed.coordX}&y=${parsed.coordY}&zoom=10`;
      description = `Coordonnées ${parsed.coordX}, ${parsed.coordY}`;
      break;
    default:
      url = `${base}/?search=${encodeURIComponent(parsed.raw)}`;
      description = `Recherche "${parsed.raw}"`;
  }

  return {
    portalId: 'geoportail',
    portalName: 'Geoportail Bussigny',
    tabId: 'geoportail',
    url,
    supported: true,
    method: 'url',
    description,
    isRelevant: false,
    isDefault: false,
    order: 0,
    icon: 'globe'
  };
}

/**
 * Recherche universelle - parse et génère toutes les URLs
 * Retourne les résultats triés par pertinence puis par ordre utilisateur
 */
export function universalSearch(query: string): {
  parsed: ParsedQuery;
  results: PortalSearchResult[];
  relevantResults: PortalSearchResult[];
  otherResults: PortalSearchResult[];
} {
  const parsed = parseQuery(query);
  const config = get(portalConfig);
  const results = generateSearchUrls(parsed);

  // Enrichir les résultats avec les infos de config
  const enrichedResults = results.map(result => {
    const portalCfg = config.find(p => p.id === result.portalId);
    if (!portalCfg) return result;

    const isRelevant = portalCfg.relevantFor.includes(parsed.type);
    return {
      ...result,
      tabId: portalCfg.tabId,
      isRelevant,
      isDefault: portalCfg.isDefault,
      order: portalCfg.order,
      icon: portalCfg.icon
    };
  });

  // Filtrer les portails désactivés
  const enabledResults = enrichedResults.filter(r => {
    const portalCfg = config.find(p => p.id === r.portalId);
    return portalCfg?.enabled !== false;
  });

  // Séparer pertinents et non-pertinents
  const relevantResults = enabledResults
    .filter(r => r.isRelevant && r.supported)
    .sort((a, b) => {
      // Défaut en premier, puis par ordre
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.order - b.order;
    });

  const otherResults = enabledResults
    .filter(r => !r.isRelevant || !r.supported)
    .sort((a, b) => a.order - b.order);

  // Résultats complets triés
  const sortedResults = [...relevantResults, ...otherResults];

  return { parsed, results: sortedResults, relevantResults, otherResults };
}

/**
 * Obtenir le portail par défaut pour une recherche
 */
export function getDefaultPortalResult(query: string): PortalSearchResult | null {
  const { relevantResults } = universalSearch(query);
  return relevantResults.find(r => r.isDefault) || relevantResults[0] || null;
}
