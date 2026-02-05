import * as vscode from 'vscode';
import { ConfigManager } from '../core/config';
import { parseQuickConnect } from '../core/security';
import { SSHConnectionInfo } from '../types';
import { connect } from './connect';

/**
 * Quick connect via input box
 */
export async function quickConnect(configManager: ConfigManager): Promise<void> {
  const settings = configManager.getSettings();
  const recent = configManager.loadRecent();
  const config = configManager.loadConfig();

  // Build quick pick items from recent and vessels
  const quickPickItems: vscode.QuickPickItem[] = [];

  // Add recent connections
  if (recent.length > 0) {
    quickPickItems.push({
      label: 'Recent Connections',
      kind: vscode.QuickPickItemKind.Separator,
    });

    for (const r of recent) {
      quickPickItems.push({
        label: r.vesselName || r.host,
        description: `${r.user}@${r.host}`,
        detail: r.fleetName ? `Fleet: ${r.fleetName}` : undefined,
      });
    }
  }

  // Add all vessels
  if (config.fleets.length > 0) {
    quickPickItems.push({
      label: 'All Vessels',
      kind: vscode.QuickPickItemKind.Separator,
    });

    for (const fleet of config.fleets) {
      for (const vessel of fleet.vessels) {
        const user =
          vessel.user ||
          fleet.defaults?.user ||
          config.defaults?.user ||
          settings.defaultUser;

        quickPickItems.push({
          label: vessel.name || vessel.host,
          description: `${user}@${vessel.host}`,
          detail: `Fleet: ${fleet.name}`,
        });
      }
    }
  }

  // Show quick pick with input
  const result = await vscode.window.showQuickPick(quickPickItems, {
    placeHolder: 'Select a vessel or type user@host:port',
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (!result) {
    return;
  }

  // Check if result is a separator
  if (result.kind === vscode.QuickPickItemKind.Separator) {
    return;
  }

  // Find the vessel/recent connection
  let connectionInfo: SSHConnectionInfo | null = null;

  // Check recent first
  const recentMatch = recent.find(
    (r) =>
      (r.vesselName || r.host) === result.label ||
      `${r.user}@${r.host}` === result.description
  );

  if (recentMatch) {
    connectionInfo = {
      name: recentMatch.vesselName || recentMatch.host,
      host: recentMatch.host,
      user: recentMatch.user,
      port: recentMatch.port,
      identityFile: recentMatch.identityFile,
      shell: config.defaults?.shell || settings.defaultShell,
      fleetName: recentMatch.fleetName || 'Recent',
      favorite: false,
      tags: [],
    };
  }

  // Check vessels
  if (!connectionInfo) {
    for (const fleet of config.fleets) {
      const vessel = fleet.vessels.find(
        (v) => (v.name || v.host) === result.label
      );

      if (vessel) {
        const user =
          vessel.user ||
          fleet.defaults?.user ||
          config.defaults?.user ||
          settings.defaultUser;
        const port =
          vessel.port ||
          fleet.defaults?.port ||
          config.defaults?.port ||
          settings.defaultPort;
        const identityFile =
          vessel.identityFile ||
          fleet.defaults?.identityFile ||
          config.defaults?.identityFile;
        const shell =
          vessel.shell ||
          fleet.defaults?.shell ||
          config.defaults?.shell ||
          settings.defaultShell;

        connectionInfo = {
          name: vessel.name || vessel.host,
          host: vessel.host,
          user,
          port,
          identityFile,
          shell,
          fleetName: fleet.name,
          favorite: vessel.favorite || false,
          tags: vessel.tags || [],
        };
        break;
      }
    }
  }

  if (connectionInfo) {
    await connect(configManager, connectionInfo);
  }
}

/**
 * Quick connect via input box (manual entry)
 */
export async function quickConnectManual(
  configManager: ConfigManager
): Promise<void> {
  const settings = configManager.getSettings();
  const defaults = configManager.getDefaults();

  const input = await vscode.window.showInputBox({
    placeHolder: 'user@host:port (e.g., root@192.168.1.1:22)',
    prompt: 'Enter SSH connection string',
    validateInput: (value) => {
      if (!value) return null;
      const parsed = parseQuickConnect(value);
      if (!parsed) return 'Invalid format. Use: user@host:port or host';
      return null;
    },
  });

  if (!input) {
    return;
  }

  const parsed = parseQuickConnect(input);
  if (!parsed) {
    vscode.window.showErrorMessage('SSHarbor: Invalid connection string');
    return;
  }

  const connectionInfo: SSHConnectionInfo = {
    name: parsed.host,
    host: parsed.host,
    user: parsed.user || defaults.user || settings.defaultUser,
    port: parsed.port || defaults.port || settings.defaultPort,
    identityFile: defaults.identityFile,
    shell: defaults.shell || settings.defaultShell,
    fleetName: 'Quick Connect',
    favorite: false,
    tags: [],
  };

  await connect(configManager, connectionInfo);
}

/**
 * Register quick connect commands
 */
export function registerQuickConnectCommands(
  context: vscode.ExtensionContext,
  configManager: ConfigManager
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('ssharbor.quickConnect', async () => {
      await quickConnect(configManager);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ssharbor.quickConnectManual', async () => {
      await quickConnectManual(configManager);
    })
  );
}
