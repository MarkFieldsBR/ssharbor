import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager } from '../core/config';
import { Vessel, Fleet } from '../types';
import { isValidHost, isValidUser, isValidPort, isValidVesselName } from '../core/security';

export class AddVesselWebview {
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

  show(fleetName?: string): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'ssharbor.addVessel',
      'Add Vessel',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    const config = this.configManager.loadConfig();
    const fleets = config.fleets;
    const sshKeys = this.getSSHKeys();

    this.panel.webview.html = this.getHtml(fleets, sshKeys, fleetName);

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'save':
            await this.saveVessel(message.data);
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

  private async saveVessel(data: any): Promise<void> {
    const { fleet, name, host, user, port, identityFile, tags, favorite, notes } = data;

    // Validate
    if (!fleet) {
      this.sendError('Please select a fleet');
      return;
    }
    if (!host || !isValidHost(host)) {
      this.sendError('Invalid hostname or IP address');
      return;
    }
    if (user && !isValidUser(user)) {
      this.sendError('Invalid username');
      return;
    }
    if (port && !isValidPort(port)) {
      this.sendError('Invalid port (1-65535)');
      return;
    }

    const vessel: Vessel = {
      name: name || host,
      host,
      user: user || undefined,
      port: port ? parseInt(port, 10) : undefined,
      identityFile: identityFile || undefined,
      tags: tags ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : undefined,
      favorite: favorite || false,
      notes: notes || undefined,
    };

    try {
      this.configManager.addVessel(fleet, vessel);
      vscode.window.showInformationMessage(`Vessel "${vessel.name}" added to "${fleet}"`);
      this.panel?.dispose();
    } catch (error) {
      this.sendError(`Failed to add vessel: ${error}`);
    }
  }

