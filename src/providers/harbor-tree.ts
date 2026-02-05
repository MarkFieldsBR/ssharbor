import * as vscode from 'vscode';
import { ConfigManager } from '../core/config';
import {
  HarborTreeItem,
  FleetItem,
  VesselItem,
  RecentFleetItem,
  FavoritesFleetItem,
  SpacerItem,
  SSHConnectionInfo,
  MutableConnectionInfo,
} from '../types';

/**
 * Tree data provider for the SSHarbor Harbor view.
 *
 * Provides a hierarchical view of SSH connections organized by:
 * - Favorites (starred vessels)
 * - Recent connections
 * - Fleets (groups of vessels)
 *
 * Supports filtering by vessel name, host, user, or tags.
 *
 * @implements {vscode.TreeDataProvider<HarborTreeItem>}
 *
 * @example
 * ```typescript
 * const provider = new HarborTreeProvider(configManager);
 * vscode.window.createTreeView('ssharbor.harbor', { treeDataProvider: provider });
 * ```
 */
export class HarborTreeProvider implements vscode.TreeDataProvider<HarborTreeItem> {
  /** Event emitter for tree data changes */
  private _onDidChangeTreeData = new vscode.EventEmitter<HarborTreeItem | undefined | null | void>();

  /** Event fired when tree data changes */
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  /** Current filter text for searching vessels */
  private filterText: string = '';

  /**
   * Creates a new HarborTreeProvider.
   *
   * @param configManager - The configuration manager for loading vessel data
   */
  constructor(private configManager: ConfigManager) {
    // Refresh on config changes
    configManager.onConfigChange(() => this.refresh());
  }

  /**
   * Triggers a refresh of the entire tree view.
   * Called automatically when configuration changes.
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Sets the filter text for searching vessels.
   * Filters by vessel name, host, user, or tags (case-insensitive).
   *
   * @param text - The search text to filter by
   */
  setFilter(text: string): void {
    this.filterText = text.toLowerCase();
    this.refresh();
  }

  /**
   * Clears the current filter and shows all vessels.
   */
  clearFilter(): void {
    this.filterText = '';
    this.refresh();
  }

