import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import {
  isValidHost,
  isValidUser,
  isValidPort,
  isValidIdentityFile,
  sanitize,
  validateConnectionInfo,
  parseQuickConnect,
  isValidFleetName,
  isValidVesselName,
  isValidTag,
} from '../security';

// Mock os.homedir for consistent tests
vi.mock('os', async () => {
  const actual = await vi.importActual('os');
  return {
    ...actual,
    homedir: () => '/home/testuser',
  };
});

describe('isValidHost', () => {
  it('should accept valid hostnames', () => {
    expect(isValidHost('example.com')).toBe(true);
    expect(isValidHost('server-1')).toBe(true);
    expect(isValidHost('my.server.example.com')).toBe(true);
    expect(isValidHost('localhost')).toBe(true);
  });

  it('should accept valid IP addresses', () => {
    expect(isValidHost('192.168.1.1')).toBe(true);
    expect(isValidHost('10.0.0.1')).toBe(true);
    expect(isValidHost('8.8.8.8')).toBe(true);
  });

  it('should reject invalid hostnames', () => {
    expect(isValidHost('')).toBe(false);
    expect(isValidHost('-invalid')).toBe(false);
    expect(isValidHost('invalid-')).toBe(false);
    expect(isValidHost('inva lid')).toBe(false);
    expect(isValidHost('host;rm -rf')).toBe(false);
  });

  it('should reject non-string values', () => {
    expect(isValidHost(null as unknown as string)).toBe(false);
    expect(isValidHost(undefined as unknown as string)).toBe(false);
  });
});

describe('isValidUser', () => {
  it('should accept valid usernames', () => {
    expect(isValidUser('root')).toBe(true);
    expect(isValidUser('admin')).toBe(true);
    expect(isValidUser('user_name')).toBe(true);
    expect(isValidUser('user-name')).toBe(true);
    expect(isValidUser('_service')).toBe(true);
  });

  it('should reject invalid usernames', () => {
    expect(isValidUser('')).toBe(false);
    expect(isValidUser('123user')).toBe(false);
    expect(isValidUser('user name')).toBe(false);
    expect(isValidUser('user;rm -rf')).toBe(false);
  });
});

describe('isValidPort', () => {
  it('should accept valid ports', () => {
    expect(isValidPort(22)).toBe(true);
    expect(isValidPort(80)).toBe(true);
    expect(isValidPort(443)).toBe(true);
    expect(isValidPort(8080)).toBe(true);
    expect(isValidPort(65535)).toBe(true);
    expect(isValidPort(1)).toBe(true);
  });

  it('should accept valid port strings', () => {
    expect(isValidPort('22')).toBe(true);
    expect(isValidPort('8080')).toBe(true);
  });

  it('should reject invalid ports', () => {
    expect(isValidPort(0)).toBe(false);
    expect(isValidPort(-1)).toBe(false);
    expect(isValidPort(65536)).toBe(false);
    expect(isValidPort(NaN)).toBe(false);
    expect(isValidPort('invalid')).toBe(false);
  });
});

describe('isValidIdentityFile', () => {
  it('should accept valid SSH key paths', () => {
    expect(isValidIdentityFile('~/.ssh/id_rsa')).toBe(true);
    expect(isValidIdentityFile('~/.ssh/id_ed25519')).toBe(true);
    expect(isValidIdentityFile('~/.ssh/my_key')).toBe(true);
  });

  it('should reject path traversal attempts', () => {
    expect(isValidIdentityFile('~/../../../etc/passwd')).toBe(false);
    expect(isValidIdentityFile('/tmp/../etc/passwd')).toBe(false);
    expect(isValidIdentityFile('~/.ssh/../../../etc/shadow')).toBe(false);
  });

  it('should reject paths outside allowed directories', () => {
    expect(isValidIdentityFile('/etc/passwd')).toBe(false);
    expect(isValidIdentityFile('/tmp/key')).toBe(false);
  });

  it('should reject invalid characters', () => {
    expect(isValidIdentityFile('~/.ssh/key;rm -rf')).toBe(false);
    expect(isValidIdentityFile('~/.ssh/key`whoami`')).toBe(false);
  });

  it('should reject empty or invalid values', () => {
    expect(isValidIdentityFile('')).toBe(false);
    expect(isValidIdentityFile(null as unknown as string)).toBe(false);
    expect(isValidIdentityFile(undefined as unknown as string)).toBe(false);
  });
});

