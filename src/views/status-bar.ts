import * as vscode from 'vscode';
import { SSHConnectionInfo, RecentConnection } from '../types';
import { ConfigManager } from '../core/config';

/**
 * Status bar manager for SSHarbor
 */
export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private lastConnection: RecentConnection | null = null;

  constructor(private configManager: ConfigManager) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );

    this.statusBarItem.command = 'ssharbor.reconnect';
    this.statusBarItem.tooltip = 'Click to reconnect to last SSH session';

    // Initialize with last connection
    this.lastConnection = configManager.getLastConnection();
    this.updateStatusBar();
  }

  /**
   * Update status bar with connection info
   */
  update(info: SSHConnectionInfo): void {
    this.lastConnection = {
      host: info.host,
      user: info.user,
      port: info.port,
      identityFile: info.identityFile,
      timestamp: Date.now(),
      fleetName: info.fleetName,
      vesselName: info.name,
    };

    this.updateStatusBar();
  }

  /**
   * Update status bar display
   */
  private updateStatusBar(): void {
    if (!this.lastConnection) {
      this.statusBarItem.hide();
      return;
    }

    const { host, user, vesselName } = this.lastConnection;
    const displayName = vesselName || host;

    this.statusBarItem.text = `$(terminal) ${displayName}`;
    this.statusBarItem.tooltip = new vscode.MarkdownString(
      `**SSHarbor - Last Connection**\n\n` +
        `Click to reconnect to:\n\n` +
        `\`${user}@${host}\`\n\n` +
        `_${this.formatTimeAgo(this.lastConnection.timestamp)}_`
    );

    this.statusBarItem.show();
  }

  /**
   * Format timestamp to relative time
   */
  private formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'Connected just now';
    if (seconds < 3600) return `Connected ${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `Connected ${Math.floor(seconds / 3600)} hours ago`;
    return `Connected ${Math.floor(seconds / 86400)} days ago`;
  }

  /**
   * Show status bar
   */
  show(): void {
    if (this.lastConnection) {
      this.statusBarItem.show();
    }
  }

  /**
   * Hide status bar
   */
  hide(): void {
    this.statusBarItem.hide();
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.statusBarItem.dispose();
  }
}

/**
 * Register status bar update command
 */
export function registerStatusBarCommands(
  context: vscode.ExtensionContext,
  statusBar: StatusBarManager
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ssharbor.updateStatusBar',
      (info: SSHConnectionInfo) => {
        statusBar.update(info);
      }
    )
  );
}
