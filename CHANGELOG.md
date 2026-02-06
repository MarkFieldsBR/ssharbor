# Changelog

All notable changes to SSHarbor will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2026-02-05

### ✨ New Features

#### Drag & Drop Support
- **Reorder Vessels** — Drag vessels to reorder within a fleet
- **Move Between Fleets** — Drag vessels from one fleet to another
- **Reorder Fleets** — Drag fleets to change their order in the tree

#### Import from SSH Config
- **Import Command** — New "Import from SSH Config" in welcome screen and command palette
- **Host Selection** — Pick which hosts to import from `~/.ssh/config`
- **Fleet Options** — Create new fleet or merge into existing
- **Smart Parsing** — Handles Host, HostName, User, Port, and IdentityFile directives

### 🎨 Improvements

- **Improved Welcome Screen** — Cleaner layout with better icons and organization
- **Auto-clear Recent** — Recent connections cleared when all fleets/vessels are deleted

### 🐛 Bug Fixes

- **Publisher Migration** — Automatic data migration when publisher ID changes (prevents data loss)

---

## [1.0.1] - 2026-02-05

### 🐛 Bug Fixes

- **Image URLs** — Fixed absolute URLs for images in README
- **Connect Behavior** — Simplified connect to always open home directory

### 🔒 Security

- **Config Corruption Protection** — Prevent data loss on corrupted config file

---

## [1.0.0] - 2026-02-05

### 🚀 Initial Release

SSHarbor is a VS Code extension that transforms SSH connection management from chaotic terminal archaeology into an organized, visual experience. This release marks the first stable version with a complete feature set for managing SSH connections.

---

### ✨ Features

#### Fleet Organization
- **Create Fleets** — Group your servers into logical collections (Production, Development, Staging, Personal, etc.)
- **Fleet Icons** — Customize fleet icons using any VS Code ThemeIcon
- **Fleet Defaults** — Set default user, port, shell, and identity file per fleet
- **Collapsible Fleets** — Configure fleets to start collapsed for cleaner navigation
- **Decommission Fleets** — Remove entire fleets with confirmation dialog

#### Vessel Management
- **Commission Vessels** — Add new servers via intuitive webview form with validation
- **Edit Vessels** — Modify vessel configuration through dedicated panel
- **Scuttle Vessels** — Remove vessels with confirmation
- **Vessel Favorites** — Star frequently-used vessels to pin them at the top
- **Vessel Tags** — Add tags for filtering and categorization (nginx, database, redis, etc.)
- **Vessel Notes** — Add personal documentation notes to any vessel

#### Connection Methods
- **Board the Vessel** — Open VS Code Remote SSH window for full IDE experience on remote server
- **Open SSH Terminal** — Classic terminal-based SSH connection in integrated terminal
- **Quick Connect** (`Cmd+Shift+S` / `Ctrl+Shift+S`) — Fast connection dialog with autocomplete and search
- **Reconnect to Last** — One-click reconnection to the most recent session

#### Quick Access Folders
- **Save Current Folder** — Remember working directories on remote servers
- **Folder Picker** — Select from saved folders when connecting
- **Per-Vessel Paths** — Each vessel maintains its own list of quick access folders

#### Vessel Detail Panel
- **Rich Information Display** — Shows host, user, port, identity file, shell, tags, and notes
- **SSH Command Preview** — View the exact SSH command that will be executed
- **Quick Action Buttons** — Connect, copy command, toggle favorite without context menus
- **Saved Folders List** — View and manage quick access folders directly in panel

#### Copy & Share
- **Copy SSH Command** — Copy full SSH command to clipboard for sharing or documentation
- **Copy Host** — Copy just the host address for quick use

#### Recent Connections
- **Automatic Tracking** — Automatically tracks last 5 SSH sessions
- **Recent Connections Fleet** — Virtual fleet showing recent connections (configurable)
- **Quick Re-access** — Click any recent connection to reconnect instantly

#### Status Bar Integration
- **Last Connection Display** — Shows the name of the last connected vessel
- **Click to Reconnect** — Single click on status bar item to reconnect
- **Visual Indicator** — Always know which server you connected to last

#### Configuration System
- **JSON Configuration** — Human-readable JSON config file with full control
- **JSON Schema Validation** — Full autocomplete and validation in VS Code editor
- **Cascading Defaults** — Three-level inheritance: Global → Fleet → Vessel
- **VS Code Settings Integration** — Configure default shell, user, port via VS Code settings
- **Edit Configuration Command** — Quick access to config file from command palette

#### Tree View Features
- **Hierarchical Display** — Fleets contain vessels in expandable tree structure
- **Rich Tooltips** — Markdown-formatted tooltips with connection details
- **Context Menus** — Full right-click menus for fleets and vessels
- **Inline Actions** — Quick action buttons directly in tree items
- **Welcome View** — Helpful onboarding when no fleets exist yet

---

### ⌨️ Keyboard Shortcuts

| Shortcut | Command |
|----------|---------|
| `Cmd+Shift+S` (Mac) | Quick Connect |
| `Ctrl+Shift+S` (Win/Linux) | Quick Connect |

---

### 🎯 Commands

