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

// Code OFS des communes vaudoises (complet pour les communes courantes)
const COMMUNE_OFS: Record<string, string> = {
  'bussigny': '5624',
  'lausanne': '5586',
  'renens': '5591',
  'prilly': '5590',
  'ecublens': '5518',
  'crissier': '5514',
  'chavannes': '5511',
  'saint-sulpice': '5598',
  'villars-sainte-croix': '5690',
  'bremblens': '5504',
  'denges': '5632',
  'echandens': '5517',
  'lonay': '5652',
  'preverenges': '5665',
  'tolochenaz': '5680',
  'morges': '5642',
  'nyon': '5724',
  'vevey': '5890',
  'montreux': '5886',
  'yverdon': '5938',
  'pully': '5589',
  'lutry': '5585'
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

  // PRIORITE 1: Adresses (commencent par un préfixe de rue)
  // Doit être vérifié AVANT les parcelles pour éviter "Rue de Lausanne 15" -> parcelle
  const ruePrefix = /^(rue|avenue|av\.?|chemin|ch\.?|route|rte\.?|place|pl\.?|boulevard|bd\.?|passage|impasse|allee|sentier)\s+/i;
  if (ruePrefix.test(raw)) {
    // C'est une adresse qui commence par un type de voie
    const adresseMatch = raw.match(/^(.+?)\s+(\d+[a-z]?)\s*,?\s*(\d{4})?\s*(\w+)?$/i);
    if (adresseMatch) {
      return {
        type: 'adresse',
        rue: adresseMatch[1],
        numero: adresseMatch[2],
        npa: adresseMatch[3],
        commune: adresseMatch[4],
        adresse: raw,
        raw
      };
    }
    // Même sans numéro, c'est une adresse
    return {
      type: 'adresse',
      adresse: raw,
      raw
    };
  }

  // Adresse commençant par un numéro (ex: "15 rue de Lausanne")
  const numeroFirst = raw.match(/^(\d+[a-z]?)\s+(rue|avenue|av\.?|chemin|ch\.?|route|rte\.?|place|pl\.?|boulevard|bd\.?)\s+(.+?)(?:\s*,?\s*(\d{4})?\s*(\w+)?)?$/i);
  if (numeroFirst) {
    return {
      type: 'adresse',
      numero: numeroFirst[1],
      rue: `${numeroFirst[2]} ${numeroFirst[3]}`,
      npa: numeroFirst[4],
      commune: numeroFirst[5],
      adresse: raw,
      raw
    };
  }

  // PRIORITE 2: Parcelle avec mot-clé explicite (ex: "Bussigny parcelle 791", "parcelle 791 Bussigny")
  const parcelleExplicite = [
    /(\w+)\s+(?:parcelle|parc\.?)\s*(\d+)/i,
    /(?:parcelle|parc\.?)\s*(\d+)\s+(\w+)/i
  ];

  for (let i = 0; i < parcelleExplicite.length; i++) {
    const pattern = parcelleExplicite[i];
    const match = raw.match(pattern);
    if (match) {
      let commune = match[1];
      let parcelle = match[2];

      // Si le pattern a inversé l'ordre
      if (i === 1) {
        parcelle = match[1];
        commune = match[2];
      }

      // Vérifier si c'est une commune connue
      const communeNorm = commune.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const communeMatch = COMMUNES_VD.find(c =>
        c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === communeNorm
      );

      if (communeMatch) {
        return {
          type: 'parcelle',
          commune: communeMatch,
          parcelle,
          raw
        };
      }
    }
  }

  // PRIORITE 3: Parcelle simple "Commune Numero" (ex: "Bussigny 791")
  // Seulement si c'est exactement "Mot Numero" sans rien d'autre
  const parcelleSimple = raw.match(/^(\w+)\s+(\d+)$/i);
  if (parcelleSimple) {
    const communeNorm = parcelleSimple[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const communeMatch = COMMUNES_VD.find(c =>
      c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === communeNorm
    );
    if (communeMatch) {
      return {
        type: 'parcelle',
        commune: communeMatch,
        parcelle: parcelleSimple[2],
        raw
      };
    }
  }

  // PRIORITE 4: Commune seule
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
 * Note: Seuls les portails supportant la recherche par URL sont inclus
 */
export function generateSearchUrls(parsed: ParsedQuery): PortalSearchResult[] {
  const results: PortalSearchResult[] = [];

  // 1. Swisstopo (map.geo.admin.ch) - supporte swisssearch=
  results.push(generateSwisstopoUrl(parsed));

  // 2. RDPPF VD - supporte no_commune= et no_parcelle=
  results.push(generateRDPPFUrl(parsed));

  // 3. Géoportail Bussigny (QWC2) - supporte st=, c=, s=
  results.push(generateGeoportailBussignyUrl(parsed));

  // Note: Geoportail VD Pro, Intercapi et Capitastra ne supportent pas
  // la recherche par URL et sont exclus des suggestions

  return results;
}

function generateSwisstopoUrl(parsed: ParsedQuery): PortalSearchResult {
  // Swisstopo map.geo.admin.ch - nouveau format URL (2024+)
  // Documentation: https://api3.geo.admin.ch/
  const base = 'https://map.geo.admin.ch';

  let url: string | null = null;
  let description = '';

  switch (parsed.type) {
    case 'coordonnees':
      // Format: /#/map?center=X,Y&z=zoom (MN95)
      url = `${base}/#/map?lang=fr&center=${parsed.coordX},${parsed.coordY}&z=12&bgLayer=ch.swisstopo.pixelkarte-farbe`;
      description = `Centre sur ${parsed.coordX}, ${parsed.coordY}`;
      break;
    case 'parcelle':
      // Utiliser swisssearch pour parcelle
      url = `${base}/#/map?lang=fr&bgLayer=ch.swisstopo.pixelkarte-farbe&swisssearch=${encodeURIComponent(`${parsed.commune} ${parsed.parcelle}`)}`;
      description = `Parcelle ${parsed.parcelle} a ${parsed.commune}`;
      break;
    case 'adresse':
      // Recherche adresse textuelle
      const adresseSearch = parsed.adresse || `${parsed.rue} ${parsed.numero} ${parsed.commune || ''}`.trim();
      url = `${base}/#/map?lang=fr&bgLayer=ch.swisstopo.pixelkarte-farbe&swisssearch=${encodeURIComponent(adresseSearch)}`;
      description = `Adresse: ${adresseSearch}`;
      break;
    case 'commune':
      url = `${base}/#/map?lang=fr&bgLayer=ch.swisstopo.pixelkarte-farbe&swisssearch=${encodeURIComponent(parsed.commune!)}`;
      description = `Commune ${parsed.commune}`;
      break;
    case 'lieu':
    default:
      url = `${base}/#/map?lang=fr&bgLayer=ch.swisstopo.pixelkarte-farbe&swisssearch=${encodeURIComponent(parsed.raw)}`;
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
  // geoportail.vd.ch - Guichet professionnel cantonal vaudois
  // URL de base: /map.htm avec parametre mapresources pour les themes
  // Note: Ce portail ne supporte pas de parametres de recherche directe dans l'URL
  const base = 'https://www.geoportail.vd.ch/map.htm';

  let url: string | null = null;
  let description = '';

  switch (parsed.type) {
    case 'parcelle':
      // Ouvrir avec le theme cadastre/localisation
      url = base;
      description = `Parcelle ${parsed.parcelle} a ${parsed.commune} (recherche manuelle)`;
      break;
    case 'coordonnees':
      // Le guichet pro ne supporte pas les coordonnees en URL directe
      url = base;
      description = `Coord. ${parsed.coordX}, ${parsed.coordY} (recherche manuelle)`;
      break;
    case 'adresse':
      const adresse = parsed.adresse || `${parsed.rue || ''} ${parsed.numero || ''} ${parsed.commune || ''}`.trim();
      url = base;
      description = `Adresse: ${adresse} (recherche manuelle)`;
      break;
    case 'commune':
      url = base;
      description = `Commune ${parsed.commune} (recherche manuelle)`;
      break;
    case 'lieu':
    default:
      url = base;
      description = `Recherche "${parsed.raw}" (manuelle)`;
  }

  return {
    portalId: 'geovd',
    portalName: 'Geoportail VD Pro',
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
  // RDPPF VD - Registre des restrictions de droit public à la propriété foncière
  // Format: /portail.aspx?no_commune=OFS&no_parcelle=NUMERO
  const base = 'https://www.rdppf.vd.ch';

  let url: string | null = null;
  let description = '';
  let supported = true;

  // Normaliser le nom de commune pour la recherche OFS
  const communeNorm = parsed.commune?.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-') || '';
  const ofsCode = COMMUNE_OFS[communeNorm] || '';

  switch (parsed.type) {
    case 'parcelle':
      if (ofsCode) {
        url = `${base}/portail.aspx?no_commune=${ofsCode}&no_parcelle=${parsed.parcelle}`;
        description = `RDPPF parcelle ${parsed.parcelle} a ${parsed.commune}`;
      } else {
        // Sans code OFS, on ouvre le portail avec juste le numéro de parcelle
        url = `${base}/portail.aspx`;
        description = `RDPPF - Commune "${parsed.commune}" non trouvee`;
        supported = false;
      }
      break;
    case 'commune':
      if (ofsCode) {
        url = `${base}/portail.aspx?no_commune=${ofsCode}`;
        description = `RDPPF commune ${parsed.commune}`;
      } else {
        url = `${base}/portail.aspx`;
        description = `RDPPF - Commune non trouvee`;
        supported = false;
      }
      break;
    case 'coordonnees':
      // RDPPF ne supporte pas directement les coordonnées
      url = `${base}/portail.aspx`;
      description = 'RDPPF - Coordonnees non supportees';
      supported = false;
      break;
    case 'adresse':
    case 'lieu':
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
  // Intercapi.ch - Portail intercommunal du Registre foncier VD
  // Note: Ce portail nécessite souvent une authentification
  // Format URL de base, la recherche se fait via l'interface
  const base = 'https://www.intercapi.ch';

  let url: string | null = null;
  let description = '';
  let supported = true;

  switch (parsed.type) {
    case 'parcelle':
      // Intercapi peut accepter des paramètres de recherche directe
      // Format: commune en minuscule, numéro de parcelle
      const communeLower = parsed.commune?.toLowerCase() || '';
      url = `${base}/immo_search.php?commune=${encodeURIComponent(communeLower)}&parcelle=${parsed.parcelle}`;
      description = `RF parcelle ${parsed.parcelle} a ${parsed.commune}`;
      break;
    case 'commune':
      url = `${base}/immo_search.php?commune=${encodeURIComponent(parsed.commune?.toLowerCase() || '')}`;
      description = `RF commune ${parsed.commune}`;
      break;
    case 'adresse':
      // Recherche par adresse
      const adresse = parsed.adresse || `${parsed.rue || ''} ${parsed.numero || ''}`.trim();
      url = `${base}/immo_search.php?adresse=${encodeURIComponent(adresse)}`;
      description = `RF adresse: ${adresse}`;
      break;
    case 'coordonnees':
    case 'lieu':
    default:
      url = base;
      description = 'RF - Recherche manuelle';
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
  // Capitastra.vd.ch - Système d'information cadastral vaudois
  // Format: /hrcintapp/externalCall.action avec paramètres
  const base = 'https://www.capitastra.vd.ch';

  let url: string | null = null;
  let description = '';
  let supported = true;

  // Normaliser le nom de commune
  const communeNorm = parsed.commune?.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
  const ofsCode = COMMUNE_OFS[communeNorm] || '';

  switch (parsed.type) {
    case 'parcelle':
      if (ofsCode) {
        // Capitastra utilise le code OFS et numéro de parcelle
        url = `${base}/hrcintapp/externalCall.action?noOfsCommune=${ofsCode}&noParcelle=${parsed.parcelle}`;
        description = `Capitastra parcelle ${parsed.parcelle} a ${parsed.commune}`;
      } else {
        // Sans code OFS, utiliser le nom de commune
        url = `${base}/hrcintapp/externalCall.action?commune=${encodeURIComponent(parsed.commune || '')}&noParcelle=${parsed.parcelle}`;
        description = `Capitastra parcelle ${parsed.parcelle}`;
      }
      break;
    case 'commune':
      if (ofsCode) {
        url = `${base}/hrcintapp/externalCall.action?noOfsCommune=${ofsCode}`;
        description = `Capitastra commune ${parsed.commune}`;
      } else {
        url = `${base}/hrcintapp/externalCall.action?commune=${encodeURIComponent(parsed.commune || '')}`;
        description = `Capitastra commune ${parsed.commune}`;
      }
      break;
    case 'adresse':
      // Capitastra peut rechercher par adresse
      const adresse = parsed.adresse || `${parsed.rue || ''} ${parsed.numero || ''}`.trim();
      url = `${base}/hrcintapp/externalCall.action?adresse=${encodeURIComponent(adresse)}`;
      description = `Capitastra adresse: ${adresse}`;
      break;
    case 'coordonnees':
    case 'lieu':
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
  // geo.bussigny.ch utilise QWC2 (QGIS Web Client 2)
  // Parametres URL QWC2:
  // - st=search text (recherche textuelle)
  // - c=x,y (center - coordonnees MN95)
  // - s=scale (echelle)
  // - e=minx,miny,maxx,maxy (extent)
  const base = 'https://geo.bussigny.ch';

  let url: string | null = null;
  let description = '';

  switch (parsed.type) {
    case 'parcelle':
      // Pour les parcelles de Bussigny, on peut chercher directement le numero
      // Pour les autres communes, on prefixe avec le nom de commune
      const isBussigny = parsed.commune?.toLowerCase() === 'bussigny';
      const searchText = isBussigny
        ? `${parsed.parcelle}`  // Juste le numero pour Bussigny
        : `${parsed.commune} ${parsed.parcelle}`;  // Commune + numero pour les autres
      url = `${base}/?st=${encodeURIComponent(searchText)}`;
      description = isBussigny
        ? `Parcelle ${parsed.parcelle} a Bussigny`
        : `Parcelle ${parsed.parcelle} a ${parsed.commune}`;
      break;
    case 'coordonnees':
      // QWC2: c=x,y pour centrer, s=scale (1000 = environ 1:1000)
      url = `${base}/?c=${parsed.coordX},${parsed.coordY}&s=1000`;
      description = `Centre sur ${parsed.coordX}, ${parsed.coordY}`;
      break;
    case 'adresse':
      // Recherche adresse via st=
      const adresse = parsed.adresse || `${parsed.rue || ''} ${parsed.numero || ''}`.trim();
      url = `${base}/?st=${encodeURIComponent(adresse)}`;
      description = `Adresse: ${adresse}`;
      break;
    case 'commune':
      // Recherche commune (centrer sur Bussigny ou rechercher autre commune)
      url = `${base}/?st=${encodeURIComponent(parsed.commune!)}`;
      description = `Commune ${parsed.commune}`;
      break;
    case 'lieu':
    default:
      // Recherche libre
      url = `${base}/?st=${encodeURIComponent(parsed.raw)}`;
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
