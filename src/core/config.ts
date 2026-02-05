import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  HarborConfig,
  HarborDefaults,
  Fleet,
  Vessel,
  RecentConnection,
  SSHarborSettings,
} from '../types';

const CONFIG_FILENAME = 'harbor.json';
const RECENT_FILENAME = 'recent.json';
const VESSEL_PATHS_FILENAME = 'vessel-paths.json';

/**
 * Vessel paths storage
 */
interface VesselPathsStorage {
  [vesselKey: string]: string[]; // vesselKey -> array of paths
}

/**
 * Configuration manager for SSHarbor
 */
export class ConfigManager {
  private configPath: string;
  private recentPath: string;
  private vesselPathsPath: string;
  private _onConfigChange = new vscode.EventEmitter<void>();

  public readonly onConfigChange = this._onConfigChange.event;

  constructor(private context: vscode.ExtensionContext) {
    const storagePath = context.globalStorageUri.fsPath;
    this.configPath = path.join(storagePath, CONFIG_FILENAME);
    this.recentPath = path.join(storagePath, RECENT_FILENAME);
    this.vesselPathsPath = path.join(storagePath, VESSEL_PATHS_FILENAME);

    // Ensure storage directory exists
    this.ensureStorageDir();
  }

  /**
   * Get VS Code settings for SSHarbor
   */
  getSettings(): SSHarborSettings {
    const config = vscode.workspace.getConfiguration('ssharbor');
    return {
      defaultShell: config.get<string>('defaultShell', '/bin/zsh'),
      defaultUser: config.get<string>('defaultUser', 'root'),
      defaultPort: config.get<number>('defaultPort', 22),
      showRecentConnections: config.get<boolean>('showRecentConnections', true),
      maxRecentConnections: config.get<number>('maxRecentConnections', 5),
    };
  }

  /**
   * Get config file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Load harbor configuration
   */
  loadConfig(): HarborConfig {
    try {
      if (!fs.existsSync(this.configPath)) {
        return { fleets: [] };
      }

      const content = fs.readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(content) as HarborConfig;

      // Ensure fleets array exists
      if (!Array.isArray(config.fleets)) {
        config.fleets = [];
      }

      return config;
    } catch (error) {
      console.error('SSHarbor: Error loading config:', error);
      return { fleets: [] };
    }
  }

  /**
   * Save harbor configuration
   * Uses chmod 0o600 to ensure file is only readable by owner
   */
  saveConfig(config: HarborConfig): void {
    try {
      this.ensureStorageDir();

      // Add schema reference
      config.$schema = './schema.json';

      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');

      // Set secure permissions (owner read/write only)
      if (os.platform() !== 'win32') {
        fs.chmodSync(this.configPath, 0o600);
      }

      this._onConfigChange.fire();
    } catch (error) {
      console.error('SSHarbor: Error saving config:', error);
      throw new Error(`Failed to save configuration: ${error}`);
    }
  }

  /**
   * Save config without triggering change event (for UI state like collapsed)
   * Uses chmod 0o600 to ensure file is only readable by owner
   */
  saveConfigSilent(config: HarborConfig): void {
    try {
      this.ensureStorageDir();
      config.$schema = './schema.json';
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');

      // Set secure permissions (owner read/write only)
      if (os.platform() !== 'win32') {
        fs.chmodSync(this.configPath, 0o600);
      }
    } catch (error) {
      console.error('SSHarbor: Error saving config:', error);
    }
  }

  /**
   * Get defaults from config
   */
  getDefaults(): HarborDefaults {
    const config = this.loadConfig();
    return config.defaults || {};
  }

  /**
   * Check if config exists
   */
  configExists(): boolean {
    return fs.existsSync(this.configPath);
  }

  /**
   * Create initial config with example data
   */
  createInitialConfig(): void {
    const template: HarborConfig = {
      $schema: './schema.json',
      defaults: {
        shell: '/bin/zsh',
        user: 'root',
        port: 22,
      },
      fleets: [
        {
          name: 'Example Fleet',
          icon: 'cloud',
          vessels: [
            {
              name: 'Example Server',
              host: '192.168.1.1',
              notes: 'Edit harbor.json to configure your servers',
            },
          ],
        },
      ],
    };

    this.saveConfig(template);
  }

