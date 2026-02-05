import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SSHConnectionInfo } from '../types';
import { validateConnectionInfo } from './security';

/**
 * Build SSH command from connection info
 */
export function buildSSHCommand(info: SSHConnectionInfo): string {
  const validation = validateConnectionInfo(info);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const parts: string[] = ['ssh'];

  // Identity file (expand ~)
  if (info.identityFile) {
    const keyPath = expandPath(info.identityFile);
    if (fs.existsSync(keyPath)) {
      parts.push('-i', keyPath);
    } else {
      console.warn(`SSHarbor: Identity file not found: ${keyPath}`);
    }
  }

  // Port (only if non-standard)
  if (info.port !== 22) {
    parts.push('-p', String(info.port));
  }

  // User@Host
  parts.push(`${info.user}@${info.host}`);

  return parts.join(' ');
}

/**
 * Build SSH command for display (doesn't check file existence)
 */
export function buildSSHCommandDisplay(info: SSHConnectionInfo): string {
  const parts: string[] = ['ssh'];

  if (info.identityFile) {
    parts.push('-i', info.identityFile);
  }

  if (info.port !== 22) {
    parts.push('-p', String(info.port));
  }

  parts.push(`${info.user}@${info.host}`);

  return parts.join(' ');
}

/**
 * Expand ~ to home directory
 */
export function expandPath(filePath: string): string {
  if (filePath.startsWith('~')) {
    return filePath.replace(/^~/, os.homedir());
  }
  return filePath;
}

/**
 * Build connection identifier for history
 */
export function buildConnectionId(info: { host: string; user: string; port: number }): string {
  return `${info.user}@${info.host}:${info.port}`;
}

/**
 * Parse connection identifier
 */
export function parseConnectionId(id: string): { host: string; user: string; port: number } | null {
  const match = id.match(/^([^@]+)@([^:]+):(\d+)$/);
  if (!match) return null;

  const [, user, host, portStr] = match;
  const port = parseInt(portStr, 10);

  return { user, host, port };
}

/**
 * Generate a unique SSH config host alias for a vessel
 */
export function generateSSHConfigAlias(info: SSHConnectionInfo): string {
  // Create a clean alias: SSHarbor_FleetName_VesselName
  const fleet = info.fleetName.replace(/[^a-zA-Z0-9]/g, '_');
  const vessel = info.name.replace(/[^a-zA-Z0-9]/g, '_');
  return `SSHarbor_${fleet}_${vessel}`;
}

/**
 * Ensure SSH config entry exists for the vessel
 * Returns the host alias to use for Remote SSH connection
 */
export function ensureSSHConfigEntry(info: SSHConnectionInfo): string {
  const sshConfigPath = path.join(os.homedir(), '.ssh', 'config');
  const alias = generateSSHConfigAlias(info);

  // Build the entry
  const entryLines: string[] = [
    `Host ${alias}`,
    `  HostName ${info.host}`,
    `  User ${info.user}`,
  ];

  if (info.port !== 22) {
    entryLines.push(`  Port ${info.port}`);
  }

  if (info.identityFile) {
    entryLines.push(`  IdentityFile ${info.identityFile}`);
  }

  entryLines.push(''); // Empty line after entry

  const newEntry = entryLines.join('\n');

  // Read existing config
  let existingConfig = '';
  try {
    existingConfig = fs.readFileSync(sshConfigPath, 'utf-8');
  } catch {
    // File doesn't exist, will create
  }

  // Check if our entry already exists
  const entryRegex = new RegExp(`^Host ${alias}$`, 'm');

  if (entryRegex.test(existingConfig)) {
    // Remove old entry and add new one
    // Match from "Host alias" to next "Host " or end of file
    const removeRegex = new RegExp(`\\n?Host ${alias}\\n(?:  [^\\n]+\\n)*`, 'g');
    existingConfig = existingConfig.replace(removeRegex, '');
  }

  // Add SSHarbor marker comment if not present
  const marker = '# === SSHarbor Managed Entries ===';
  let updatedConfig: string;

  if (existingConfig.includes(marker)) {
    // Insert after marker
    updatedConfig = existingConfig.replace(marker, `${marker}\n${newEntry}`);
  } else {
    // Add marker and entry at the end
    updatedConfig = existingConfig.trimEnd() + `\n\n${marker}\n${newEntry}`;
  }

  // Write updated config
  fs.writeFileSync(sshConfigPath, updatedConfig, 'utf-8');

  return alias;
}
