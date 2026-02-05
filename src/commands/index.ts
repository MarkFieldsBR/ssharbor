import * as vscode from 'vscode';
import { ConfigManager } from '../core/config';
import { HarborTreeProvider } from '../providers/harbor-tree';
import { registerConnectCommands } from './connect';
import { registerQuickConnectCommands } from './quick-connect';
import { registerCopyCommands } from './copy';
import { registerFleetCommands } from './fleet';

/**
 * Register all SSHarbor commands
 */
export function registerAllCommands(
  context: vscode.ExtensionContext,
  configManager: ConfigManager,
  provider: HarborTreeProvider
): void {
  registerConnectCommands(context, configManager);
  registerQuickConnectCommands(context, configManager);
  registerCopyCommands(context);
  registerFleetCommands(context, configManager, provider);
}

export { registerConnectCommands } from './connect';
export { registerQuickConnectCommands } from './quick-connect';
export { registerCopyCommands } from './copy';
export { registerFleetCommands } from './fleet';
