/**
 * GeoBrain SSH Service
 * Gestion des connexions SSH, tunnels et SFTP via le backend
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

// ============================================
// Types
// ============================================

export interface SSHConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  password?: string;
  privateKeyPath?: string;
  passphrase?: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastConnected?: Date;
  category?: string;
}

export interface SSHTunnel {
  id: string;
  connectionId: string;
  name: string;
  type: 'local' | 'remote' | 'dynamic';
  localPort: number;
  remoteHost: string;
  remotePort: number;
  status: 'inactive' | 'active' | 'error';
  autoConnect: boolean;
}

export interface SFTPEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  modifiedAt: Date;
  permissions: string;
  owner: string;
}

export interface TerminalSession {
  id: string;
  connectionId: string;
  status: 'active' | 'closed';
  createdAt: Date;
}

// ============================================
// Constants
// ============================================

const API_BASE = 'http://localhost:3001/api';
const STORAGE_KEY = 'geobrain_ssh_connections';
const TUNNELS_KEY = 'geobrain_ssh_tunnels';

// ============================================
// Connections Store
// ============================================

function loadConnections(): SSHConnection[] {
  if (!browser) return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function createSSHStore() {
  const { subscribe, set, update } = writable<SSHConnection[]>(loadConnections());

  // Auto-save (without passwords)
  if (browser) {
    subscribe(connections => {
      const toSave = connections.map(c => ({
        ...c,
        password: undefined, // Don't persist passwords
        passphrase: undefined,
        status: 'disconnected' as const
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    });
  }

  return {
    subscribe,

    add(connection: Omit<SSHConnection, 'id' | 'status'>) {
      const newConn: SSHConnection = {
        ...connection,
        id: `ssh_${Date.now()}`,
        status: 'disconnected'
      };
      update(conns => [...conns, newConn]);
      return newConn.id;
    },

    update(id: string, changes: Partial<SSHConnection>) {
      update(conns => conns.map(c =>
        c.id === id ? { ...c, ...changes } : c
      ));
    },

    remove(id: string) {
      update(conns => conns.filter(c => c.id !== id));
    },

    setStatus(id: string, status: SSHConnection['status']) {
      update(conns => conns.map(c =>
        c.id === id ? { ...c, status } : c
      ));
    },

    getById(id: string): SSHConnection | undefined {
      return get({ subscribe }).find(c => c.id === id);
    }
  };
}

export const sshStore = createSSHStore();

// ============================================
// Tunnels Store
// ============================================

function loadTunnels(): SSHTunnel[] {
  if (!browser) return [];
  try {
    const stored = localStorage.getItem(TUNNELS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function createTunnelsStore() {
  const { subscribe, set, update } = writable<SSHTunnel[]>(loadTunnels());

  if (browser) {
    subscribe(tunnels => {
      const toSave = tunnels.map(t => ({ ...t, status: 'inactive' as const }));
      localStorage.setItem(TUNNELS_KEY, JSON.stringify(toSave));
    });
  }

  return {
    subscribe,

    add(tunnel: Omit<SSHTunnel, 'id' | 'status'>) {
      const newTunnel: SSHTunnel = {
        ...tunnel,
        id: `tunnel_${Date.now()}`,
        status: 'inactive'
      };
      update(tunnels => [...tunnels, newTunnel]);
      return newTunnel.id;
    },

    remove(id: string) {
      update(tunnels => tunnels.filter(t => t.id !== id));
    },

    setStatus(id: string, status: SSHTunnel['status']) {
      update(tunnels => tunnels.map(t =>
        t.id === id ? { ...t, status } : t
      ));
    },

    getByConnection(connectionId: string): SSHTunnel[] {
      return get({ subscribe }).filter(t => t.connectionId === connectionId);
    }
  };
}

export const tunnelsStore = createTunnelsStore();

// ============================================
// API Functions
// ============================================

/**
 * Test SSH connection
 */
export async function testSSHConnection(connection: SSHConnection): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/ssh/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: connection.host,
        port: connection.port,
        username: connection.username,
        authType: connection.authType,
        password: connection.password,
        privateKeyPath: connection.privateKeyPath,
        passphrase: connection.passphrase
      })
    });

    const result = await response.json();
    return result;
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Connect to SSH server
 */
