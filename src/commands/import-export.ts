import * as vscode from 'vscode';
import * as fs from 'fs';
import { ConfigManager } from '../core/config';
import { HarborTreeProvider } from '../providers/harbor-tree';
import { HarborConfig, Fleet } from '../types';

/**
 * Register import/export configuration commands
 */
export function registerImportExportCommands(
  context: vscode.ExtensionContext,
  configManager: ConfigManager,
  provider: HarborTreeProvider
): void {
  // Export command
  const exportCommand = vscode.commands.registerCommand(
    'ssharbor.exportConfig',
    async () => {
      const config = configManager.loadConfig();

      if (config.fleets.length === 0) {
        vscode.window.showWarningMessage('No fleets to export');
        return;
      }

      // Ask what to export
      const exportOptions = await vscode.window.showQuickPick(
        [
          { label: 'All Fleets', description: 'Export entire configuration', value: 'all' },
          { label: 'Select Fleets', description: 'Choose which fleets to export', value: 'select' },
        ],
        { placeHolder: 'What do you want to export?' }
      );

      if (!exportOptions) {
        return;
      }

      let exportConfig: HarborConfig;

      if (exportOptions.value === 'select') {
        const fleetItems = config.fleets.map((f) => ({
          label: f.name,
          description: `${f.vessels.length} vessel(s)`,
          picked: true,
          fleet: f,
        }));

        const selected = await vscode.window.showQuickPick(fleetItems, {
          canPickMany: true,
          placeHolder: 'Select fleets to export',
        });

        if (!selected || selected.length === 0) {
          return;
        }

        exportConfig = {
          $schema: config.$schema,
          defaults: config.defaults,
          fleets: selected.map((s) => s.fleet),
        };
      } else {
        exportConfig = config;
      }

      // Ask for save location
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file('ssharbor-config.json'),
        filters: { 'JSON Files': ['json'] },
        title: 'Export SSHarbor Configuration',
      });

      if (!saveUri) {
        return;
      }

      try {
        const json = JSON.stringify(exportConfig, null, 2);
        fs.writeFileSync(saveUri.fsPath, json, 'utf-8');

        const vesselCount = exportConfig.fleets.reduce((acc, f) => acc + f.vessels.length, 0);
        vscode.window.showInformationMessage(
          `Exported ${exportConfig.fleets.length} fleet(s) with ${vesselCount} vessel(s)`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to export: ${message}`);
      }
    }
  );

  // Import command
  const importCommand = vscode.commands.registerCommand(
    'ssharbor.importConfig',
    async () => {
      const files = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { 'JSON Files': ['json'] },
        title: 'Import SSHarbor Configuration',
      });

      if (!files || files.length === 0) {
        return;
      }

      try {
        const content = fs.readFileSync(files[0].fsPath, 'utf-8');
        const importedConfig: HarborConfig = JSON.parse(content);

        // Validate structure
        if (!importedConfig.fleets || !Array.isArray(importedConfig.fleets)) {
          vscode.window.showErrorMessage('Invalid configuration file: missing fleets array');
          return;
        }

        if (importedConfig.fleets.length === 0) {
          vscode.window.showWarningMessage('No fleets found in the configuration file');
          return;
        }

        // Validate each fleet
        for (const fleet of importedConfig.fleets) {
          if (!fleet.name || !fleet.vessels || !Array.isArray(fleet.vessels)) {
            vscode.window.showErrorMessage(
              `Invalid fleet structure: ${fleet.name || 'unnamed fleet'}`
            );
            return;
          }
        }

        // Ask user to select which fleets to import
        const fleetItems = importedConfig.fleets.map((f) => ({
          label: f.name,
          description: `${f.vessels.length} vessel(s)`,
          picked: true,
          fleet: f,
        }));

        const selected = await vscode.window.showQuickPick(fleetItems, {
          canPickMany: true,
          placeHolder: `Found ${importedConfig.fleets.length} fleet(s). Select which to import:`,
        });

        if (!selected || selected.length === 0) {
          return;
        }

        const currentConfig = configManager.loadConfig();
        let importedCount = 0;
        let mergedCount = 0;

        for (const item of selected) {
          const existingFleet = currentConfig.fleets.find((f) => f.name === item.fleet.name);

          if (existingFleet) {
            const action = await vscode.window.showQuickPick(
              [
                { label: 'Merge', description: 'Add new vessels to existing fleet' },
                { label: 'Replace', description: 'Replace all vessels in fleet' },
                { label: 'Skip', description: 'Skip this fleet' },
                { label: 'Rename', description: 'Import as a new fleet with different name' },
              ],
              { placeHolder: `Fleet "${item.fleet.name}" already exists` }
            );

            if (!action || action.label === 'Skip') {
              continue;
            }

            if (action.label === 'Replace') {
              existingFleet.vessels = item.fleet.vessels;
              existingFleet.icon = item.fleet.icon;
              existingFleet.color = item.fleet.color;
              existingFleet.defaults = item.fleet.defaults;
              importedCount += item.fleet.vessels.length;
            } else if (action.label === 'Merge') {
              const existingHosts = new Set(existingFleet.vessels.map((v) => v.host));
              const newVessels = item.fleet.vessels.filter((v) => !existingHosts.has(v.host));
              existingFleet.vessels.push(...newVessels);
              mergedCount += newVessels.length;
            } else if (action.label === 'Rename') {
              const newName = await vscode.window.showInputBox({
                prompt: 'Enter new fleet name',
                value: `${item.fleet.name} (imported)`,
                validateInput: (value) => {
                  if (!value || value.trim() === '') {
                    return 'Fleet name is required';
                  }
                  if (currentConfig.fleets.some((f) => f.name === value)) {
                    return 'Fleet name already exists';
                  }
                  return undefined;
                },
              });

              if (newName) {
                const renamedFleet: Fleet = { ...item.fleet, name: newName };
                currentConfig.fleets.push(renamedFleet);
                importedCount += renamedFleet.vessels.length;
              }
            }
          } else {
            currentConfig.fleets.push(item.fleet);
            importedCount += item.fleet.vessels.length;
          }
        }

        // Import defaults if present and current config has none
        if (importedConfig.defaults && !currentConfig.defaults) {
          currentConfig.defaults = importedConfig.defaults;
        }

        configManager.saveConfig(currentConfig);
        provider.refresh();

        const messages: string[] = [];
        if (importedCount > 0) {
          messages.push(`${importedCount} vessel(s) imported`);
        }
        if (mergedCount > 0) {
          messages.push(`${mergedCount} vessel(s) merged`);
        }

        if (messages.length > 0) {
          vscode.window.showInformationMessage(`Import complete: ${messages.join(', ')}`);
        } else {
          vscode.window.showInformationMessage('No changes made');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to import: ${message}`);
      }
    }
  );

  context.subscriptions.push(exportCommand, importCommand);
}
