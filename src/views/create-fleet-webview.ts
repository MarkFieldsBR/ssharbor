import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager } from '../core/config';
import { Fleet } from '../types';
import { isValidFleetName } from '../core/security';

// Available VS Code icons for fleets
const FLEET_ICONS = [
  { id: 'server', label: 'Server', emoji: '🖥️' },
  { id: 'cloud', label: 'Cloud', emoji: '☁️' },
  { id: 'database', label: 'Database', emoji: '🗄️' },
  { id: 'globe', label: 'Globe', emoji: '🌐' },
  { id: 'home', label: 'Home', emoji: '🏠' },
  { id: 'shield', label: 'Shield', emoji: '🛡️' },
  { id: 'beaker', label: 'Beaker', emoji: '🧪' },
  { id: 'rocket', label: 'Rocket', emoji: '🚀' },
  { id: 'package', label: 'Package', emoji: '📦' },
  { id: 'organization', label: 'Organization', emoji: '🏢' },
  { id: 'plug', label: 'Plug', emoji: '🔌' },
  { id: 'radio-tower', label: 'Radio Tower', emoji: '📡' },
  { id: 'layers', label: 'Layers', emoji: '📚' },
  { id: 'terminal', label: 'Terminal', emoji: '💻' },
  { id: 'tools', label: 'Tools', emoji: '🔧' },
  { id: 'lock', label: 'Lock', emoji: '🔒' },
];