export async function connectSSH(connectionId: string, credentials?: { password?: string; passphrase?: string }): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  const connection = sshStore.getById(connectionId);
  if (!connection) return { success: false, error: 'Connection not found' };

  sshStore.setStatus(connectionId, 'connecting');

  try {
    const response = await fetch(`${API_BASE}/ssh/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connectionId,
        host: connection.host,
        port: connection.port,
        username: connection.username,
        authType: connection.authType,
        password: credentials?.password || connection.password,
        privateKeyPath: connection.privateKeyPath,
        passphrase: credentials?.passphrase || connection.passphrase
      })
    });

    const result = await response.json();

    if (result.success) {
      sshStore.setStatus(connectionId, 'connected');
      sshStore.update(connectionId, { lastConnected: new Date() });
    } else {
      sshStore.setStatus(connectionId, 'error');
    }

    return result;
  } catch (error) {
    sshStore.setStatus(connectionId, 'error');
    return { success: false, error: String(error) };
  }
}

/**
 * Disconnect SSH
 */
export async function disconnectSSH(connectionId: string): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${API_BASE}/ssh/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId })
    });

    const result = await response.json();
    sshStore.setStatus(connectionId, 'disconnected');
    return result;
  } catch (error) {
    return { success: false };
  }
}

/**
 * Execute command via SSH
 */
export async function executeSSHCommand(connectionId: string, command: string): Promise<{ success: boolean; stdout?: string; stderr?: string; exitCode?: number; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/ssh/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId, command })
    });

    return await response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Start SSH tunnel
 */
export async function startTunnel(tunnelId: string): Promise<{ success: boolean; error?: string }> {
  const tunnels = get(tunnelsStore);
  const tunnel = tunnels.find(t => t.id === tunnelId);
  if (!tunnel) return { success: false, error: 'Tunnel not found' };

  const connection = sshStore.getById(tunnel.connectionId);
  if (!connection) return { success: false, error: 'Connection not found' };

  try {
    const response = await fetch(`${API_BASE}/ssh/tunnel/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tunnelId,
        connectionId: tunnel.connectionId,
        type: tunnel.type,
        localPort: tunnel.localPort,
        remoteHost: tunnel.remoteHost,
        remotePort: tunnel.remotePort
      })
    });

    const result = await response.json();

    if (result.success) {
      tunnelsStore.setStatus(tunnelId, 'active');
    } else {
      tunnelsStore.setStatus(tunnelId, 'error');
    }

    return result;
  } catch (error) {
    tunnelsStore.setStatus(tunnelId, 'error');
    return { success: false, error: String(error) };
  }
}

/**
 * Stop SSH tunnel
 */
export async function stopTunnel(tunnelId: string): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${API_BASE}/ssh/tunnel/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tunnelId })
    });

    const result = await response.json();
    tunnelsStore.setStatus(tunnelId, 'inactive');
    return result;
  } catch (error) {
    return { success: false };
  }
}

// ============================================
// SFTP Functions
// ============================================

/**
 * List directory via SFTP
 */
export async function sftpList(connectionId: string, path: string): Promise<{ success: boolean; entries?: SFTPEntry[]; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/ssh/sftp/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId, path })
    });

    const result = await response.json();

    if (result.success && result.entries) {
      result.entries = result.entries.map((e: SFTPEntry) => ({
        ...e,
        modifiedAt: new Date(e.modifiedAt)
      }));
    }

    return result;
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Download file via SFTP
 */
export async function sftpDownload(connectionId: string, remotePath: string): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/ssh/sftp/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId, path: remotePath })
    });

    return await response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Upload file via SFTP
 */
export async function sftpUpload(connectionId: string, remotePath: string, content: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/ssh/sftp/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId, path: remotePath, content })
    });

    return await response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Delete file/directory via SFTP
 */
export async function sftpDelete(connectionId: string, path: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/ssh/sftp/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId, path })
    });

    return await response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ============================================
// Predefined Connections (Bussigny infrastructure)
// ============================================

export const PREDEFINED_CONNECTIONS: Omit<SSHConnection, 'id' | 'status'>[] = [
  {
    name: 'SRV-FME',
    host: 'srv-fme.bussigny.local',
    port: 22,
    username: '',
    authType: 'password',
    category: 'Serveurs Bussigny'
  },
  {
    name: 'SRV-SAI',
    host: 'srv-sai.bussigny.local',
    port: 22,
    username: '',
    authType: 'password',
    category: 'Serveurs Bussigny'
  },
  {
    name: 'Exoscale (Géoportail)',
    host: 'geo.bussigny.ch',
    port: 22,
    username: '',
    authType: 'key',
    category: 'Cloud'
  }
];

// ============================================
// Common Tunnel Templates
// ============================================

export const TUNNEL_TEMPLATES = [
  {
    name: 'PostgreSQL via SRV-FME',
    type: 'local' as const,
    localPort: 15432,
    remoteHost: 'localhost',
    remotePort: 5432,
    description: 'Accès PostgreSQL local via tunnel SSH'
  },
  {
    name: 'Oracle via SRV-SAI',
    type: 'local' as const,
    localPort: 11521,
    remoteHost: 'localhost',
    remotePort: 1521,
    description: 'Accès Oracle local via tunnel SSH'
  },
  {
    name: 'QGIS Server',
    type: 'local' as const,
    localPort: 18080,
    remoteHost: 'localhost',
    remotePort: 80,
    description: 'Accès QGIS Server via tunnel'
  }
];

// ============================================
// Utilities
// ============================================

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatPermissions(perms: string): string {
  // Convert numeric permissions to rwx format
  if (/^\d+$/.test(perms)) {
    const map: Record<string, string> = {
      '0': '---', '1': '--x', '2': '-w-', '3': '-wx',
      '4': 'r--', '5': 'r-x', '6': 'rw-', '7': 'rwx'
    };
    return perms.split('').map(d => map[d] || '---').join('');
  }
  return perms;
}