  /**
   * Add a fleet
   */
  addFleet(fleet: Fleet): void {
    const config = this.loadConfig();
    config.fleets.push(fleet);
    this.saveConfig(config);
  }

  /**
   * Remove a fleet by name
   */
  removeFleet(fleetName: string): void {
    const config = this.loadConfig();
    config.fleets = config.fleets.filter((f) => f.name !== fleetName);
    this.saveConfig(config);
  }

  /**
   * Add vessel to fleet
   */
  addVessel(fleetName: string, vessel: Vessel): void {
    const config = this.loadConfig();
    const fleet = config.fleets.find((f) => f.name === fleetName);

    if (!fleet) {
      throw new Error(`Fleet not found: ${fleetName}`);
    }

    fleet.vessels.push(vessel);
    this.saveConfig(config);
  }

  /**
   * Remove vessel from fleet
   */
  removeVessel(fleetName: string, vesselHost: string): void {
    const config = this.loadConfig();
    const fleet = config.fleets.find((f) => f.name === fleetName);

    if (!fleet) {
      throw new Error(`Fleet not found: ${fleetName}`);
    }

    fleet.vessels = fleet.vessels.filter((v) => v.host !== vesselHost);
    this.saveConfig(config);
  }

  /**
   * Toggle vessel favorite
   */
  toggleFavorite(fleetName: string, vesselHost: string): boolean {
    const config = this.loadConfig();
    const fleet = config.fleets.find((f) => f.name === fleetName);

    if (!fleet) {
      throw new Error(`Fleet not found: ${fleetName}`);
    }

    const vessel = fleet.vessels.find((v) => v.host === vesselHost);
    if (!vessel) {
      throw new Error(`Vessel not found: ${vesselHost}`);
    }

    vessel.favorite = !vessel.favorite;
    this.saveConfig(config);

    return vessel.favorite;
  }

  /**
   * Set fleet collapsed state
   */
  setFleetCollapsed(fleetName: string, collapsed: boolean): void {
    const config = this.loadConfig();
    const fleet = config.fleets.find((f) => f.name === fleetName);

    if (fleet) {
      fleet.collapsed = collapsed;
      this.saveConfigSilent(config); // Silent save - don't trigger refresh
    }
  }

  /**
   * Get all favorites
   */
  getFavorites(): Array<{ vessel: Vessel; fleetName: string }> {
    const config = this.loadConfig();
    const favorites: Array<{ vessel: Vessel; fleetName: string }> = [];

    for (const fleet of config.fleets) {
      for (const vessel of fleet.vessels) {
        if (vessel.favorite) {
          favorites.push({ vessel, fleetName: fleet.name });
        }
      }
    }

    return favorites;
  }

  // ============================================================================
  // Recent connections management
  // ============================================================================

  /**
   * Load recent connections
   */
  loadRecent(): RecentConnection[] {
    try {
      if (!fs.existsSync(this.recentPath)) {
        return [];
      }

      const content = fs.readFileSync(this.recentPath, 'utf-8');
      return JSON.parse(content) as RecentConnection[];
    } catch (error) {
      console.error('SSHarbor: Error loading recent connections:', error);
      return [];
    }
  }

  /**
   * Add recent connection
   */
  addRecent(connection: Omit<RecentConnection, 'timestamp'>): void {
    const settings = this.getSettings();
    let recent = this.loadRecent();

    // Remove existing entry for same host/user/port
    recent = recent.filter(
      (r) =>
        !(
          r.host === connection.host &&
          r.user === connection.user &&
          r.port === connection.port
        )
    );

    // Add new entry at the beginning
    recent.unshift({
      ...connection,
      timestamp: Date.now(),
    });

    // Limit to max recent
    recent = recent.slice(0, settings.maxRecentConnections);

    this.saveRecent(recent);
  }

