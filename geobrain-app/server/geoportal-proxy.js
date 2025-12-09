/**
 * GeoBrain - Proxy Geoportail Bussigny
 *
 * Ce module gere l'authentification et le proxy des requetes vers geo.bussigny.ch
 * Il permet d'acceder aux couches protegees depuis GeoBrain.
 *
 * Architecture :
 * 1. Login : Recupere csrf_token, POST credentials, stocke cookies
 * 2. Proxy : Transmet les requetes WMS avec les cookies de session
 * 3. Refresh : Renouvelle la session si expiree
 */

import fetch from 'node-fetch';
import { CookieJar } from 'tough-cookie';
import fetchCookie from 'fetch-cookie';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const GEOPORTAL_BASE = 'https://geo.bussigny.ch';
const AUTH_URL = `${GEOPORTAL_BASE}/auth/login`;
const CREDENTIALS_FILE = path.join(__dirname, '..', '..', '.geobrain', 'geoportal-credentials.json');

// Session storage (en memoire)
let sessionData = {
  cookieJar: null,
  fetchWithCookies: null,
  isAuthenticated: false,
  username: null,
  lastLogin: null,
  expiresAt: null
};

/**
 * Initialise une nouvelle session avec cookie jar
 */
function initSession() {
  sessionData.cookieJar = new CookieJar();
  sessionData.fetchWithCookies = fetchCookie(fetch, sessionData.cookieJar);
  sessionData.isAuthenticated = false;
}

/**
 * Charge les credentials stockes localement
 */
async function loadStoredCredentials() {
  try {
    const data = await fs.readFile(CREDENTIALS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

/**
 * Sauvegarde les credentials localement (chiffres basiquement)
 * Note: En production, utiliser un vrai systeme de chiffrement
 */
async function saveCredentials(username, password, remember = false) {
  if (!remember) return;

  const dir = path.dirname(CREDENTIALS_FILE);
  await fs.mkdir(dir, { recursive: true });

  // Encodage basique (a ameliorer avec crypto)
  const encoded = Buffer.from(JSON.stringify({ username, password })).toString('base64');
  await fs.writeFile(CREDENTIALS_FILE, JSON.stringify({
    data: encoded,
    savedAt: new Date().toISOString()
  }));
}

/**
 * Recupere le token CSRF depuis la page de login
 */
async function getCsrfToken() {
  initSession();

  try {
    const response = await sessionData.fetchWithCookies(AUTH_URL, {
      method: 'GET',
      headers: {
        'User-Agent': 'GeoBrain/1.0',
        'Accept': 'text/html'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get login page: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const csrfToken = $('input[name="csrf_token"]').val();

    if (!csrfToken) {
      throw new Error('CSRF token not found in login page');
    }

    return csrfToken;
  } catch (error) {
    console.error('Error getting CSRF token:', error);
    throw error;
  }
}

/**
 * Authentification au geoportail
 */
export async function login(username, password, remember = false) {
  try {
    console.log(`[Geoportal] Attempting login for user: ${username}`);

    // 1. Recuperer le CSRF token
    const csrfToken = await getCsrfToken();
    console.log('[Geoportal] CSRF token obtained');

    // 2. Soumettre le formulaire de login
    const formData = new URLSearchParams();
    formData.append('csrf_token', csrfToken);
    formData.append('username', username);
    formData.append('password', password);

    const response = await sessionData.fetchWithCookies(AUTH_URL, {
      method: 'POST',
      headers: {
        'User-Agent': 'GeoBrain/1.0',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml',
        'Origin': GEOPORTAL_BASE,
        'Referer': AUTH_URL
      },
      body: formData.toString(),
      redirect: 'manual' // Important: gerer la redirection manuellement
    });

    // 3. Verifier le resultat
    // Un login reussi retourne 302 (redirect)
    // Un echec retourne 200 avec la page de login
    if (response.status === 302 || response.status === 301) {
      console.log('[Geoportal] Login successful (redirect received)');

      sessionData.isAuthenticated = true;
      sessionData.username = username;
      sessionData.lastLogin = new Date();
      sessionData.expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8h par defaut

      // Sauvegarder les credentials si demande
      await saveCredentials(username, password, remember);

      return {
        success: true,
        username: username,
        message: 'Connexion reussie'
      };
    } else {
      // Verifier si c'est une erreur d'authentification
      const html = await response.text();
      if (html.includes('Invalid') || html.includes('incorrect') || html.includes('error')) {
        throw new Error('Identifiants incorrects');
      }
      throw new Error(`Login failed with status ${response.status}`);
    }

  } catch (error) {
    console.error('[Geoportal] Login error:', error.message);
    sessionData.isAuthenticated = false;
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Deconnexion
 */
export function logout() {
  initSession();
  return { success: true, message: 'Deconnecte' };
}

/**
 * Verifie si la session est active
 */
export function isAuthenticated() {
  if (!sessionData.isAuthenticated) return false;
  if (sessionData.expiresAt && new Date() > sessionData.expiresAt) {
    sessionData.isAuthenticated = false;
    return false;
  }
  return true;
}

/**
 * Retourne le statut de la session
 */
export function getSessionStatus() {
  return {
    isAuthenticated: isAuthenticated(),
    username: sessionData.username,
    lastLogin: sessionData.lastLogin,
    expiresAt: sessionData.expiresAt
  };
}

/**
 * Proxy une requete vers le geoportail avec les cookies de session
 */
export async function proxyRequest(targetPath, options = {}) {
  if (!isAuthenticated()) {
    // Tenter une reconnexion avec les credentials stockes
    const stored = await loadStoredCredentials();
    if (stored) {
      const decoded = JSON.parse(Buffer.from(stored.data, 'base64').toString());
      const result = await login(decoded.username, decoded.password);
      if (!result.success) {
        throw new Error('Session expiree, veuillez vous reconnecter');
      }
    } else {
      throw new Error('Non authentifie');
    }
  }

  const url = `${GEOPORTAL_BASE}${targetPath}`;
  console.log(`[Geoportal Proxy] ${options.method || 'GET'} ${url}`);

  try {
    const response = await sessionData.fetchWithCookies(url, {
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'GeoBrain/1.0',
        ...options.headers
      }
    });

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: response.body,
      buffer: await response.buffer()
    };
  } catch (error) {
    console.error('[Geoportal Proxy] Error:', error);
    throw error;
  }
}

/**
 * Proxy specifique pour les requetes WMS GetMap (retourne une image)
 */
export async function proxyWmsGetMap(theme, params) {
  const searchParams = new URLSearchParams(params);
  const path = `/ows/${theme}?${searchParams.toString()}`;

  return proxyRequest(path, {
    headers: {
      'Accept': 'image/png,image/jpeg,image/*'
    }
  });
}

/**
 * Recupere les capabilities WMS d'un theme
 */
export async function getWmsCapabilities(theme) {
  const path = `/ows/${theme}?SERVICE=WMS&REQUEST=GetCapabilities`;

  // Les capabilities sont souvent publiques
  try {
    const response = await fetch(`${GEOPORTAL_BASE}${path}`);
    return await response.text();
  } catch (error) {
    // Si echec, essayer avec authentification
    const result = await proxyRequest(path);
    return result.buffer.toString();
  }
}

// Initialiser une session vide au demarrage
initSession();

export default {
  login,
  logout,
  isAuthenticated,
  getSessionStatus,
  proxyRequest,
  proxyWmsGetMap,
  getWmsCapabilities
};