  private validateField(field: string, value: string): void {
    let valid = true;
    let message = '';

    switch (field) {
      case 'host':
        valid = !value || isValidHost(value);
        message = valid ? '' : 'Invalid hostname or IP';
        break;
      case 'user':
        valid = !value || isValidUser(value);
        message = valid ? '' : 'Invalid username';
        break;
      case 'port':
        valid = !value || isValidPort(value);
        message = valid ? '' : 'Port must be 1-65535';
        break;
      case 'name':
        valid = !value || isValidVesselName(value);
        message = valid ? '' : 'Invalid name';
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

  private getHtml(fleets: Fleet[], sshKeys: string[], selectedFleet?: string): string {
    const nonce = this.getNonce();

    // Escape fleet names to prevent XSS
    const fleetOptions = fleets
      .map((f) => `<option value="${this.escapeHtml(f.name)}" ${f.name === selectedFleet ? 'selected' : ''} data-identity="${this.escapeHtml(f.defaults?.identityFile || '')}" data-user="${this.escapeHtml(f.defaults?.user || '')}" data-port="${f.defaults?.port || ''}">${this.escapeHtml(f.name)}</option>`)
      .join('');

    // SSH keys are from local filesystem, but still escape for safety
    const keyOptions = sshKeys
      .map(k => `<option value="${this.escapeHtml(k)}">${this.escapeHtml(k)}</option>`)
      .join('');

    // Get selected fleet defaults
    const selected = fleets.find(f => f.name === selectedFleet);
    const defaultIdentity = this.escapeHtml(selected?.defaults?.identityFile || '');
    const defaultUser = this.escapeHtml(selected?.defaults?.user || '');
    const defaultPort = selected?.defaults?.port || '';

    return /*html*/ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Add Vessel</title>
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
      max-width: 660px;
      margin: 0 auto;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 28px;
      padding-bottom: 18px;
      border-bottom: 1px solid var(--input-border);
    }

    .header-icon {
      font-size: 36px;
    }

    .header h1 {
      font-size: 22px;
      font-weight: 600;
    }

    .header p {
      font-size: 14px;
      opacity: 0.7;
      margin-top: 4px;
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

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      margin-bottom: 18px;
    }

    .form-row.full {
      grid-template-columns: 1fr;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }

    label {
      font-size: 14px;
      font-weight: 500;
    }

    label .required {
      color: var(--error);
    }

    input, select, textarea {
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      color: var(--input-fg);
      padding: 12px 14px;
      border-radius: var(--border-radius);
      font-size: 15px;
      font-family: inherit;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: var(--button-bg);
      box-shadow: 0 0 0 2px rgba(0, 127, 212, 0.25);
    }

    input.error, select.error {
      border-color: var(--error);
    }

    input.valid {
      border-color: var(--success);
    }

    .field-error {
      font-size: 12px;
      color: var(--error);
      min-height: 18px;
    }

    textarea {
      resize: vertical;
      min-height: 70px;
    }

    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 10px;
    }

    .checkbox-group input[type="checkbox"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }

    .checkbox-group label {
      cursor: pointer;
      font-weight: normal;
      font-size: 15px;
    }

    .preview {
      background: rgba(0, 0, 0, 0.2);
      border-radius: var(--border-radius);
      padding: 18px;
      margin-top: 10px;
    }

    .preview-label {
      font-size: 12px;
      opacity: 0.6;
      margin-bottom: 10px;
    }

    .preview-command {
      font-family: var(--vscode-editor-font-family), monospace;
      font-size: 15px;
      color: var(--success);
      word-break: break-all;
    }

    .actions {
      display: flex;
      gap: 0;
      margin-top: 28px;
      padding-top: 28px;
      border-top: 1px solid var(--input-border);
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

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
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
  </style>
</head>
<body>
  <div class="header">
    <span class="header-icon">🚢</span>
    <div>
      <h1>Add New Vessel</h1>
      <p>Configure a new SSH connection</p>
    </div>
  </div>

  <form id="vesselForm">
    <div class="form-section">
      <div class="section-title">Fleet</div>
      <div class="form-row full">
        <div class="form-group">
          <label for="fleet">Select Fleet <span class="required">*</span></label>
          <select id="fleet" name="fleet" required>
            <option value="">Choose a fleet...</option>
            ${fleetOptions}
          </select>
        </div>
      </div>
    </div>

    <div class="form-section">
      <div class="section-title">Connection</div>
      <div class="form-row">
        <div class="form-group">
          <label for="host">Host <span class="required">*</span></label>
          <input type="text" id="host" name="host" placeholder="192.168.1.1 or server.example.com" required>
          <div class="field-error" id="host-error"></div>
        </div>
        <div class="form-group">
          <label for="port">Port</label>
          <input type="text" id="port" name="port" placeholder="${defaultPort || '22'}" value="${defaultPort || ''}">
          <div class="field-error" id="port-error"></div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="user">Username</label>
          <input type="text" id="user" name="user" placeholder="${defaultUser || 'root'}" value="${defaultUser || ''}">
          <div class="field-error" id="user-error"></div>
        </div>
        <div class="form-group">
          <label for="identityFile">Identity File</label>
          <select id="identityFile" name="identityFile">
            <option value="">None (use system default)</option>
            ${keyOptions}
          </select>
        </div>
      </div>
    </div>

    <div class="form-section">
      <div class="section-title">Display</div>
      <div class="form-row">
        <div class="form-group">
          <label for="name">Display Name</label>
          <input type="text" id="name" name="name" placeholder="My Server">
          <div class="field-error" id="name-error"></div>
        </div>
        <div class="form-group">
          <label for="tags">Tags</label>
          <input type="text" id="tags" name="tags" placeholder="web, nginx, prod">
        </div>
      </div>
      <div class="form-row full">
        <div class="form-group">
          <label for="notes">Notes</label>
          <textarea id="notes" name="notes" placeholder="Optional notes about this server..."></textarea>
        </div>
      </div>
      <div class="checkbox-group">
        <input type="checkbox" id="favorite" name="favorite">
        <label for="favorite">⭐ Add to favorites</label>
      </div>
    </div>

    <div class="form-section">
      <div class="section-title">Preview</div>
      <div class="preview">
        <div class="preview-label">SSH Command</div>
        <div class="preview-command" id="preview">ssh root@hostname</div>
      </div>
    </div>

    <div class="actions">
      <button type="button" class="btn-secondary" id="cancelBtn">
        <span class="btn-icon">✕</span>
        Cancel
      </button>
      <button type="submit" class="btn-primary" id="submitBtn">
        <span class="btn-icon">🚢</span>
        Add Vessel
      </button>
    </div>
  </form>

  <div class="error-toast" id="errorToast"></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

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

    // Handle validation response
    window.addEventListener('message', (event) => {
      const message = event.data;

      if (message.command === 'validation') {
        const input = document.getElementById(message.field);
        const error = document.getElementById(message.field + '-error');

        if (input) {
          input.classList.remove('error', 'valid');
          if (message.value) {
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
      const form = document.getElementById('vesselForm');
      const preview = document.getElementById('preview');
      const fleetSelect = document.getElementById('fleet');
      const identitySelect = document.getElementById('identityFile');
      const userInput = document.getElementById('user');
      const portInput = document.getElementById('port');
      const cancelBtn = document.getElementById('cancelBtn');

      // Update preview
      function updatePreview() {
        const hostEl = document.getElementById('host');
        const host = hostEl ? hostEl.value || 'hostname' : 'hostname';
        const user = userInput ? (userInput.value || userInput.placeholder || 'root') : 'root';
        const port = portInput ? (portInput.value || portInput.placeholder) : '22';
        const identity = identitySelect ? identitySelect.value : '';

        let cmd = 'ssh';
        if (identity) cmd += ' -i ' + identity;
        if (port && port !== '22') cmd += ' -p ' + port;
        cmd += ' ' + user + '@' + host;

        if (preview) preview.textContent = cmd;
      }

      // Set initial identity file from fleet defaults
      const initialIdentity = '${defaultIdentity}';
      if (initialIdentity && identitySelect) {
        identitySelect.value = initialIdentity;
      }

      // Update defaults when fleet changes
      if (fleetSelect) {
        fleetSelect.addEventListener('change', () => {
          const selected = fleetSelect.options[fleetSelect.selectedIndex];
          const fleetIdentity = selected.dataset.identity;
          const fleetUser = selected.dataset.user;
          const fleetPort = selected.dataset.port;

          if (identitySelect) {
            identitySelect.value = fleetIdentity || '';
          }

          if (fleetUser && userInput && !userInput.value) {
            userInput.placeholder = fleetUser;
          }

          if (fleetPort && portInput && !portInput.value) {
            portInput.placeholder = fleetPort || '22';
          }

          updatePreview();
        });
      }

      // Add event listeners for form fields
      ['host', 'user', 'port', 'name'].forEach(field => {
        const el = document.getElementById(field);
        if (el) {
          el.addEventListener('input', updatePreview);
          el.addEventListener('blur', () => validateField(field));
        }
      });

      if (identitySelect) {
        identitySelect.addEventListener('change', updatePreview);
      }

      // Form submit
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();

          const data = {
            fleet: document.getElementById('fleet')?.value || '',
            name: document.getElementById('name')?.value || '',
            host: document.getElementById('host')?.value || '',
            user: document.getElementById('user')?.value || '',
            port: document.getElementById('port')?.value || '',
            identityFile: document.getElementById('identityFile')?.value || '',
            tags: document.getElementById('tags')?.value || '',
            favorite: document.getElementById('favorite')?.checked || false,
            notes: document.getElementById('notes')?.value || '',
          };

          vscode.postMessage({ command: 'save', data });
        });
      }

      // Cancel button
      if (cancelBtn) {
        cancelBtn.addEventListener('click', cancel);
      }

      // Initial preview
      updatePreview();
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
