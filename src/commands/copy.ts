import * as vscode from 'vscode';
import { SSHConnectionInfo, VesselItem, ConnectionCommandArg, hasConnectionInfo } from '../types';
import { buildSSHCommandDisplay } from '../core/ssh';

/**
 * Copy SSH command to clipboard
 */
export async function copyCommand(info: SSHConnectionInfo): Promise<void> {
  try {
    const command = buildSSHCommandDisplay(info);
    await vscode.env.clipboard.writeText(command);
    vscode.window.showInformationMessage(`Copied: ${command}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`SSHarbor: ${message}`);
  }
}

/**
 * Copy host to clipboard
 */
export async function copyHost(info: SSHConnectionInfo): Promise<void> {
  try {
    await vscode.env.clipboard.writeText(info.host);
    vscode.window.showInformationMessage(`Copied: ${info.host}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`SSHarbor: ${message}`);
  }
}

/**
 * Register copy commands
 */
export function registerCopyCommands(context: vscode.ExtensionContext): void {
  // Copy SSH command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ssharbor.copyCommand',
      async (itemOrInfo: ConnectionCommandArg) => {
        const info = extractConnectionInfo(itemOrInfo);
        if (info) {
          await copyCommand(info);
        }
      }
    )
  );

  // Copy host
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ssharbor.copyHost',
      async (itemOrInfo: ConnectionCommandArg) => {
        const info = extractConnectionInfo(itemOrInfo);
        if (info) {
          await copyHost(info);
        }
      }
    )
  );
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
