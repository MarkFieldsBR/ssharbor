import * as vscode from 'vscode';

/**
 * Harbor configuration - the main config file
 */
export interface HarborConfig {
  $schema?: string;
  defaults?: HarborDefaults;
  fleets: Fleet[];
}

/**
 * Default values for Harbor
 */
export interface HarborDefaults {
  shell?: string;
  user?: string;
  port?: number;
  identityFile?: string;
}

/**
 * Fleet - a group of vessels (servers)
 */
export interface Fleet {
  name: string;
  icon?: string;
  color?: string;
  collapsed?: boolean;
  defaults?: FleetDefaults;
  vessels: Vessel[];
}

/**
 * Fleet-level defaults
 */
export interface FleetDefaults {
  user?: string;
  port?: number;
  identityFile?: string;
  shell?: string;
}

/**
 * Vessel - a single server/host
 */
export interface Vessel {
  name: string;
  host: string;
  user?: string;
  port?: number;
  identityFile?: string;
  shell?: string;
  tags?: string[];
  favorite?: boolean;
  notes?: string;
}

/**
 * SSH connection info (resolved with defaults)
 */
export interface SSHConnectionInfo {
  name: string;
  host: string;
  user: string;
  port: number;
  identityFile?: string;
  shell: string;
  fleetName: string;
  favorite: boolean;
  tags: string[];
}

/**
 * Recent connection entry
 */
export interface RecentConnection {
  host: string;
  user: string;
  port: number;
  identityFile?: string;
  timestamp: number;
  fleetName?: string;
  vesselName?: string;
}

/**
 * Extension settings from VS Code config
 */
export interface SSHarborSettings {
  defaultShell: string;
  defaultUser: string;
  defaultPort: number;
  showRecentConnections: boolean;
  maxRecentConnections: number;
}

/**
 * Tree item types
 */
export type TreeItemType = 'fleet' | 'vessel' | 'recent-fleet' | 'favorites-fleet' | 'spacer';

/**
 * Quick connect parse result
 */
export interface QuickConnectParsed {
  user?: string;
  host: string;
  port?: number;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Status bar states
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

/**
 * Tree item base class
 */
export class HarborTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly itemType: TreeItemType
  ) {
    super(label, collapsibleState);
    this.contextValue = itemType;
  }
}

/**
 * Fleet tree item
 */
export class FleetItem extends HarborTreeItem {
  public readonly vessels: VesselItem[] = [];

  constructor(
    public readonly fleet: Fleet,
    public readonly harborDefaults: HarborDefaults,
    public readonly settings: SSHarborSettings
  ) {
    super(
      fleet.name,
      fleet.collapsed
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.Expanded,
      'fleet'
    );

    this.iconPath = new vscode.ThemeIcon(fleet.icon || 'folder');
    this.tooltip = `Fleet: ${fleet.name}\n${fleet.vessels.length} vessel(s)`;

    // Build vessel items
    this.vessels = fleet.vessels.map(
      (vessel) => new VesselItem(vessel, fleet, harborDefaults, settings)
    );
  }
}

/**
 * Vessel tree item
 */
export class VesselItem extends HarborTreeItem {
  public readonly connectionInfo: SSHConnectionInfo;

