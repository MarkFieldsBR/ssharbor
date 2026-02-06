import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigManager } from '../core/config';
import { HarborTreeProvider } from '../providers/harbor-tree';
import { Vessel, Fleet } from '../types';

interface ParsedSshHost {
  name: string;
  host: string;
  user?: string;
  port?: number;
  identityFile?: string;
}

/**
 * Parse SSH config file
 */
function parseSshConfig(content: string): ParsedSshHost[] {
  const hosts: ParsedSshHost[] = [];
  let currentHost: ParsedSshHost | null = null;

  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith('#') || trimmed === '') {
      continue;
    }

    // Match key-value pairs (handles both "Key Value" and "Key=Value")
    const match = trimmed.match(/^(\w+)\s*[=\s]\s*(.+)$/i);
    if (!match) {
      continue;
    }

    const [, key, value] = match;
    const keyLower = key.toLowerCase();

    if (keyLower === 'host') {
      // Save previous host if exists
      if (currentHost && currentHost.host) {
        hosts.push(currentHost);
      }

      // Skip wildcards
      if (value.includes('*') || value.includes('?')) {
        currentHost = null;
        continue;
      }

      currentHost = { name: value, host: value };
    } else if (currentHost) {
      switch (keyLower) {
        case 'hostname':
          currentHost.host = value;
          break;
        case 'user':
          currentHost.user = value;
          break;
        case 'port':
          currentHost.port = parseInt(value, 10);
          break;
        case 'identityfile':
          // Expand ~ to home directory
          currentHost.identityFile = value.replace(/^~/, os.homedir());
          break;
      }
    }
  }

  // Don't forget the last host
  if (currentHost && currentHost.host) {
    hosts.push(currentHost);
  }

  return hosts;
}

/**
 * Register import SSH config command
 */
export function registerImportSshConfigCommand(
  context: vscode.ExtensionContext,
  configManager: ConfigManager,
  provider: HarborTreeProvider
): void {
  const importCommand = vscode.commands.registerCommand(
    'ssharbor.importSshConfig',
    async () => {
      const sshConfigPath = path.join(os.homedir(), '.ssh', 'config');

      // Check if SSH config exists
      if (!fs.existsSync(sshConfigPath)) {
        const create = await vscode.window.showInformationMessage(
          'No SSH config found at ~/.ssh/config',
          'Create Fleet Manually',
          'Select File'
        );

        if (create === 'Create Fleet Manually') {
          vscode.commands.executeCommand('ssharbor.createFleet');
        } else if (create === 'Select File') {
          const files = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: { 'SSH Config': ['config', '*'] },
            title: 'Select SSH Config File',
          });

          if (files && files[0]) {
            await importFromFile(files[0].fsPath, configManager, provider);
          }
        }
        return;
      }

      await importFromFile(sshConfigPath, configManager, provider);
    }
  );

  context.subscriptions.push(importCommand);
}

async function importFromFile(
  filePath: string,
  configManager: ConfigManager,
  provider: HarborTreeProvider
): Promise<void> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const hosts = parseSshConfig(content);

    if (hosts.length === 0) {
      vscode.window.showWarningMessage('No hosts found in SSH config file');
      return;
    }

    // Ask user to select which hosts to import
    const items = hosts.map((h) => ({
      label: h.name,
      description: h.host !== h.name ? h.host : undefined,
      detail: `${h.user || 'root'}@${h.host}:${h.port || 22}`,
      picked: true,
      host: h,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      canPickMany: true,
      placeHolder: 'Select hosts to import',
      title: `Found ${hosts.length} hosts in SSH config`,
    });

    if (!selected || selected.length === 0) {
      return;
    }

    // Ask for fleet name
    const fleetName = await vscode.window.showInputBox({
      prompt: 'Enter fleet name for imported hosts',
      value: 'Imported from SSH Config',
      validateInput: (value) => {
        if (!value || value.trim() === '') {
          return 'Fleet name is required';
        }
        return undefined;
      },
    });

    if (!fleetName) {
      return;
    }

    // Create vessels from selected hosts
    const vessels: Vessel[] = selected.map((item) => {
      const vessel: Vessel = {
        name: item.host.name,
        host: item.host.host,
      };

      if (item.host.user) {
        vessel.user = item.host.user;
      }
      if (item.host.port && item.host.port !== 22) {
        vessel.port = item.host.port;
      }
      if (item.host.identityFile) {
        vessel.identityFile = item.host.identityFile;
      }

      return vessel;
    });

    // Check if fleet exists
    const config = configManager.loadConfig();
    const existingFleet = config.fleets.find((f) => f.name === fleetName);

    if (existingFleet) {
      const action = await vscode.window.showQuickPick(
        [
          { label: 'Merge', description: 'Add new vessels to existing fleet' },
          { label: 'Replace', description: 'Replace all vessels in fleet' },
          { label: 'Cancel', description: 'Cancel import' },
        ],
        { placeHolder: `Fleet "${fleetName}" already exists` }
      );

      if (!action || action.label === 'Cancel') {
        return;
      }

      if (action.label === 'Replace') {
        existingFleet.vessels = vessels;
      } else {
        // Merge - add only new vessels (by host)
        const existingHosts = new Set(existingFleet.vessels.map((v) => v.host));
        const newVessels = vessels.filter((v) => !existingHosts.has(v.host));
        existingFleet.vessels.push(...newVessels);
      }

      configManager.saveConfig(config);
    } else {
      // Create new fleet
      const fleet: Fleet = {
        name: fleetName,
        icon: 'cloud-download',
        vessels,
      };

      configManager.addFleet(fleet);
    }

    provider.refresh();

    vscode.window.showInformationMessage(
      `Imported ${vessels.length} hosts into "${fleetName}"!`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Failed to import SSH config: ${message}`);
  }
}
