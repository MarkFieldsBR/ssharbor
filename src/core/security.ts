import * as os from 'os';
import * as path from 'path';
import { ValidationResult, QuickConnectParsed } from '../types';

/**
 * Validate hostname/IP
 */
export function isValidHost(host: string): boolean {
  if (!host || typeof host !== 'string') return false;
  // Allow: alphanumeric, dots, hyphens (domain/IP format)
  return /^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/.test(host);
}

/**
 * Validate SSH username
 */
export function isValidUser(user: string): boolean {
  if (!user || typeof user !== 'string') return false;
  // Allow: alphanumeric, underscore, hyphen (POSIX username)
  return /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(user);
}

/**
 * Validate port number
 */
export function isValidPort(port: number | string): boolean {
  const p = typeof port === 'string' ? parseInt(port, 10) : port;
  return !isNaN(p) && p > 0 && p <= 65535;
}

/**
 * Validate identity file path
 * Prevents path traversal attacks by ensuring the resolved path is within allowed directories
 */
export function isValidIdentityFile(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') return false;

  // Basic character validation
  if (!/^[~\/][a-zA-Z0-9._\/-]*$/.test(filePath)) {
    return false;
  }

  // Expand ~ to home directory for validation
  let expandedPath = filePath;
  if (filePath.startsWith('~')) {
    expandedPath = filePath.replace(/^~/, os.homedir());
  }

  // Resolve the path to detect path traversal attempts
  const resolvedPath = path.resolve(expandedPath);
  const homeDir = os.homedir();
  const sshDir = path.join(homeDir, '.ssh');

  // Path must be within ~/.ssh/ directory or home directory
  // This prevents accessing files like /etc/passwd via ../../
  const isInSshDir = resolvedPath.startsWith(sshDir + path.sep) || resolvedPath === sshDir;
  const isInHomeDir = resolvedPath.startsWith(homeDir + path.sep);

  // Also check for common safe patterns
  const isSafePattern =
    filePath.startsWith('~/.ssh/') ||
    filePath.startsWith('/home/') ||
    filePath.startsWith('/Users/');

  // Must not contain path traversal sequences
  if (filePath.includes('..')) {
    return false;
  }

  return isInSshDir || (isInHomeDir && isSafePattern);
}

/**
 * Sanitize input string - remove dangerous shell characters
 */
export function sanitize(input: string): string {
  if (typeof input !== 'string') return '';
  // Remove dangerous characters for shell commands
  return input.replace(/[;&|`$(){}[\]<>\\'"!#\n\r]/g, '');
}

/**
 * Validate connection info
 */
export function validateConnectionInfo(info: {
  host: string;
  user: string;
  port: number;
  identityFile?: string;
}): ValidationResult {
  if (!isValidHost(info.host)) {
    return { valid: false, error: `Invalid host: ${info.host}` };
  }

  if (!isValidUser(info.user)) {
    return { valid: false, error: `Invalid user: ${info.user}` };
  }

  if (!isValidPort(info.port)) {
    return { valid: false, error: `Invalid port: ${info.port}` };
  }

  if (info.identityFile && !isValidIdentityFile(info.identityFile)) {
    return { valid: false, error: `Invalid identity file path: ${info.identityFile}` };
  }

  return { valid: true };
}

/**
 * Parse quick connect string
 * Formats: user@host:port, user@host, host:port, host
 */
export function parseQuickConnect(input: string): QuickConnectParsed | null {
  const trimmed = sanitize(input.trim());
  if (!trimmed) return null;

  // Pattern: [user@]host[:port]
  const match = trimmed.match(/^(?:([^@]+)@)?([^:]+)(?::(\d+))?$/);
  if (!match) return null;

  const [, user, host, portStr] = match;

  if (!isValidHost(host)) return null;
  if (user && !isValidUser(user)) return null;

  const port = portStr ? parseInt(portStr, 10) : undefined;
  if (port !== undefined && !isValidPort(port)) return null;

  return {
    user: user || undefined,
    host,
    port,
  };
}

/**
 * Validate fleet name
 */
export function isValidFleetName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  // Allow: alphanumeric, spaces, hyphens, underscores (user-friendly names)
  return /^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/.test(name) && name.length <= 50;
}

/**
 * Validate vessel name
 */
export function isValidVesselName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  // Allow: alphanumeric, spaces, hyphens, underscores, dots
  return /^[a-zA-Z0-9][a-zA-Z0-9 _.-]*$/.test(name) && name.length <= 50;
}

/**
 * Validate tag
 */
export function isValidTag(tag: string): boolean {
  if (!tag || typeof tag !== 'string') return false;
  // Allow: alphanumeric, hyphens (lowercase preferred for tags)
  return /^[a-zA-Z0-9-]+$/.test(tag) && tag.length <= 30;
}
