import * as vscode from 'vscode';
import { ConfigManager } from './core/config';
import { HarborTreeProvider } from './providers/harbor-tree';
import { StatusBarManager, registerStatusBarCommands } from './views/status-bar';
import { VesselDetailPanelProvider } from './views/vessel-detail-panel';
import { registerAllCommands } from './commands';
import { FleetItem, VesselItem, HarborTreeItem, hasConnectionInfo } from './types';

/**
 * Auto-save current folder when in Remote SSH session initiated by SSHarbor
 */
function autoSaveCurrentFolder(configManager: ConfigManager): void {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return;

  const uri = workspaceFolder.uri;

  // Check if this is a remote SSH session
  if (uri.scheme !== 'vscode-remote') return;

  const authority = uri.authority;
  if (!authority.startsWith('ssh-remote+')) return;

  const sshHost = authority.replace('ssh-remote+', '');
  const folderPath = uri.path;

  // Skip home directories (we only want to save non-home paths)
  if (folderPath === '/root' || folderPath.match(/^\/home\/[^/]+$/)) {
    return;
  }

  // Check if it's an SSHarbor-managed connection
  if (!sshHost.startsWith('SSHarbor_')) return;

  // Parse the alias to find the vessel
  const config = configManager.loadConfig();
  const settings = configManager.getSettings();
  const defaults = config.defaults || {};

  for (const fleet of config.fleets) {
    for (const vessel of fleet.vessels) {
      const fleetClean = fleet.name.replace(/[^a-zA-Z0-9]/g, '_');
      const vesselClean = (vessel.name || vessel.host).replace(/[^a-zA-Z0-9]/g, '_');
      const expectedAlias = `SSHarbor_${fleetClean}_${vesselClean}`;

      if (sshHost === expectedAlias) {
        const user = vessel.user || fleet.defaults?.user || defaults.user || settings.defaultUser;
        const port = vessel.port || fleet.defaults?.port || defaults.port || settings.defaultPort;

        // Save the folder path
        configManager.addVesselPath(vessel.host, user, port, folderPath);
        console.log(`SSHarbor: Auto-saved folder ${folderPath} for ${vessel.name || vessel.host}`);
        return;
      }
    }
  }
}

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('SSHarbor: Activating...');

  // Initialize config manager
  const configManager = new ConfigManager(context);

  // Initialize tree provider
  const treeProvider = new HarborTreeProvider(configManager);

  // Register tree view with drag and drop support
  const treeView = vscode.window.createTreeView('ssharbor.harbor', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
    dragAndDropController: treeProvider,
    canSelectMany: true,
  });

  // Remember collapsed state
  treeView.onDidCollapseElement((e) => {
    if (e.element instanceof FleetItem) {
      configManager.setFleetCollapsed(e.element.fleet.name, true);
    }
  });

  treeView.onDidExpandElement((e) => {
    if (e.element instanceof FleetItem) {
      configManager.setFleetCollapsed(e.element.fleet.name, false);
    }
  });

  // Vessel detail panel (bottom panel with actions)
  const vesselDetailProvider = new VesselDetailPanelProvider(context.extensionUri);
  vesselDetailProvider.setConfigManager(configManager);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      VesselDetailPanelProvider.viewType,
      vesselDetailProvider
    )
  );

  // Update detail panel when vessel is selected
  treeView.onDidChangeSelection((e) => {
    if (e.selection.length === 0) {
      vesselDetailProvider.updateVessel(undefined);
      return;
    }

    const selectedItem = e.selection[0];

    // Use type guard to check for connectionInfo
    if (hasConnectionInfo(selectedItem)) {
      vesselDetailProvider.updateVessel(selectedItem.connectionInfo);
      // Reveal the detail panel when a vessel is selected
      vscode.commands.executeCommand('ssharbor.vesselDetail.focus');
    } else {
      vesselDetailProvider.updateVessel(undefined);
    }
  });

  // Initialize status bar
  const statusBar = new StatusBarManager(configManager);

  // Register all commands
  registerAllCommands(context, configManager, treeProvider);
  registerStatusBarCommands(context, statusBar);

  // Watch config file for external changes
  const configWatcher = configManager.watchConfig();

  // Watch vessel paths file for changes (from remote sessions)
  const vesselPathsWatcher = configManager.watchVesselPaths(() => {
    // Refresh the detail panel when paths change
    vesselDetailProvider.refresh();
  });

  // Auto-save folder when in Remote SSH session
  const workspaceFolderWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    autoSaveCurrentFolder(configManager);
  });

  // Also save on activation if already in a remote session
  autoSaveCurrentFolder(configManager);

  // Add disposables
  context.subscriptions.push(
    treeView,
    configWatcher,
    vesselPathsWatcher,
    statusBar,
    workspaceFolderWatcher,
    {
      dispose: () => {
        configManager.dispose();
        treeProvider.dispose();
      },
    }
  );

  // Show welcome message on first activation
  if (!configManager.configExists()) {
    vscode.window
      .showInformationMessage(
        'Welcome to SSHarbor! Create your first fleet to get started.',
        'Create Fleet',
        'Open Config'
      )
      .then((selection) => {
        if (selection === 'Create Fleet') {
          vscode.commands.executeCommand('ssharbor.createFleet');
        } else if (selection === 'Open Config') {
          vscode.commands.executeCommand('ssharbor.editConfig');
        }
      });
  }

  console.log('SSHarbor: Activated successfully');
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
  console.log('SSHarbor: Deactivated');
}