export class CreateFleetWebview {
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private context: vscode.ExtensionContext,
    private configManager: ConfigManager
  ) {}

  /**
   * Get available SSH keys from ~/.ssh/
   */
  private getSSHKeys(): string[] {
    const sshDir = path.join(os.homedir(), '.ssh');
    const keys: string[] = [];

    try {
      if (fs.existsSync(sshDir)) {
        const files = fs.readdirSync(sshDir);
        for (const file of files) {
          // Look for private keys (files without .pub extension that have a .pub counterpart)
          if (!file.endsWith('.pub') && !file.startsWith('.') && !file.includes('known_hosts') && !file.includes('config') && !file.includes('authorized')) {
            const pubFile = file + '.pub';
            if (files.includes(pubFile)) {
              keys.push(`~/.ssh/${file}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('SSHarbor: Error reading SSH keys:', error);
    }

    return keys;
  }

  show(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'ssharbor.createFleet',
      'Create Fleet',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    const sshKeys = this.getSSHKeys();
    this.panel.webview.html = this.getHtml(sshKeys);

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'save':
            await this.saveFleet(message.data);
            break;
          case 'cancel':
            this.panel?.dispose();
            break;
          case 'validate':
            this.validateField(message.field, message.value);
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  private async saveFleet(data: any): Promise<void> {
    const { name, icon, defaultUser, defaultPort, defaultIdentityFile } = data;

    if (!name) {
      this.sendError('Fleet name is required');
      return;
    }

    if (!isValidFleetName(name)) {
      this.sendError('Invalid fleet name');
      return;
    }

    // Check if fleet already exists
    const config = this.configManager.loadConfig();
    if (config.fleets.some(f => f.name.toLowerCase() === name.toLowerCase())) {
      this.sendError('A fleet with this name already exists');
      return;
    }

    const fleet: Fleet = {
      name,
      icon: icon || 'folder',
      vessels: [],
      defaults: {},
    };

    if (defaultUser) {
      fleet.defaults!.user = defaultUser;
    }
    if (defaultPort) {
      fleet.defaults!.port = parseInt(defaultPort, 10);
    }
    if (defaultIdentityFile) {
      fleet.defaults!.identityFile = defaultIdentityFile;
    }

    // Remove empty defaults
    if (Object.keys(fleet.defaults!).length === 0) {
      delete fleet.defaults;
    }

    try {
      this.configManager.addFleet(fleet);
      vscode.window.showInformationMessage(`Fleet "${name}" created successfully!`);
      this.panel?.dispose();
    } catch (error) {
      this.sendError(`Failed to create fleet: ${error}`);
    }
  }

  private validateField(field: string, value: string): void {
    let valid = true;
    let message = '';

    switch (field) {
      case 'name':
        if (!value) {
          valid = false;
          message = 'Name is required';
        } else if (!isValidFleetName(value)) {
          valid = false;
          message = 'Use letters, numbers, spaces, hyphens, or underscores';
        } else {
          const config = this.configManager.loadConfig();
          if (config.fleets.some(f => f.name.toLowerCase() === value.toLowerCase())) {
            valid = false;
            message = 'Fleet already exists';
          }
        }
        break;
    }

    this.panel?.webview.postMessage({
      command: 'validation',
      field,
      valid,
      message,
    });
  }

  private sendError(message: string): void {
    this.panel?.webview.postMessage({
      command: 'error',
      message,
    });
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Generate a nonce for CSP
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private getHtml(sshKeys: string[]): string {
    const nonce = this.getNonce();

    // FLEET_ICONS are hardcoded constants, but escape for safety
    const iconOptions = FLEET_ICONS
      .map(i => `
        <button type="button" class="icon-btn" data-icon="${this.escapeHtml(i.id)}" title="${this.escapeHtml(i.label)}">
          <span class="icon-emoji">${i.emoji}</span>
        </button>
      `)
      .join('');

    // SSH keys are from local filesystem, but still escape for safety
    const keyOptions = sshKeys
      .map(k => `<option value="${this.escapeHtml(k)}">${this.escapeHtml(k)}</option>`)
      .join('');

    return /*html*/ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Create Fleet</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --input-bg: var(--vscode-input-background);
      --input-border: var(--vscode-input-border);
      --input-fg: var(--vscode-input-foreground);
      --button-bg: var(--vscode-button-background);
      --button-fg: var(--vscode-button-foreground);
      --button-hover: var(--vscode-button-hoverBackground);
      --button-secondary-bg: var(--vscode-button-secondaryBackground);
      --button-secondary-fg: var(--vscode-button-secondaryForeground);
      --button-secondary-hover: var(--vscode-button-secondaryHoverBackground);
      --error: var(--vscode-errorForeground);
      --success: var(--vscode-charts-green);
      --border-radius: 6px;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: calc(var(--vscode-font-size) * 1.1);
      color: var(--fg);
      background: var(--bg);
      padding: 28px;
      max-width: 560px;
      margin: 0 auto;
    }

    .header {
      text-align: center;
      margin-bottom: 36px;
    }

    .header-icon {
      font-size: 54px;
      margin-bottom: 14px;
      display: block;
    }

    .header h1 {
      font-size: 27px;
      font-weight: 600;
      margin-bottom: 9px;
    }

    .header p {
      font-size: 15px;
      opacity: 0.7;
    }

    .form-section {
      margin-bottom: 28px;
    }

    .section-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.6;
      margin-bottom: 14px;
    }

    .form-group {
      margin-bottom: 18px;
    }

    label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 7px;
    }

    label .required {
      color: var(--error);
    }

    input, select {
      width: 100%;
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      color: var(--input-fg);
      padding: 12px 14px;
      border-radius: var(--border-radius);
      font-size: 15px;
      font-family: inherit;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    input:focus, select:focus {
      outline: none;
      border-color: var(--button-bg);
      box-shadow: 0 0 0 2px rgba(0, 127, 212, 0.25);
    }

    input.error {
      border-color: var(--error);
    }

    input.valid {
      border-color: var(--success);
    }

    .field-error {
      font-size: 12px;
      color: var(--error);
      margin-top: 5px;
      min-height: 18px;
    }

    .icon-picker {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 10px;
    }

    .icon-btn {
      width: 46px;
      height: 46px;
      border: 2px solid var(--input-border);
      border-radius: var(--border-radius);
      background: var(--input-bg);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .icon-btn:hover {
      border-color: var(--button-bg);
      transform: scale(1.1);
    }

    .icon-btn.selected {
      border-color: var(--button-bg);
      background: var(--button-bg);
    }

    .icon-emoji {
      font-size: 20px;
    }

    .defaults-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .defaults-grid .full {
      grid-column: 1 / -1;
    }

    .actions {
      display: flex;
      gap: 0;
      margin-top: 36px;
    }

    .actions button {
      flex: 1;
      padding: 14px 20px;
      border-radius: 0;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .actions button:first-child {
      border-radius: var(--border-radius) 0 0 var(--border-radius);
    }

    .actions button:last-child {
      border-radius: 0 var(--border-radius) var(--border-radius) 0;
    }

    .btn-primary {
      background: var(--button-bg);
      color: var(--button-fg);
    }

    .btn-primary:hover {
      background: var(--button-hover);
    }

    .btn-secondary {
      background: var(--button-secondary-bg, rgba(255, 255, 255, 0.1));
      color: var(--button-secondary-fg, var(--fg));
      border-right: 1px solid var(--input-border) !important;
    }

    .btn-secondary:hover {
      background: var(--button-secondary-hover, rgba(255, 255, 255, 0.15));
    }

    .btn-icon {
      font-size: 16px;
    }

    .error-toast {
      position: fixed;
      bottom: 28px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--error);
      color: white;
      padding: 14px 28px;
      border-radius: var(--border-radius);
      font-size: 15px;
      display: none;
      animation: slideUp 0.3s ease;
    }

    .error-toast.show {
      display: block;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }

    .preview-card {
      background: rgba(0, 0, 0, 0.2);
      border-radius: var(--border-radius);
      padding: 18px;
      display: flex;
      align-items: center;
      gap: 14px;
      margin-top: 28px;
    }

    .preview-icon {
      font-size: 36px;
    }

    .preview-name {
      font-size: 18px;
      font-weight: 500;
    }

    .preview-meta {
      font-size: 14px;
      opacity: 0.6;
      margin-top: 3px;
    }

    .description {
      font-size: 13px;
      opacity: 0.6;
      margin-bottom: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="header-icon">⚓</span>
    <h1>Create New Fleet</h1>
    <p>Organize your vessels into a fleet</p>
  </div>

  <form id="fleetForm">
    <div class="form-section">
      <div class="section-title">Fleet Info</div>
      <div class="form-group">
        <label for="name">Fleet Name <span class="required">*</span></label>
        <input type="text" id="name" name="name" placeholder="e.g., Production, Development, AWS" required autofocus>
        <div class="field-error" id="name-error"></div>
      </div>

      <div class="form-group">
        <label>Icon</label>
        <div class="icon-picker">
          ${iconOptions}
        </div>
        <input type="hidden" id="icon" name="icon" value="server">
      </div>
    </div>

    <div class="form-section">
      <div class="section-title">Default Settings (Optional)</div>
      <p class="description">These will be used for all vessels in this fleet unless overridden.</p>

      <div class="defaults-grid">
        <div class="form-group">
          <label for="defaultUser">Default User</label>
          <input type="text" id="defaultUser" name="defaultUser" placeholder="root">
        </div>
        <div class="form-group">
          <label for="defaultPort">Default Port</label>
          <input type="text" id="defaultPort" name="defaultPort" placeholder="22">
        </div>
        <div class="form-group full">
          <label for="defaultIdentityFile">Default Identity File</label>
          <select id="defaultIdentityFile" name="defaultIdentityFile">
            <option value="">None (use system default)</option>
            ${keyOptions}
          </select>
        </div>
      </div>
    </div>

    <div class="preview-card">
      <span class="preview-icon" id="previewIcon">🖥️</span>
      <div>
        <div class="preview-name" id="previewName">New Fleet</div>
        <div class="preview-meta">0 vessels</div>
      </div>
    </div>

    <div class="actions">
      <button type="button" class="btn-secondary" id="cancelBtn">
        <span class="btn-icon">✕</span>
        Cancel
      </button>
      <button type="submit" class="btn-primary">
        <span class="btn-icon">⚓</span>
        Create Fleet
      </button>
    </div>
  </form>

  <div class="error-toast" id="errorToast"></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const icons = ${JSON.stringify(FLEET_ICONS)};

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function validateField(field) {
      const el = document.getElementById(field);
      if (el) {
        vscode.postMessage({ command: 'validate', field, value: el.value });
      }
    }

    function showError(message) {
      const errorToast = document.getElementById('errorToast');
      if (errorToast) {
        errorToast.textContent = message;
        errorToast.classList.add('show');
        setTimeout(() => errorToast.classList.remove('show'), 3000);
      }
    }

    function cancel() {
      vscode.postMessage({ command: 'cancel' });
    }

    // Handle messages
    window.addEventListener('message', (event) => {
      const message = event.data;

      if (message.command === 'validation') {
        const input = document.getElementById(message.field);
        const error = document.getElementById(message.field + '-error');

        if (input) {
          input.classList.remove('error', 'valid');
          if (input.value) {
            input.classList.add(message.valid ? 'valid' : 'error');
          }
        }
        if (error) {
          error.textContent = message.message;
        }
      }

      if (message.command === 'error') {
        showError(message.message);
      }
    });

    // Initialize when DOM is ready
    function init() {
      const form = document.getElementById('fleetForm');
      const iconInput = document.getElementById('icon');
      const nameInput = document.getElementById('name');
      const previewIcon = document.getElementById('previewIcon');
      const previewName = document.getElementById('previewName');
      const cancelBtn = document.getElementById('cancelBtn');

      // Select first icon by default
      const firstIconBtn = document.querySelector('.icon-btn');
      if (firstIconBtn) firstIconBtn.classList.add('selected');

      // Icon selection
      document.querySelectorAll('.icon-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.icon-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          if (iconInput) iconInput.value = btn.dataset.icon;

          const icon = icons.find(i => i.id === btn.dataset.icon);
          if (previewIcon) previewIcon.textContent = icon ? icon.emoji : '📁';
        });
      });

      // Update preview name
      if (nameInput) {
        nameInput.addEventListener('input', () => {
          if (previewName) previewName.textContent = nameInput.value || 'New Fleet';
          validateField('name');
        });
        nameInput.addEventListener('blur', () => validateField('name'));
      }

      // Form submit
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();

          const data = {
            name: document.getElementById('name')?.value || '',
            icon: document.getElementById('icon')?.value || '',
            defaultUser: document.getElementById('defaultUser')?.value || '',
            defaultPort: document.getElementById('defaultPort')?.value || '',
            defaultIdentityFile: document.getElementById('defaultIdentityFile')?.value || '',
          };

          vscode.postMessage({ command: 'save', data });
        });
      }

      // Cancel button
      if (cancelBtn) cancelBtn.addEventListener('click', cancel);
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  </script>
</body>
</html>
`;
  }
}
