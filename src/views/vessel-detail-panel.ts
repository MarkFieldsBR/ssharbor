import * as vscode from 'vscode';
import { SSHConnectionInfo } from '../types';
import { ConfigManager } from '../core/config';

export class VesselDetailPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ssharbor.vesselDetail';

  private _view?: vscode.WebviewView;
  private _currentVessel?: SSHConnectionInfo;
  private _configManager?: ConfigManager;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public setConfigManager(configManager: ConfigManager): void {
    this._configManager = configManager;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    // Generate nonce for CSP
    const nonce = this._getNonce();

    webviewView.webview.html = this._getHtml(nonce);

    webviewView.webview.onDidReceiveMessage((message) => {
      if (!this._currentVessel) return;

      switch (message.command) {
        case 'connect':
          vscode.commands.executeCommand('ssharbor.connect', this._currentVessel);
          break;
        case 'connectNewWindow':
          vscode.commands.executeCommand('ssharbor.connectNewWindow', this._currentVessel);
          break;
        case 'copy':
          vscode.commands.executeCommand('ssharbor.copyCommand', this._currentVessel);
          break;
        case 'copyHost':
          vscode.commands.executeCommand('ssharbor.copyHost', this._currentVessel);
          break;
        case 'favorite':
          vscode.commands.executeCommand('ssharbor.toggleFavorite', { connectionInfo: this._currentVessel });
          break;
        case 'remove':
          vscode.commands.executeCommand('ssharbor.removeVessel', { connectionInfo: this._currentVessel });
          break;
        case 'openFolder':
          // Open specific folder directly
          vscode.commands.executeCommand('ssharbor.connectToFolder', this._currentVessel, message.path);
          break;
        case 'removeFolder':
          // Remove folder from saved paths
          if (this._configManager && message.path) {
            this._configManager.removeVesselPath(
              this._currentVessel.host,
              this._currentVessel.user,
              this._currentVessel.port,
              message.path
            );
            // Refresh the panel
            this.updateVessel(this._currentVessel);
          }
          break;
      }
    });
  }

  public updateVessel(vessel: SSHConnectionInfo | undefined): void {
    this._currentVessel = vessel;

    // Get saved paths for this vessel
    let savedPaths: string[] = [];
    if (vessel && this._configManager) {
      savedPaths = this._configManager.getVesselSavedPaths(vessel.host, vessel.user, vessel.port);
    }

    if (this._view) {
      this._view.webview.postMessage({
        command: 'update',
        vessel: vessel,
        savedPaths: savedPaths,
      });
    }

    // Update context for view visibility
    vscode.commands.executeCommand('setContext', 'ssharbor.vesselSelected', !!vessel);
  }

  /**
   * Refresh the current vessel's data (e.g., when paths change externally)
   */
  public refresh(): void {
    if (this._currentVessel) {
      this.updateVessel(this._currentVessel);
    }
  }

  /**
   * Generate a nonce for CSP
   */
  private _getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private _getHtml(nonce: string): string {
    return /*html*/ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Vessel Details</title>
  <style>
    :root {
      --bg: var(--vscode-sideBar-background);
      --fg: var(--vscode-foreground, #cccccc);
      --fg-muted: var(--vscode-descriptionForeground, #888888);
      --input-bg: var(--vscode-input-background);
      --input-border: var(--vscode-panel-border, rgba(128,128,128,0.35));
      --button-bg: var(--vscode-button-background, #0e639c);
      --button-fg: var(--vscode-button-foreground, #ffffff);
      --button-hover: var(--vscode-button-hoverBackground, #1177bb);
      --button-secondary-bg: var(--vscode-button-secondaryBackground, #3a3d41);
      --button-secondary-fg: var(--vscode-button-secondaryForeground, #ffffff);
      --danger: #f14c4c;
      --danger-bg: rgba(241, 76, 76, 0.08);
      --success: #89d185;
      --warning: #cca700;
      --ocean: #0077b6;
      --ocean-light: #00b4d8;
      --ocean-dark: #023e8a;
      --border-radius: 8px;
      --card-bg: var(--vscode-editor-background, #1e1e1e);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: 13px;
      color: var(--fg);
      background: var(--bg);
      padding: 16px;
    }

    .empty-state {
      text-align: center;
      padding: 40px 16px;
      color: var(--fg-muted);
    }

    .empty-state .icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .empty-state .title {
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 8px;
      color: var(--fg);
    }

    .empty-state .subtitle {
      font-size: 12px;
      color: var(--fg-muted);
    }

    .vessel-card {
      display: none;
    }

    .vessel-card.visible {
      display: block;
    }

    .vessel-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--input-border);
    }

    .vessel-icon {
      font-size: 36px;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    }

    .vessel-name {
      font-size: 17px;
      font-weight: 700;
      color: var(--fg);
      letter-spacing: -0.3px;
    }

    .vessel-fleet {
      font-size: 11px;
      color: var(--fg-muted);
      margin-top: 4px;
      font-weight: 500;
    }

    .vessel-info {
      margin-bottom: 16px;
      background: var(--card-bg);
      border-radius: var(--border-radius);
      padding: 14px;
      border: 1px solid var(--input-border);
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid var(--input-border);
    }

    .info-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .info-row:first-child {
      padding-top: 0;
    }

    .info-label {
      color: var(--fg-muted);
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .info-value {
      font-family: var(--vscode-editor-font-family), monospace;
      font-size: 12px;
      color: var(--fg);
      font-weight: 500;
    }

    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 14px;
    }

    .tag {
      background: linear-gradient(135deg, var(--ocean-dark) 0%, var(--ocean) 100%);
      color: #ffffff;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .saved-paths {
      margin-bottom: 18px;
    }

    .saved-paths-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      font-weight: 700;
      color: var(--fg-muted);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 10px;
    }

    .saved-paths-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .saved-path-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: var(--card-bg);
      border: 1px solid var(--input-border);
      border-radius: var(--border-radius);
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .saved-path-item:hover {
      border-color: var(--ocean);
      background: linear-gradient(135deg, rgba(0,119,182,0.1) 0%, rgba(0,180,216,0.05) 100%);
      transform: translateX(4px);
    }

    .saved-path-icon {
      font-size: 18px;
      flex-shrink: 0;
    }

    .saved-path-name {
      flex: 1;
      font-size: 12px;
      font-weight: 600;
      color: var(--fg);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .saved-path-full {
      font-size: 10px;
      color: var(--fg-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .saved-path-remove {
      font-size: 14px;
      color: var(--fg-muted);
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 4px;
      opacity: 0;
      transition: all 0.15s ease;
    }

    .saved-path-item:hover .saved-path-remove {
      opacity: 1;
    }

    .saved-path-remove:hover {
      color: var(--danger);
      background: var(--danger-bg);
    }

    /* ====== BUTTONS ====== */
    .actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 16px;
      border: none;
      border-radius: var(--border-radius);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
      position: relative;
      overflow: hidden;
    }

    .action-btn::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
      transition: left 0.5s ease;
    }

    .action-btn:hover::before {
      left: 100%;
    }

    .action-btn .icon {
      font-size: 16px;
    }

    /* Primary - Board the Vessel */
    .action-btn.primary {
      background: linear-gradient(135deg, var(--ocean-dark) 0%, var(--ocean) 50%, var(--ocean-light) 100%);
      color: #ffffff;
      padding: 16px 20px;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.3px;
      box-shadow: 0 4px 15px rgba(0,119,182,0.4);
      text-shadow: 0 1px 2px rgba(0,0,0,0.2);
    }

    .action-btn.primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0,119,182,0.5);
    }

    .action-btn.primary:active {
      transform: translateY(0);
    }

    /* Secondary buttons row */
    .action-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .action-btn.secondary {
      background: var(--button-secondary-bg);
      color: var(--button-secondary-fg);
      border: 1px solid var(--input-border);
    }

    .action-btn.secondary:hover {
      background: var(--button-secondary-bg);
      border-color: var(--fg-muted);
      transform: translateY(-1px);
    }

    /* Favorite */
    .action-btn.favorite {
      background: linear-gradient(135deg, #b8860b 0%, #daa520 50%, #ffd700 100%);
      color: #1a1a1a;
      border: none;
      box-shadow: 0 3px 10px rgba(218,165,32,0.3);
    }

    .action-btn.favorite:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 15px rgba(218,165,32,0.4);
    }

    .action-btn.favorite.unfav {
      background: var(--button-secondary-bg);
      color: var(--warning);
      border: 1px solid var(--warning);
      box-shadow: none;
    }

    .action-btn.favorite.unfav:hover {
      background: rgba(204, 167, 0, 0.15);
    }

    /* Danger - Scuttle */
    .action-btn.danger {
      background: transparent;
      color: var(--danger);
      border: 1px solid rgba(241, 76, 76, 0.4);
    }

    .action-btn.danger:hover {
      background: linear-gradient(135deg, #c41e3a 0%, #f14c4c 100%);
      color: #ffffff;
      border-color: transparent;
      transform: translateY(-1px);
      box-shadow: 0 3px 10px rgba(241,76,76,0.3);
    }
  </style>
</head>
<body>
  <div class="empty-state" id="emptyState">
    <div class="icon">⚓</div>
    <div class="title">No Vessel Selected</div>
    <div class="subtitle">Click on a vessel in the Harbor to see its details and available actions</div>
  </div>

  <div class="vessel-card" id="vesselCard">
    <div class="vessel-header">
      <span class="vessel-icon" id="vesselIcon">🚢</span>
      <div>
        <div class="vessel-name" id="vesselName">Vessel Name</div>
        <div class="vessel-fleet" id="vesselFleet">Fleet Name</div>
      </div>
    </div>

    <div class="vessel-info">
      <div class="info-row">
        <span class="info-label">Host</span>
        <span class="info-value" id="vesselHost">-</span>
      </div>
      <div class="info-row">
        <span class="info-label">User</span>
        <span class="info-value" id="vesselUser">-</span>
      </div>
      <div class="info-row">
        <span class="info-label">Port</span>
        <span class="info-value" id="vesselPort">-</span>
      </div>
      <div class="info-row" id="keyRow" style="display: none;">
        <span class="info-label">Key</span>
        <span class="info-value" id="vesselKey">-</span>
      </div>
    </div>

    <div class="tags" id="tagsContainer"></div>

    <div class="saved-paths" id="savedPathsSection" style="display: none;">
      <div class="saved-paths-header">
        <span>🛟</span>
        <span>Moored Locations</span>
      </div>
      <div class="saved-paths-list" id="savedPathsList"></div>
    </div>

    <div class="actions">
      <button class="action-btn primary" id="btnConnect">
        <span class="icon">🚀</span>
        Board the Vessel
      </button>

      <div class="action-row">
        <button class="action-btn secondary" id="btnCopy">
          <span class="icon">📋</span>
          Copy SSH
        </button>
        <button class="action-btn favorite" id="favoriteBtn">
          <span class="icon">⭐</span>
          Favorite
        </button>
      </div>

      <div class="action-row">
        <button class="action-btn secondary" id="btnTerminal">
          <span class="icon">💻</span>
          Terminal
        </button>
        <button class="action-btn danger" id="btnScuttle">
          <span class="icon">🔱</span>
          Scuttle
        </button>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    const emptyState = document.getElementById('emptyState');
    const vesselCard = document.getElementById('vesselCard');
    const vesselIcon = document.getElementById('vesselIcon');
    const vesselName = document.getElementById('vesselName');
    const vesselFleet = document.getElementById('vesselFleet');
    const vesselHost = document.getElementById('vesselHost');
    const vesselUser = document.getElementById('vesselUser');
    const vesselPort = document.getElementById('vesselPort');
    const vesselKey = document.getElementById('vesselKey');
    const keyRow = document.getElementById('keyRow');
    const tagsContainer = document.getElementById('tagsContainer');
    const favoriteBtn = document.getElementById('favoriteBtn');
    const savedPathsSection = document.getElementById('savedPathsSection');
    const savedPathsList = document.getElementById('savedPathsList');

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    window.addEventListener('message', (event) => {
      const message = event.data;

      if (message.command === 'update') {
        const vessel = message.vessel;

        if (!vessel) {
          emptyState.style.display = 'block';
          vesselCard.classList.remove('visible');
          return;
        }

        emptyState.style.display = 'none';
        vesselCard.classList.add('visible');

        vesselIcon.textContent = vessel.favorite ? '⭐' : '🚢';
        vesselName.textContent = vessel.name || vessel.host;
        vesselFleet.textContent = 'Fleet: ' + vessel.fleetName;
        vesselHost.textContent = vessel.host;
        vesselUser.textContent = vessel.user;
        vesselPort.textContent = vessel.port;

        if (vessel.identityFile) {
          keyRow.style.display = 'flex';
          vesselKey.textContent = vessel.identityFile;
        } else {
          keyRow.style.display = 'none';
        }

        // Tags (using textContent to prevent XSS)
        tagsContainer.innerHTML = '';
        if (vessel.tags && vessel.tags.length > 0) {
          vessel.tags.forEach(tag => {
            const span = document.createElement('span');
            span.className = 'tag';
            span.textContent = tag; // Safe: textContent escapes HTML
            tagsContainer.appendChild(span);
          });
        }

        // Favorite button
        if (vessel.favorite) {
          favoriteBtn.innerHTML = '<span class="icon">⭐</span> Unfavorite';
          favoriteBtn.classList.add('unfav');
        } else {
          favoriteBtn.innerHTML = '<span class="icon">⭐</span> Favorite';
          favoriteBtn.classList.remove('unfav');
        }

        // Saved Paths (Moored Locations) - using safe DOM manipulation to prevent XSS
        const savedPaths = message.savedPaths || [];
        if (savedPaths.length > 0) {
          savedPathsSection.style.display = 'block';
          savedPathsList.innerHTML = '';

          savedPaths.forEach(p => {
            const folderName = p.split('/').pop() || p;
            const item = document.createElement('div');
            item.className = 'saved-path-item';

            // Build DOM safely without innerHTML to prevent XSS
            const iconSpan = document.createElement('span');
            iconSpan.className = 'saved-path-icon';
            iconSpan.textContent = '🛟';

            const contentDiv = document.createElement('div');
            contentDiv.style.cssText = 'flex: 1; min-width: 0;';

            const nameDiv = document.createElement('div');
            nameDiv.className = 'saved-path-name';
            nameDiv.textContent = folderName; // Safe: textContent escapes HTML

            const fullDiv = document.createElement('div');
            fullDiv.className = 'saved-path-full';
            fullDiv.textContent = p; // Safe: textContent escapes HTML

            contentDiv.appendChild(nameDiv);
            contentDiv.appendChild(fullDiv);

            const removeSpan = document.createElement('span');
            removeSpan.className = 'saved-path-remove';
            removeSpan.textContent = '✕';
            removeSpan.title = 'Remove';
            removeSpan.onclick = (event) => {
              event.stopPropagation();
              removeFolder(p);
            };

            item.appendChild(iconSpan);
            item.appendChild(contentDiv);
            item.appendChild(removeSpan);
            item.onclick = () => openFolder(p);
            savedPathsList.appendChild(item);
          });
        } else {
          savedPathsSection.style.display = 'none';
        }
      }
    });

    function action(cmd) {
      vscode.postMessage({ command: cmd });
    }

    function openFolder(path) {
      vscode.postMessage({ command: 'openFolder', path: path });
    }

    function removeFolder(path) {
      vscode.postMessage({ command: 'removeFolder', path: path });
    }

    // Add event listeners (CSP blocks inline onclick handlers)
    function setupEventListeners() {
      const btnConnect = document.getElementById('btnConnect');
      const btnCopy = document.getElementById('btnCopy');
      const favoriteBtn = document.getElementById('favoriteBtn');
      const btnTerminal = document.getElementById('btnTerminal');
      const btnScuttle = document.getElementById('btnScuttle');

      if (btnConnect) btnConnect.addEventListener('click', () => action('connect'));
      if (btnCopy) btnCopy.addEventListener('click', () => action('copy'));
      if (favoriteBtn) favoriteBtn.addEventListener('click', () => action('favorite'));
      if (btnTerminal) btnTerminal.addEventListener('click', () => action('connectNewWindow'));
      if (btnScuttle) btnScuttle.addEventListener('click', () => action('remove'));
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupEventListeners);
    } else {
      setupEventListeners();
    }
  </script>
</body>
</html>
`;
  }
}
