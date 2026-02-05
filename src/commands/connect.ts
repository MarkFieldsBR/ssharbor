import * as vscode from 'vscode';
import { SSHConnectionInfo, VesselItem } from '../types';
import { ConfigManager } from '../core/config';
import { buildSSHCommand, ensureSSHConfigEntry } from '../core/ssh';

/**
 * Connect to a vessel via VS Code Remote SSH
 * Opens a new VS Code window connected to the remote host
 */
export async function connect(
  configManager: ConfigManager,
  info: SSHConnectionInfo
): Promise<void> {
  try {
    // Get saved paths for this vessel
    const savedPaths = configManager.getVesselSavedPaths(info.host, info.user, info.port);
    const homePath = info.user === 'root' ? '/root' : `/home/${info.user}`;

    let selectedPath = homePath;

    // If there are saved paths, show QuickPick
    if (savedPaths.length > 0) {
      const items: vscode.QuickPickItem[] = [
        {
          label: '$(home) Home',
          description: homePath,
          detail: 'Open home directory',
        },
        { label: '', kind: vscode.QuickPickItemKind.Separator },
        ...savedPaths.map((p) => ({
          label: `$(folder) ${p.split('/').pop() || p}`,
          description: p,
          detail: 'Recently opened folder',
        })),
        { label: '', kind: vscode.QuickPickItemKind.Separator },
        {
          label: '$(edit) Custom path...',
          description: 'Enter a custom path',
          detail: 'Type a folder path manually',
        },
      ];

      const selected = await vscode.window.showQuickPick(items, {
        title: `📂 Choose folder for ${info.name}`,
        placeHolder: 'Select a folder to open',
      });

      if (!selected) {
        return; // User cancelled
      }

      if (selected.label === '$(edit) Custom path...') {
        const customPath = await vscode.window.showInputBox({
          title: 'Enter folder path',
          prompt: `Path on ${info.name}`,
          value: homePath,
          placeHolder: '/path/to/folder',
        });

        if (!customPath) {
          return; // User cancelled
        }

        selectedPath = customPath;
      } else if (selected.description) {
        selectedPath = selected.description;
      }
    }

    // Ensure SSH config entry exists with correct identity file
    const sshAlias = ensureSSHConfigEntry(info);

    // Build the remote URI
    const remoteUri = vscode.Uri.parse(`vscode-remote://ssh-remote+${sshAlias}${selectedPath}`);

    // Open folder in new window with Remote SSH
    await vscode.commands.executeCommand('vscode.openFolder', remoteUri, {
      forceNewWindow: true,
    });

    // Save the path if it's not home
    if (selectedPath !== homePath) {
      configManager.addVesselPath(info.host, info.user, info.port, selectedPath);
    }

    // Add to recent connections
    configManager.addRecent({
      host: info.host,
      user: info.user,
      port: info.port,
      identityFile: info.identityFile,
      fleetName: info.fleetName,
      vesselName: info.name,
    });

    // Update status bar
    vscode.commands.executeCommand('ssharbor.updateStatusBar', info);

    vscode.window.showInformationMessage(`SSHarbor: Boarding ${info.name}...`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`SSHarbor: Failed to connect - ${message}`);
  }
}

/**
 * Connect directly to a specific folder
 */
export async function connectToFolder(
  configManager: ConfigManager,
  info: SSHConnectionInfo,
  folderPath: string
): Promise<void> {
  try {
    // Ensure SSH config entry exists
    const sshAlias = ensureSSHConfigEntry(info);

    // Build the remote URI with the specified folder
    const remoteUri = vscode.Uri.parse(`vscode-remote://ssh-remote+${sshAlias}${folderPath}`);

    // Open folder in new window
    await vscode.commands.executeCommand('vscode.openFolder', remoteUri, {
      forceNewWindow: true,
    });

    // Update the path to be most recent
    configManager.addVesselPath(info.host, info.user, info.port, folderPath);

    // Add to recent connections
    configManager.addRecent({
      host: info.host,
      user: info.user,
      port: info.port,
      identityFile: info.identityFile,
      fleetName: info.fleetName,
      vesselName: info.name,
    });

    vscode.window.showInformationMessage(`SSHarbor: Opening ${folderPath} on ${info.name}...`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`SSHarbor: Failed to connect - ${message}`);
  }
}

/**
 * Open SSH terminal (traditional terminal connection)
 */
