import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildSSHCommand,
  buildSSHCommandDisplay,
  expandPath,
  buildConnectionId,
  parseConnectionId,
  generateSSHConfigAlias,
} from '../ssh';
import { SSHConnectionInfo } from '../../types';

// Mock os.homedir for consistent tests
vi.mock('os', async () => {
  const actual = await vi.importActual('os');
  return {
    ...actual,
    homedir: () => '/home/testuser',
  };
});

// Mock fs for file existence checks
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn((path: string) => {
      // Mock that ~/.ssh/id_rsa exists
      if (path === '/home/testuser/.ssh/id_rsa') {
        return true;
      }
      return false;
    }),
  };
});

describe('expandPath', () => {
  it('should expand ~ to home directory', () => {
    expect(expandPath('~/.ssh/id_rsa')).toBe('/home/testuser/.ssh/id_rsa');
    expect(expandPath('~/documents')).toBe('/home/testuser/documents');
  });

  it('should preserve absolute paths', () => {
    expect(expandPath('/etc/ssh/config')).toBe('/etc/ssh/config');
    expect(expandPath('/home/user/.ssh/key')).toBe('/home/user/.ssh/key');
  });

  it('should handle paths without ~', () => {
    expect(expandPath('relative/path')).toBe('relative/path');
  });
});

describe('buildConnectionId', () => {
  it('should build correct connection ID', () => {
    expect(buildConnectionId({ host: 'example.com', user: 'admin', port: 22 }))
      .toBe('admin@example.com:22');
    expect(buildConnectionId({ host: '192.168.1.1', user: 'root', port: 2222 }))
      .toBe('root@192.168.1.1:2222');
  });
});

describe('parseConnectionId', () => {
  it('should parse valid connection IDs', () => {
    expect(parseConnectionId('admin@example.com:22')).toEqual({
      user: 'admin',
      host: 'example.com',
      port: 22,
    });
    expect(parseConnectionId('root@192.168.1.1:2222')).toEqual({
      user: 'root',
      host: '192.168.1.1',
      port: 2222,
    });
  });

  it('should return null for invalid connection IDs', () => {
    expect(parseConnectionId('invalid')).toBeNull();
    expect(parseConnectionId('user@host')).toBeNull(); // Missing port
    expect(parseConnectionId('')).toBeNull();
  });
});

describe('generateSSHConfigAlias', () => {
  it('should generate clean alias for fleet and vessel', () => {
    const info: SSHConnectionInfo = {
      name: 'Web Server',
      host: 'example.com',
      user: 'admin',
      port: 22,
      shell: '/bin/bash',
      fleetName: 'Production',
      favorite: false,
      tags: [],
    };
    expect(generateSSHConfigAlias(info)).toBe('SSHarbor_Production_Web_Server');
  });

  it('should handle special characters in names', () => {
    const info: SSHConnectionInfo = {
      name: 'DB (Master)',
      host: 'db.example.com',
      user: 'admin',
      port: 22,
      shell: '/bin/bash',
      fleetName: 'AWS-Prod',
      favorite: false,
      tags: [],
    };
    expect(generateSSHConfigAlias(info)).toBe('SSHarbor_AWS_Prod_DB__Master_');
  });
});

describe('buildSSHCommandDisplay', () => {
  it('should build basic SSH command', () => {
    const info: SSHConnectionInfo = {
      name: 'Server',
      host: 'example.com',
      user: 'admin',
      port: 22,
      shell: '/bin/bash',
      fleetName: 'Production',
      favorite: false,
      tags: [],
    };
    expect(buildSSHCommandDisplay(info)).toBe('ssh admin@example.com');
  });

  it('should include port if not 22', () => {
    const info: SSHConnectionInfo = {
      name: 'Server',
      host: 'example.com',
      user: 'admin',
      port: 2222,
      shell: '/bin/bash',
      fleetName: 'Production',
      favorite: false,
      tags: [],
    };
    expect(buildSSHCommandDisplay(info)).toBe('ssh -p 2222 admin@example.com');
  });

  it('should include identity file if specified', () => {
    const info: SSHConnectionInfo = {
      name: 'Server',
      host: 'example.com',
      user: 'admin',
      port: 22,
      identityFile: '~/.ssh/id_rsa',
      shell: '/bin/bash',
      fleetName: 'Production',
      favorite: false,
      tags: [],
    };
    expect(buildSSHCommandDisplay(info)).toBe('ssh -i ~/.ssh/id_rsa admin@example.com');
  });

  it('should include both port and identity file', () => {
    const info: SSHConnectionInfo = {
      name: 'Server',
      host: 'example.com',
      user: 'admin',
      port: 2222,
      identityFile: '~/.ssh/my_key',
      shell: '/bin/bash',
      fleetName: 'Production',
      favorite: false,
      tags: [],
    };
    expect(buildSSHCommandDisplay(info)).toBe('ssh -i ~/.ssh/my_key -p 2222 admin@example.com');
  });
});

describe('buildSSHCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should build basic SSH command', () => {
    const info: SSHConnectionInfo = {
      name: 'Server',
      host: 'example.com',
      user: 'admin',
      port: 22,
      shell: '/bin/bash',
      fleetName: 'Production',
      favorite: false,
      tags: [],
    };
    expect(buildSSHCommand(info)).toBe('ssh admin@example.com');
  });

  it('should expand identity file path and include if exists', () => {
    const info: SSHConnectionInfo = {
      name: 'Server',
      host: 'example.com',
      user: 'admin',
      port: 22,
      identityFile: '~/.ssh/id_rsa',
      shell: '/bin/bash',
      fleetName: 'Production',
      favorite: false,
      tags: [],
    };
    expect(buildSSHCommand(info)).toBe('ssh -i /home/testuser/.ssh/id_rsa admin@example.com');
  });

  it('should throw error for invalid connection info', () => {
    const info: SSHConnectionInfo = {
      name: 'Server',
      host: '', // Invalid
      user: 'admin',
      port: 22,
      shell: '/bin/bash',
      fleetName: 'Production',
      favorite: false,
      tags: [],
    };
    expect(() => buildSSHCommand(info)).toThrow('Invalid host');
  });
});