describe('sanitize', () => {
  it('should remove dangerous shell characters', () => {
    expect(sanitize('hello;world')).toBe('helloworld');
    expect(sanitize('test|pipe')).toBe('testpipe');
    expect(sanitize('cmd`whoami`')).toBe('cmdwhoami');
    expect(sanitize('$PATH')).toBe('PATH');
    expect(sanitize('hello\nworld')).toBe('helloworld');
  });

  it('should preserve safe characters', () => {
    expect(sanitize('hello-world_123')).toBe('hello-world_123');
    expect(sanitize('user@host.com')).toBe('user@host.com');
  });

  it('should handle non-string input', () => {
    expect(sanitize(123 as unknown as string)).toBe('');
    expect(sanitize(null as unknown as string)).toBe('');
  });
});

describe('validateConnectionInfo', () => {
  it('should accept valid connection info', () => {
    const result = validateConnectionInfo({
      host: 'example.com',
      user: 'admin',
      port: 22,
    });
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should accept connection info with identity file', () => {
    const result = validateConnectionInfo({
      host: 'example.com',
      user: 'admin',
      port: 22,
      identityFile: '~/.ssh/id_rsa',
    });
    expect(result.valid).toBe(true);
  });

  it('should reject invalid host', () => {
    const result = validateConnectionInfo({
      host: '',
      user: 'admin',
      port: 22,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid host');
  });

  it('should reject invalid user', () => {
    const result = validateConnectionInfo({
      host: 'example.com',
      user: '',
      port: 22,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid user');
  });

  it('should reject invalid port', () => {
    const result = validateConnectionInfo({
      host: 'example.com',
      user: 'admin',
      port: 0,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid port');
  });

  it('should reject invalid identity file', () => {
    const result = validateConnectionInfo({
      host: 'example.com',
      user: 'admin',
      port: 22,
      identityFile: '/etc/passwd',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid identity file');
  });
});

describe('parseQuickConnect', () => {
  it('should parse user@host:port format', () => {
    const result = parseQuickConnect('admin@example.com:2222');
    expect(result).toEqual({
      user: 'admin',
      host: 'example.com',
      port: 2222,
    });
  });

  it('should parse user@host format', () => {
    const result = parseQuickConnect('admin@example.com');
    expect(result).toEqual({
      user: 'admin',
      host: 'example.com',
      port: undefined,
    });
  });

  it('should parse host:port format', () => {
    const result = parseQuickConnect('example.com:2222');
    expect(result).toEqual({
      user: undefined,
      host: 'example.com',
      port: 2222,
    });
  });

  it('should parse host only format', () => {
    const result = parseQuickConnect('example.com');
    expect(result).toEqual({
      user: undefined,
      host: 'example.com',
      port: undefined,
    });
  });

  it('should return null for invalid input', () => {
    expect(parseQuickConnect('')).toBeNull();
    // Note: sanitize() strips dangerous characters, so 'invalid;host' becomes 'invalidhost'
    // which is actually a valid host. Test with actually invalid formats instead.
    expect(parseQuickConnect('  ')).toBeNull(); // Whitespace only
  });
});

describe('isValidFleetName', () => {
  it('should accept valid fleet names', () => {
    expect(isValidFleetName('Production')).toBe(true);
    expect(isValidFleetName('Dev Servers')).toBe(true);
    expect(isValidFleetName('AWS-Prod')).toBe(true);
    expect(isValidFleetName('My_Fleet')).toBe(true);
  });

  it('should reject invalid fleet names', () => {
    expect(isValidFleetName('')).toBe(false);
    expect(isValidFleetName('A'.repeat(51))).toBe(false); // Too long
    expect(isValidFleetName(' Spaces')).toBe(false); // Starts with space
    expect(isValidFleetName('Invalid;Name')).toBe(false);
  });
});

describe('isValidVesselName', () => {
  it('should accept valid vessel names', () => {
    expect(isValidVesselName('Web Server 1')).toBe(true);
    expect(isValidVesselName('db-master')).toBe(true);
    expect(isValidVesselName('api.prod')).toBe(true);
    expect(isValidVesselName('server_01')).toBe(true);
  });

  it('should reject invalid vessel names', () => {
    expect(isValidVesselName('')).toBe(false);
    expect(isValidVesselName('A'.repeat(51))).toBe(false); // Too long
    expect(isValidVesselName('Invalid;Name')).toBe(false);
  });
});

describe('isValidTag', () => {
  it('should accept valid tags', () => {
    expect(isValidTag('production')).toBe(true);
    expect(isValidTag('web-server')).toBe(true);
    expect(isValidTag('nginx')).toBe(true);
  });

  it('should reject invalid tags', () => {
    expect(isValidTag('')).toBe(false);
    expect(isValidTag('tag with spaces')).toBe(false);
    expect(isValidTag('A'.repeat(31))).toBe(false); // Too long
    expect(isValidTag('invalid;tag')).toBe(false);
  });
});