export async function connectTerminal(
  configManager: ConfigManager,
  info: SSHConnectionInfo
): Promise<void> {
  try {
    const sshCommand = buildSSHCommand(info);

    const terminal = vscode.window.createTerminal({
      name: `SSH: ${info.name}`,
      location: vscode.TerminalLocation.Panel,
      isTransient: false,
    });

    terminal.show();
    terminal.sendText(sshCommand);

    // Add to recent
    configManager.addRecent({
      host: info.host,
      user: info.user,
      port: info.port,
      identityFile: info.identityFile,
      fleetName: info.fleetName,
      vesselName: info.name,
    });

    vscode.window.showInformationMessage(`SSHarbor: Terminal opened for ${info.name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`SSHarbor: ${message}`);
  }
}

/**
 * Reconnect to last connection
 */
export async function reconnect(configManager: ConfigManager): Promise<void> {
  const last = configManager.getLastConnection();

  if (!last) {
    vscode.window.showInformationMessage('SSHarbor: No recent connections');
    return;
  }

  const settings = configManager.getSettings();
  const defaults = configManager.getDefaults();

  const info: SSHConnectionInfo = {
    name: last.vesselName || last.host,
    host: last.host,
    user: last.user,
    port: last.port,
    identityFile: last.identityFile,
    shell: defaults.shell || settings.defaultShell,
    fleetName: last.fleetName || 'Recent',
    favorite: false,
    tags: [],
  };

  await connect(configManager, info);
}

/**
 * Save current folder to vessel's saved paths
 * Works when connected via Remote SSH
 */
export async function saveCurrentFolder(configManager: ConfigManager): Promise<void> {
  // Check if we're in a remote SSH session
  const remoteUri = vscode.workspace.workspaceFolders?.[0]?.uri;

  if (!remoteUri || remoteUri.scheme !== 'vscode-remote') {
    vscode.window.showWarningMessage('SSHarbor: This command only works in Remote SSH sessions');
    return;
  }

  // Parse the remote authority to get host info
  // Format: ssh-remote+SSHarbor_Fleet_Vessel or ssh-remote+user@host
  const authority = remoteUri.authority;

  if (!authority.startsWith('ssh-remote+')) {
    vscode.window.showWarningMessage('SSHarbor: Not a SSH remote session');
    return;
  }

  const sshHost = authority.replace('ssh-remote+', '');
  const folderPath = remoteUri.path;

  // Try to find the vessel in config
  const config = configManager.loadConfig();
  let foundVessel: { host: string; user: string; port: number } | null = null;

  // Check if it's an SSHarbor alias (SSHarbor_Fleet_Vessel)
  if (sshHost.startsWith('SSHarbor_')) {
    // Find vessel by matching the alias pattern
    for (const fleet of config.fleets) {
      for (const vessel of fleet.vessels) {
        const fleetClean = fleet.name.replace(/[^a-zA-Z0-9]/g, '_');
        const vesselClean = (vessel.name || vessel.host).replace(/[^a-zA-Z0-9]/g, '_');
        const expectedAlias = `SSHarbor_${fleetClean}_${vesselClean}`;

        if (sshHost === expectedAlias) {
          const settings = configManager.getSettings();
          const defaults = config.defaults || {};
          foundVessel = {
            host: vessel.host,
            user: vessel.user || fleet.defaults?.user || defaults.user || settings.defaultUser,
            port: vessel.port || fleet.defaults?.port || defaults.port || settings.defaultPort,
          };
          break;
        }
      }
      if (foundVessel) break;
    }
  }

  if (!foundVessel) {
    // Try to parse as user@host or user@host:port
    const match = sshHost.match(/^([^@]+)@([^:]+)(?::(\d+))?$/);
    if (match) {
      foundVessel = {
        user: match[1],
        host: match[2],
        port: match[3] ? parseInt(match[3], 10) : 22,
      };
    }
  }

  if (!foundVessel) {
    vscode.window.showErrorMessage('SSHarbor: Could not identify vessel from remote session');
    return;
  }

  // Save the folder path
  configManager.addVesselPath(foundVessel.host, foundVessel.user, foundVessel.port, folderPath);

  vscode.window.showInformationMessage(`SSHarbor: Saved folder "${folderPath}" for quick access`);
}

/**
 * Register connect commands
 */
export function registerConnectCommands(
  context: vscode.ExtensionContext,
  configManager: ConfigManager
): void {
  // Connect command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ssharbor.connect',
      async (infoOrItem: SSHConnectionInfo | VesselItem) => {
        const info =
          infoOrItem instanceof VesselItem
            ? (infoOrItem as VesselItem).connectionInfo
            : infoOrItem;

        if (info) {
          await connect(configManager, info);
        }
      }
    )
  );

  // Connect via terminal (traditional SSH)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ssharbor.connectNewWindow',
      async (infoOrItem: SSHConnectionInfo | VesselItem) => {
        const info =
          infoOrItem instanceof VesselItem
            ? (infoOrItem as VesselItem).connectionInfo
            : infoOrItem;

        if (info) {
          await connectTerminal(configManager, info);
        }
      }
    )
  );

  // Reconnect to last
  context.subscriptions.push(
    vscode.commands.registerCommand('ssharbor.reconnect', async () => {
      await reconnect(configManager);
    })
  );

  // Save current folder (for Remote SSH sessions)
  context.subscriptions.push(
    vscode.commands.registerCommand('ssharbor.saveCurrentFolder', async () => {
      await saveCurrentFolder(configManager);
    })
  );

  // Connect to specific folder
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ssharbor.connectToFolder',
      async (info: SSHConnectionInfo, folderPath: string) => {
        if (info && folderPath) {
          await connectToFolder(configManager, info, folderPath);
        }
      }
    )
  );
}
