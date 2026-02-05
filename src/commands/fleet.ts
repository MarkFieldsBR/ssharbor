import * as vscode from 'vscode';
import { ConfigManager } from '../core/config';
import { HarborTreeProvider } from '../providers/harbor-tree';
import { FleetItem, VesselItem, ConnectionCommandArg, hasConnectionInfo, SSHConnectionInfo } from '../types';
import { AddVesselWebview } from '../views/add-vessel-webview';
import { CreateFleetWebview } from '../views/create-fleet-webview';

/**
 * Remove a fleet
 */
export async function removeFleet(
  configManager: ConfigManager,
  fleetItem: FleetItem
): Promise<void> {
  const fleetName = fleetItem.fleet.name;
  const vesselCount = fleetItem.fleet.vessels.length;

  const message = vesselCount > 0
    ? `Remove fleet "${fleetName}" and its ${vesselCount} vessel(s)?`
    : `Remove fleet "${fleetName}"?`;

  const confirm = await vscode.window.showWarningMessage(
    message,
    { modal: true },
    'Remove'
  );

  if (confirm !== 'Remove') {
    return;
  }

  try {
    configManager.removeFleet(fleetName);
    vscode.window.showInformationMessage(`SSHarbor: Fleet "${fleetName}" removed`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`SSHarbor: ${message}`);
  }
}

/**
 * Edit vessel (opens config file at vessel location)
 */
export async function editVessel(configManager: ConfigManager): Promise<void> {
  const configPath = configManager.getConfigPath();
  const doc = await vscode.workspace.openTextDocument(configPath);
  await vscode.window.showTextDocument(doc);
}

/**
 * Remove a vessel
 */
export async function removeVessel(
  configManager: ConfigManager,
  vesselItem: VesselItem
): Promise<void> {
  const confirm = await vscode.window.showWarningMessage(
    `Remove vessel "${vesselItem.connectionInfo.name}"?`,
    { modal: true },
    'Remove'
  );

  if (confirm !== 'Remove') {
    return;
  }

  try {
    configManager.removeVessel(
      vesselItem.connectionInfo.fleetName,
      vesselItem.connectionInfo.host
    );
    vscode.window.showInformationMessage(
      `SSHarbor: Vessel "${vesselItem.connectionInfo.name}" removed`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`SSHarbor: ${message}`);
  }
}

/**
 * Toggle favorite status
 */
export async function toggleFavorite(
  configManager: ConfigManager,
  vesselItem: ConnectionCommandArg
): Promise<void> {
  try {
    const info = extractConnectionInfo(vesselItem);
    if (!info?.fleetName || !info?.host) {
      return;
    }

    const isFavorite = configManager.toggleFavorite(info.fleetName, info.host);
    const status = isFavorite ? 'added to' : 'removed from';
    vscode.window.showInformationMessage(
      `SSHarbor: "${info.name}" ${status} favorites`
    );
  } catch (error) {
    vscode.window.showErrorMessage(`SSHarbor: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract SSHConnectionInfo from various command argument types
 */
function extractConnectionInfo(itemOrInfo: ConnectionCommandArg): SSHConnectionInfo | undefined {
  if (itemOrInfo instanceof VesselItem) {
    return itemOrInfo.connectionInfo;
  }

  if (hasConnectionInfo(itemOrInfo)) {
    return itemOrInfo.connectionInfo;
  }

  if ('host' in itemOrInfo && typeof itemOrInfo.host === 'string') {
    return itemOrInfo as SSHConnectionInfo;
  }

  return undefined;
}

/**
 * Register fleet/vessel management commands
 */
export function registerFleetCommands(
  context: vscode.ExtensionContext,
  configManager: ConfigManager,
  provider: HarborTreeProvider
): void {
  // Create fleet (with webview UI)
  const createFleetWebview = new CreateFleetWebview(context, configManager);
  context.subscriptions.push(
    vscode.commands.registerCommand('ssharbor.createFleet', () => {
      createFleetWebview.show();
    })
  );

  // Add vessel (with webview UI)
  const addVesselWebview = new AddVesselWebview(context, configManager);
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ssharbor.addVessel',
      async (fleetItem?: FleetItem) => {
        const fleetName = fleetItem?.fleet?.name;
        addVesselWebview.show(fleetName);
      }
    )
  );

  // Remove fleet
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ssharbor.removeFleet',
      async (fleetItem: FleetItem) => {
        await removeFleet(configManager, fleetItem);
      }
    )
  );

  // Edit vessel (open config)
  context.subscriptions.push(
    vscode.commands.registerCommand('ssharbor.editVessel', async () => {
      await editVessel(configManager);
    })
  );

  // Remove vessel
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ssharbor.removeVessel',
      async (vesselItem: VesselItem) => {
        await removeVessel(configManager, vesselItem);
      }
    )
  );

  // Toggle favorite
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ssharbor.toggleFavorite',
      async (vesselItem: ConnectionCommandArg) => {
        await toggleFavorite(configManager, vesselItem);
      }
    )
  );

  // Edit config
  context.subscriptions.push(
    vscode.commands.registerCommand('ssharbor.editConfig', async () => {
      const configPath = configManager.getConfigPath();

      // Create initial config if doesn't exist
      if (!configManager.configExists()) {
        configManager.createInitialConfig();
      }

      const doc = await vscode.workspace.openTextDocument(configPath);
      await vscode.window.showTextDocument(doc);
    })
  );

  // Refresh
  context.subscriptions.push(
    vscode.commands.registerCommand('ssharbor.refresh', () => {
      provider.refresh();
      vscode.window.showInformationMessage('SSHarbor: Refreshed');
    })
  );
}