| Command | Description |
|---------|-------------|
| `SSHarbor: Quick Connect` | Fast connection dialog with search |
| `SSHarbor: Create Fleet` | Create a new fleet via webview form |
| `SSHarbor: Commission New Vessel` | Add server to selected fleet |
| `SSHarbor: Board the Vessel` | Connect via VS Code Remote SSH |
| `SSHarbor: Open SSH Terminal` | Classic terminal SSH connection |
| `SSHarbor: Copy SSH Command` | Copy full SSH command to clipboard |
| `SSHarbor: Copy Host` | Copy host address to clipboard |
| `SSHarbor: Toggle Favorite` | Star/unstar a vessel |
| `SSHarbor: Edit Vessel` | Modify vessel configuration |
| `SSHarbor: Scuttle the Vessel` | Remove vessel with confirmation |
| `SSHarbor: Decommission Fleet` | Remove entire fleet |
| `SSHarbor: Save Current Folder` | Save remote folder for quick access |
| `SSHarbor: Reconnect to Last` | Reconnect to most recent session |
| `SSHarbor: Refresh Harbor` | Reload configuration and tree view |
| `SSHarbor: Edit Configuration` | Open config file in editor |

---

### ⚙️ VS Code Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `ssharbor.defaultShell` | string | `/bin/zsh` | Default shell after SSH connection |
| `ssharbor.defaultUser` | string | `root` | Default SSH username |
| `ssharbor.defaultPort` | number | `22` | Default SSH port |
| `ssharbor.showRecentConnections` | boolean | `true` | Show recent connections fleet |
| `ssharbor.maxRecentConnections` | number | `5` | Maximum recent connections to track |

---

### 🔒 Security

This release includes comprehensive security hardening:

#### Input Validation
- **Host Validation** — Strict hostname and IP address validation
- **Username Validation** — POSIX-compliant username validation
- **Port Validation** — Integer range validation (1-65535)
- **Identity File Validation** — Path traversal attack prevention
- **Fleet/Vessel Name Validation** — Length limits and character restrictions
- **Tag Validation** — Alphanumeric with controlled special characters

#### Path Traversal Protection
- Identity file paths are validated against `~/.ssh/` directory
- Resolved paths are checked to prevent `../` escape attempts
- Only paths within user's home directory are allowed

#### XSS Prevention
- All webviews use Content Security Policy (CSP) with nonces
- Dynamic content is escaped using `textContent` instead of `innerHTML`
- Script execution restricted to nonce-authenticated inline scripts

#### File Security
- Configuration files created with `chmod 0o600` (owner read/write only)
- Recent connections file secured with same permissions
- Vessel paths file protected from unauthorized access

#### Command Injection Prevention
- All user inputs are sanitized before shell execution
- Dangerous characters stripped: `; | & $ \` \n \r`
- SSH commands built with validated, sanitized components

---

### 🏗️ Technical Architecture

#### Modular Structure
```
src/
├── core/           # Business logic
│   ├── config.ts   # Configuration management with EventEmitter
│   ├── ssh.ts      # SSH command building and utilities
│   └── security.ts # Input validation and sanitization
├── commands/       # VS Code command handlers
│   ├── connect.ts  # Connection commands
│   ├── copy.ts     # Clipboard commands
│   ├── fleet.ts    # Fleet management
│   └── quick-connect.ts
├── providers/      # VS Code providers
│   └── harbor-tree.ts # TreeDataProvider implementation
├── views/          # Webview panels
│   ├── vessel-detail-panel.ts
│   ├── add-vessel-webview.ts
│   └── create-fleet-webview.ts
├── types/          # TypeScript interfaces
│   └── index.ts    # Centralized type definitions
└── extension.ts    # Extension entry point
```

#### Design Patterns
- **Observer Pattern** — EventEmitter for configuration change notifications
- **Manager Pattern** — ConfigManager as singleton for state management
- **Command Pattern** — Modular command registration and handling
- **Provider Pattern** — TreeDataProvider for tree view rendering

#### Type Safety
- TypeScript strict mode enabled
- Custom type guards for runtime type checking
- Comprehensive interfaces for all data structures
- No implicit `any` types

#### Testing
- **Vitest** test framework configured
- **49 unit tests** covering core functionality
- Security module: 34 tests for validation functions
- SSH module: 15 tests for command building

#### Continuous Integration
- GitHub Actions workflow for CI/CD
- Multi-version Node.js testing (18.x, 20.x)
- Automated typecheck, lint, and test on PR/push
- VSIX artifact generation on main branch

---

### 📦 Dependencies

#### Runtime
- VS Code API ^1.85.0

#### Development
- TypeScript ^5.3.0
- Vitest ^4.0.18
- ESLint ^8.54.0
- @types/vscode ^1.85.0
- @types/node ^20.10.0

---

### 📋 Configuration Schema

Full JSON Schema available for configuration validation with:
- Property descriptions and examples
- Enum values for icons
- Required field validation
- Default value documentation

---

### 🌊 Nautical Theme

SSHarbor uses a consistent nautical metaphor throughout:
- **Harbor** — Your collection of connections
- **Fleet** — A group of related servers
- **Vessel** — An individual server
- **Board the Vessel** — Connect to a server
- **Commission** — Add a new vessel
- **Scuttle** — Remove a vessel
- **Decommission** — Remove a fleet

---

### 🙏 Acknowledgments

Built with love for developers who spend their lives in the terminal.

---

### 📄 License

MIT License — Use it, modify it, ship it.

---

**Full documentation:** [GitHub Repository](https://github.com/markfields/ssharbor)

**Report issues:** [Issue Tracker](https://github.com/markfields/ssharbor/issues)