  /**
   * Returns the tree item representation for an element.
   *
   * @param element - The tree item element
   * @returns The VS Code TreeItem representation
   */
  getTreeItem(element: HarborTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Returns the children of a tree item.
   *
   * @param element - The parent element, or undefined for root
   * @returns Promise resolving to the child tree items
   */
  getChildren(element?: HarborTreeItem): Thenable<HarborTreeItem[]> {
    if (!element) {
      // Root level
      return Promise.resolve(this.getRootItems());
    }

    // Spacer items have no children
    if (element instanceof SpacerItem) {
      return Promise.resolve([]);
    }

    // Fleet level - return vessels
    if (element instanceof FleetItem) {
      return Promise.resolve(this.getFleetChildren(element));
    }

    // Recent fleet
    if (element instanceof RecentFleetItem) {
      return Promise.resolve(this.getRecentChildren());
    }

    // Favorites fleet
    if (element instanceof FavoritesFleetItem) {
      return Promise.resolve(this.getFavoritesChildren());
    }

    return Promise.resolve([]);
  }

  /**
   * Get root level items
   */
  private getRootItems(): HarborTreeItem[] {
    const items: HarborTreeItem[] = [];
    const config = this.configManager.loadConfig();
    const settings = this.configManager.getSettings();
    const defaults = config.defaults || {};

    // Favorites fleet (if any)
    const favorites = this.configManager.getFavorites();
    if (favorites.length > 0) {
      items.push(new FavoritesFleetItem(favorites.length));
    }

    // Recent connections fleet (if enabled and has items)
    if (settings.showRecentConnections) {
      const recent = this.configManager.loadRecent();
      if (recent.length > 0) {
        items.push(new RecentFleetItem(recent.length));
      }
    }

    // Regular fleets
    for (const fleet of config.fleets) {
      // Apply filter
      if (this.filterText) {
        const hasMatchingVessel = fleet.vessels.some(
          (v) =>
            v.name?.toLowerCase().includes(this.filterText) ||
            v.host.toLowerCase().includes(this.filterText) ||
            v.user?.toLowerCase().includes(this.filterText) ||
            v.tags?.some((t) => t.toLowerCase().includes(this.filterText))
        );

        if (
          !fleet.name.toLowerCase().includes(this.filterText) &&
          !hasMatchingVessel
        ) {
          continue;
        }
      }

      items.push(new FleetItem(fleet, defaults, settings));
    }

    // Add spacer items at the end for visual breathing room
    if (items.length > 0) {
      items.push(new SpacerItem());
      items.push(new SpacerItem());
      items.push(new SpacerItem());
    }

    return items;
  }

  /**
   * Get fleet children (vessels)
   */
  private getFleetChildren(fleetItem: FleetItem): VesselItem[] {
    let vessels = fleetItem.vessels;

    // Apply filter
    if (this.filterText) {
      vessels = vessels.filter(
        (v) =>
          v.connectionInfo.name.toLowerCase().includes(this.filterText) ||
          v.connectionInfo.host.toLowerCase().includes(this.filterText) ||
          v.connectionInfo.user.toLowerCase().includes(this.filterText) ||
          v.connectionInfo.tags.some((t) =>
            t.toLowerCase().includes(this.filterText)
          )
      );
    }

    // Sort: favorites first, then alphabetically
    return vessels.sort((a, b) => {
      if (a.connectionInfo.favorite && !b.connectionInfo.favorite) return -1;
      if (!a.connectionInfo.favorite && b.connectionInfo.favorite) return 1;
      return a.connectionInfo.name.localeCompare(b.connectionInfo.name);
    });
  }

  /**
   * Get recent connections as tree items
   */
  private getRecentChildren(): HarborTreeItem[] {
    const recent = this.configManager.loadRecent();
    const settings = this.configManager.getSettings();
    const defaults = this.configManager.getDefaults();

    return recent.map((r) => {
      const connectionInfo: SSHConnectionInfo = {
        name: r.vesselName || r.host,
        host: r.host,
        user: r.user,
        port: r.port,
        identityFile: r.identityFile,
        shell: defaults.shell || settings.defaultShell,
        fleetName: r.fleetName || 'Recent',
        favorite: false,
        tags: [],
      };

      // Create a pseudo VesselItem for recent
      const item = new vscode.TreeItem(
        connectionInfo.name,
        vscode.TreeItemCollapsibleState.None
      ) as HarborTreeItem;

      item.iconPath = new vscode.ThemeIcon('history', new vscode.ThemeColor('charts.green'));
      item.description = `${r.user}@${r.host}`;
      item.tooltip = this.buildRecentTooltip({ ...r, identityFile: r.identityFile });
      item.contextValue = 'vessel';

      // Store connection info for double-click handling and commands
      // Type assertion to MutableConnectionInfo for dynamic property assignment
      (item as unknown as MutableConnectionInfo).connectionInfo = connectionInfo;

      return item;
    });
  }

  /**
   * Build tooltip for recent connection
   */
  private buildRecentTooltip(r: {
    host: string;
    user: string;
    port: number;
    timestamp: number;
    identityFile?: string;
  }): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.supportHtml = true;
    md.isTrusted = true;

    md.appendMarkdown(`## 🕐 Recent Connection\n\n`);
    md.appendMarkdown(`---\n\n`);

    // Connection Details
    md.appendMarkdown(`### Connection\n\n`);
    md.appendMarkdown(`| | |\n`);
    md.appendMarkdown(`|:--|:--|\n`);
    md.appendMarkdown(`| **Host** | \`${r.host}\` |\n`);
    md.appendMarkdown(`| **User** | \`${r.user}\` |\n`);
    md.appendMarkdown(`| **Port** | \`${r.port}\` |\n`);

    if (r.identityFile) {
      md.appendMarkdown(`| **Key** | \`${r.identityFile}\` |\n`);
    }

    md.appendMarkdown(`\n`);

    // SSH Command Preview
    md.appendMarkdown(`---\n\n`);
    md.appendMarkdown(`### SSH Command\n\n`);
    let sshCmd = 'ssh';
    if (r.identityFile) {
      sshCmd += ` -i ${r.identityFile}`;
    }
    if (r.port !== 22) {
      sshCmd += ` -p ${r.port}`;
    }
    sshCmd += ` ${r.user}@${r.host}`;
    md.appendMarkdown(`\`\`\`bash\n${sshCmd}\n\`\`\`\n\n`);

    // Time info
    const ago = this.formatTimeAgo(r.timestamp);
    md.appendMarkdown(`---\n\n`);
    md.appendMarkdown(`*Last connected: ${ago}*\n\n`);
    md.appendMarkdown(`*Double-click to connect*`);

    return md;
  }

  /**
   * Get favorites as tree items
   */
  private getFavoritesChildren(): HarborTreeItem[] {
    const favorites = this.configManager.getFavorites();
    const config = this.configManager.loadConfig();
    const settings = this.configManager.getSettings();
    const defaults = config.defaults || {};

    return favorites.map(({ vessel, fleetName }) => {
      const fleet = config.fleets.find((f) => f.name === fleetName);
      if (!fleet) {
        // Fallback if fleet not found
        const item = new vscode.TreeItem(
          vessel.name || vessel.host,
          vscode.TreeItemCollapsibleState.None
        ) as HarborTreeItem;
        item.iconPath = new vscode.ThemeIcon(
          'star-full',
          new vscode.ThemeColor('charts.yellow')
        );
        return item;
      }

      return new VesselItem(vessel, fleet, defaults, settings);
    });
  }

  /**
   * Format timestamp to relative time
   */
  private formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  /**
   * Get parent of item
   */
  getParent(element: HarborTreeItem): vscode.ProviderResult<HarborTreeItem> {
    // Not implementing parent navigation for now
    return null;
  }

  /**
   * Dispose
   */
  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