  /**
   * Save recent connections
   * Uses chmod 0o600 to ensure file is only readable by owner
   */
  private saveRecent(recent: RecentConnection[]): void {
    try {
      this.ensureStorageDir();
      fs.writeFileSync(this.recentPath, JSON.stringify(recent, null, 2), 'utf-8');

      // Set secure permissions (owner read/write only)
      if (os.platform() !== 'win32') {
        fs.chmodSync(this.recentPath, 0o600);
      }
    } catch (error) {
      console.error('SSHarbor: Error saving recent connections:', error);
    }
  }

  /**
   * Clear recent connections
   */
  clearRecent(): void {
    this.saveRecent([]);
  }

  /**
   * Get last connection
   */
  getLastConnection(): RecentConnection | null {
    const recent = this.loadRecent();
    return recent.length > 0 ? recent[0] : null;
  }

  // ============================================================================
  // Vessel paths management (folders opened per vessel)
  // ============================================================================

  /**
   * Generate a unique key for a vessel
   */
  private getVesselKey(host: string, user: string, port: number): string {
    return `${user}@${host}:${port}`;
  }

  /**
   * Load vessel paths storage
   */
  private loadVesselPaths(): VesselPathsStorage {
    try {
      if (!fs.existsSync(this.vesselPathsPath)) {
        return {};
      }
      const content = fs.readFileSync(this.vesselPathsPath, 'utf-8');
      return JSON.parse(content) as VesselPathsStorage;
    } catch (error) {
      console.error('SSHarbor: Error loading vessel paths:', error);
      return {};
    }
  }

  /**
   * Save vessel paths storage
   * Uses chmod 0o600 to ensure file is only readable by owner
   */
  private saveVesselPaths(storage: VesselPathsStorage): void {
    try {
      this.ensureStorageDir();
      fs.writeFileSync(this.vesselPathsPath, JSON.stringify(storage, null, 2), 'utf-8');

      // Set secure permissions (owner read/write only)
      if (os.platform() !== 'win32') {
        fs.chmodSync(this.vesselPathsPath, 0o600);
      }
    } catch (error) {
      console.error('SSHarbor: Error saving vessel paths:', error);
    }
  }

  /**
   * Get saved paths for a vessel
   */
  getVesselSavedPaths(host: string, user: string, port: number): string[] {
    const storage = this.loadVesselPaths();
    const key = this.getVesselKey(host, user, port);
    return storage[key] || [];
  }

  /**
   * Add a path to vessel's saved paths
   */
  addVesselPath(host: string, user: string, port: number, folderPath: string): void {
    const storage = this.loadVesselPaths();
    const key = this.getVesselKey(host, user, port);

    if (!storage[key]) {
      storage[key] = [];
    }

    // Remove if already exists (to move to top)
    storage[key] = storage[key].filter((p) => p !== folderPath);

    // Add at the beginning
    storage[key].unshift(folderPath);

    // Limit to 10 paths per vessel
    storage[key] = storage[key].slice(0, 10);

    this.saveVesselPaths(storage);
  }

  /**
   * Remove a path from vessel's saved paths
   */
  removeVesselPath(host: string, user: string, port: number, folderPath: string): void {
    const storage = this.loadVesselPaths();
    const key = this.getVesselKey(host, user, port);

    if (storage[key]) {
      storage[key] = storage[key].filter((p) => p !== folderPath);
      this.saveVesselPaths(storage);
    }
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private ensureStorageDir(): void {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Watch config file for external changes
   */
  watchConfig(): vscode.Disposable {
    const watcher = vscode.workspace.createFileSystemWatcher(this.configPath);

    watcher.onDidChange(() => this._onConfigChange.fire());
    watcher.onDidCreate(() => this._onConfigChange.fire());
    watcher.onDidDelete(() => this._onConfigChange.fire());

    return watcher;
  }

  /**
   * Watch vessel paths file for external changes (from remote sessions)
   */
  watchVesselPaths(callback: () => void): vscode.Disposable {
    const watcher = vscode.workspace.createFileSystemWatcher(this.vesselPathsPath);

    watcher.onDidChange(() => callback());
    watcher.onDidCreate(() => callback());

    return watcher;
  }

  /**
   * Dispose
   */
  dispose(): void {
    this._onConfigChange.dispose();
  }
}