  constructor(
    public readonly vessel: Vessel,
    public readonly fleet: Fleet,
    public readonly harborDefaults: HarborDefaults,
    public readonly settings: SSHarborSettings
  ) {
    super(vessel.name || vessel.host, vscode.TreeItemCollapsibleState.None, 'vessel');

    // Resolve connection info with defaults cascade
    const user =
      vessel.user ||
      fleet.defaults?.user ||
      harborDefaults.user ||
      settings.defaultUser;
    const port =
      vessel.port ||
      fleet.defaults?.port ||
      harborDefaults.port ||
      settings.defaultPort;
    const identityFile =
      vessel.identityFile ||
      fleet.defaults?.identityFile ||
      harborDefaults.identityFile;
    const shell =
      vessel.shell ||
      fleet.defaults?.shell ||
      harborDefaults.shell ||
      settings.defaultShell;

    this.connectionInfo = {
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

    // Icon based on favorite status - nautical theme
    // Favorites: golden star (like a guiding star for sailors)
    // Regular: radio-tower (ship's communication beacon)
    this.iconPath = vessel.favorite
      ? new vscode.ThemeIcon('star-full', new vscode.ThemeColor('charts.yellow'))
      : new vscode.ThemeIcon('radio-tower', new vscode.ThemeColor('charts.blue'));

    // Description: user@host
    this.description = `${user}@${vessel.host}`;

    // Rich tooltip with markdown
    this.tooltip = this.buildTooltip();

    // Double-click handled by TreeView event listener in extension.ts
    // (removed single-click command to require double-click)
  }

  private buildTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.supportHtml = true;
    md.isTrusted = true;

    const { connectionInfo } = this;

    // Header with favorite indicator
    const starIcon = connectionInfo.favorite ? ' ⭐' : '';
    md.appendMarkdown(`## 🚢 ${connectionInfo.name}${starIcon}\n\n`);
    md.appendMarkdown(`*Fleet: ${connectionInfo.fleetName}*\n\n`);
    md.appendMarkdown(`---\n\n`);

    // Connection Details Section
    md.appendMarkdown(`### Connection\n\n`);
    md.appendMarkdown(`| | |\n`);
    md.appendMarkdown(`|:--|:--|\n`);
    md.appendMarkdown(`| **Host** | \`${connectionInfo.host}\` |\n`);
    md.appendMarkdown(`| **User** | \`${connectionInfo.user}\` |\n`);
    md.appendMarkdown(`| **Port** | \`${connectionInfo.port}\` |\n`);

    if (connectionInfo.identityFile) {
      md.appendMarkdown(`| **Key** | \`${connectionInfo.identityFile}\` |\n`);
    }

    md.appendMarkdown(`\n`);

    // Tags Section
    if (connectionInfo.tags.length > 0) {
      md.appendMarkdown(`### Tags\n\n`);
      const tagBadges = connectionInfo.tags.map(t => `\`${t}\``).join('  ');
      md.appendMarkdown(`${tagBadges}\n\n`);
    }

    // SSH Command Preview
    md.appendMarkdown(`---\n\n`);
    md.appendMarkdown(`### SSH Command\n\n`);
    let sshCmd = 'ssh';
    if (connectionInfo.identityFile) {
      sshCmd += ` -i ${connectionInfo.identityFile}`;
    }
    if (connectionInfo.port !== 22) {
      sshCmd += ` -p ${connectionInfo.port}`;
    }
    sshCmd += ` ${connectionInfo.user}@${connectionInfo.host}`;
    md.appendMarkdown(`\`\`\`bash\n${sshCmd}\n\`\`\`\n\n`);

    // Notes Section
    if (this.vessel.notes) {
      md.appendMarkdown(`---\n\n`);
      md.appendMarkdown(`### Notes\n\n`);
      md.appendMarkdown(`*${this.vessel.notes}*\n\n`);
    }

    // Footer hint
    md.appendMarkdown(`---\n\n`);
    md.appendMarkdown(`*Double-click to connect*`);

    return md;
  }
}

/**
 * Recent connections fleet item
 */
export class RecentFleetItem extends HarborTreeItem {
  constructor(public readonly recentCount: number) {
    super('Recent', vscode.TreeItemCollapsibleState.Collapsed, 'recent-fleet');
    this.iconPath = new vscode.ThemeIcon('history');
    this.tooltip = `${recentCount} recent connection(s)`;
    this.description = `(${recentCount})`;
  }
}

/**
 * Favorites fleet item
 */
export class FavoritesFleetItem extends HarborTreeItem {
  constructor(public readonly favoritesCount: number) {
    super('Favorites', vscode.TreeItemCollapsibleState.Expanded, 'favorites-fleet');
    this.iconPath = new vscode.ThemeIcon('star-full', new vscode.ThemeColor('charts.yellow'));
    this.tooltip = `${favoritesCount} favorite vessel(s)`;
    this.description = `(${favoritesCount})`;
  }
}

/**
 * Spacer item for visual breathing room
 */
export class SpacerItem extends HarborTreeItem {
  constructor() {
    super('', vscode.TreeItemCollapsibleState.None, 'spacer' as TreeItemType);
    this.description = '';
    this.tooltip = '';
  }
}

/**
 * Type guard to check if an item has connection info
 */
export function hasConnectionInfo(item: unknown): item is { connectionInfo: SSHConnectionInfo } {
  return (
    typeof item === 'object' &&
    item !== null &&
    'connectionInfo' in item &&
    typeof (item as { connectionInfo: unknown }).connectionInfo === 'object'
  );
}

/**
 * Interface for mutable connection info (used when creating dynamic tree items)
 */
export interface MutableConnectionInfo {
  connectionInfo: SSHConnectionInfo;
}

/**
 * Union type for items that can have connection info
 */
export type TreeItemWithConnectionInfo = VesselItem | MutableConnectionInfo;

/**
 * Type for command arguments that could be VesselItem, connection info, or tree item with connection info
 */
export type ConnectionCommandArg = VesselItem | SSHConnectionInfo | { connectionInfo: SSHConnectionInfo };
