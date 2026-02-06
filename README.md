<p align="center">
  <img src="https://raw.githubusercontent.com/MarkFieldsBR/ssharbor/main/resources/ssharbor-hero.png" alt="SSHarbor Banner" width="600">
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/MarkFieldsBR/ssharbor/main/resources/icon.png" alt="SSHarbor Logo" width="70" style="margin-right:-10px"><img src="https://readme-typing-svg.herokuapp.com?font=Montserrat&weight=700&size=54&pause=1000&color=0077B6&center=true&vCenter=true&width=320&height=70&lines=SSHarbor" alt="SSHarbor">
</p>

<h3 align="center">⚓ Your safe harbor for SSH connections</h3>

<p align="center">
  <strong><em>"Managing 30 servers? There's a better way than <code>history | grep ssh</code>"</em></strong>
</p>

<p align="center">
  <em>Stop drowning in terminal windows. Organize your servers. Navigate with confidence.</em>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=marcostullyo.ssharbor">
    <img src="https://img.shields.io/visual-studio-marketplace/v/marcostullyo.ssharbor?style=for-the-badge&logo=visual-studio-code&logoColor=white&label=VS%20Code&color=007ACC" alt="VS Code Marketplace">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=marcostullyo.ssharbor">
    <img src="https://img.shields.io/visual-studio-marketplace/d/marcostullyo.ssharbor?style=for-the-badge&color=brightgreen&label=Downloads" alt="Downloads">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=marcostullyo.ssharbor&ssr=false#review-details">
    <img src="https://img.shields.io/visual-studio-marketplace/r/marcostullyo.ssharbor?style=for-the-badge&color=yellow&label=Rating" alt="Rating">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License">
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Made%20with-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square">
  <img src="https://img.shields.io/badge/Telemetry-None-success?style=flat-square">
</p>

<br>

<p align="center">
  <img src="https://raw.githubusercontent.com/MarkFieldsBR/ssharbor/main/resources/demo.gif" alt="SSHarbor Demo" width="700">
</p>

---

## 🌊 Lost at Sea?

You're a developer. You have **dozens of servers**. Production, staging, dev boxes, client machines, personal projects...

Every time you need to connect:
- 🔍 *"What was that IP again?"*
- 🤔 *"Which SSH key does this server use?"*
- 😤 *"Let me scroll through my bash history..."*
- 🤯 *"Was it port 22 or 2222?"*

**Sound familiar?**

---

## ⚓ Find Your Harbor

<p align="center">
  <img src="https://raw.githubusercontent.com/MarkFieldsBR/ssharbor/main/resources/screenshot-main.png" alt="SSHarbor Main Interface" width="800">
</p>

**SSHarbor** transforms chaos into clarity:

| Before SSHarbor | After SSHarbor |
|-----------------|----------------|
| `ssh -i ~/.ssh/prod.pem -p 2222 deploy@10.0.0.1` | **One click** |
| Memorizing 30+ server configs | **Visual organization** |
| Hunting through SSH config files | **Instant search** |
| Opening terminals everywhere | **VS Code Remote SSH integration** |

---

## 🧭 Who Sails with SSHarbor?

| 👨‍💻 **DevOps Engineers** | 🚀 **Startup Founders** | 🏢 **Enterprise Teams** |
|---------------------------|-------------------------|-------------------------|
| 50+ servers across AWS, GCP, Azure | Juggling prod, staging, and dev | Onboard new devs in minutes |

| 🎓 **Students & Learners** | 🔧 **Freelancers** | 🏠 **Homelab Enthusiasts** |
|----------------------------|--------------------|-----------------------------|
| Learning cloud computing | Different clients, different servers | Raspberry Pi fleet |

---

## ✨ Features That Ship

### 🚢 Organize with Fleets

Group servers into logical **Fleets** — Production, Staging, Personal, Client-A, whatever makes sense for *your* workflow.

```
📦 Production
   └── 🚢 Web Server
   └── 🚢 Database
   └── 🚢 Redis Cache

📦 Development
   └── 🚢 Dev Box
   └── 🚢 Test Server

📦 Personal
   └── 🚢 Home Lab
   └── 🚢 Raspberry Pi
```

### ⚡ Quick Connect — `Cmd+Shift+S`

<kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>S</kbd> — and you're in.

Search across all your vessels, or type a quick connection string. No more terminal archaeology.

### 🚀 Board the Vessel — VS Code Remote SSH

Click **Board the Vessel** and SSHarbor opens a **new VS Code window** connected to your server via Remote SSH. Full IDE experience. No terminal juggling.

### 📂 Quick Access Folders

SSHarbor remembers the folders you work in. Next time you connect, pick your project folder instantly — no navigation required.

### ⭐ Favorites

Star your most-used servers. They float to the top, always within reach.

### 🔑 Smart SSH Key Management

Configure SSH keys per-fleet or per-vessel. SSHarbor handles the complexity:

```json
{
  "defaults": { "identityFile": "~/.ssh/id_rsa" },
  "fleets": [{
    "name": "AWS Production",
    "defaults": { "identityFile": "~/.ssh/aws-prod.pem" }
  }]
}
```

### 🎯 Rich Detail Panel

Select any vessel to see:
- Connection details at a glance
- SSH command preview
- Quick action buttons
- Saved folders for instant access

### 📋 Copy & Go

Right-click → **Copy SSH Command** → Paste anywhere. Perfect for sharing with teammates or documentation.

---

## 🤔 "But I Already Use..."

| Alternative | The Reality | SSHarbor Advantage |
|-------------|-------------|-------------------|
| **SSH Config** | Great for 5 servers. Chaos at 50. | Visual organization + search |
| **Shell Aliases** | `alias prod="ssh -i ~/.ssh..."` scattered everywhere | Centralized, portable config |
| **Notes App** | Copy-paste archaeology | One-click connection |
| **Memory** | "Was it `.pem` or `.pub`?" | Never forget again |
| **Terminal Tabs** | 20 tabs, which one is prod? | Named, organized, searchable |

---

## 🚀 Quick Start

### 1. Install

Open VS Code → Extensions → Search **"SSHarbor"** → Install

Or via command line:
```bash
code --install-extension marcostullyo.ssharbor
```

### 2. Create Your First Fleet

Click the **+** button in the SSHarbor panel, or run:

<kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>P</kbd> → `SSHarbor: Create Fleet`

### 3. Add Your Vessels

Right-click your fleet → **Commission New Vessel**

Enter host, user, port — done.

### 4. Connect!

Click on any vessel → **Board the Vessel** 🚀

---

## ⚙️ Configuration

SSHarbor stores configuration in VS Code's global storage. Edit via the ⚙️ icon or:

<kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>P</kbd> → `SSHarbor: Edit Configuration`

### Example Configuration

```json
{
  "$schema": "./schema.json",
  "defaults": {
    "user": "root",
    "port": 22,
    "identityFile": "~/.ssh/id_rsa"
  },
  "fleets": [
    {
      "name": "Production",
      "icon": "cloud",
      "defaults": {
        "user": "deploy",
        "identityFile": "~/.ssh/prod.pem"
      },
      "vessels": [
        {
          "name": "Web Server",
          "host": "web.example.com",
          "tags": ["nginx", "frontend"],
          "favorite": true
        },
        {
          "name": "Database",
          "host": "db.example.com",
          "port": 5432,
          "tags": ["postgres"]
        }
      ]
    },
    {
      "name": "Development",
      "icon": "beaker",
      "vessels": [
        {
          "name": "Dev Box",
          "host": "192.168.1.100",
          "user": "developer",
          "notes": "Local development machine"
        }
      ]
    }
  ]
}
```

### Configuration Reference

<details>
<summary><strong>Global Defaults</strong></summary>

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `user` | string | `root` | Default SSH username |
| `port` | number | `22` | Default SSH port |
| `shell` | string | `/bin/zsh` | Shell after connection |
| `identityFile` | string | — | Default SSH key path |

</details>

<details>
<summary><strong>Fleet Options</strong></summary>

| Option | Type | Description |
|--------|------|-------------|
| `name` | string | Fleet display name |
| `icon` | string | VS Code ThemeIcon name |
| `collapsed` | boolean | Start collapsed in tree |
| `defaults` | object | Override global defaults |
| `vessels` | array | List of vessels |

</details>

<details>
<summary><strong>Vessel Options</strong></summary>

| Option | Type | Description |
|--------|------|-------------|
| `name` | string | Display name |
| `host` | string | **Required.** Hostname or IP |
| `user` | string | SSH username |
| `port` | number | SSH port |
| `identityFile` | string | SSH key path |
| `tags` | array | Tags for organization |
| `favorite` | boolean | Pin to top |
| `notes` | string | Personal notes |

</details>

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>S</kbd> | Quick Connect |

---

## 🎯 Commands

| Command | Description |
|---------|-------------|
| `SSHarbor: Quick Connect` | Fast connection dialog |
| `SSHarbor: Create Fleet` | Create a new fleet |
| `SSHarbor: Commission New Vessel` | Add server to fleet |
| `SSHarbor: Board the Vessel` | Connect via Remote SSH |
| `SSHarbor: Open SSH Terminal` | Classic terminal connection |
| `SSHarbor: Copy SSH Command` | Copy connection command |
| `SSHarbor: Edit Configuration` | Open config file |
| `SSHarbor: Reconnect to Last` | Quick reconnect |

---

## 🗺️ Roadmap

- [x] Fleet organization
- [x] Quick Connect (`Cmd+Shift+S`)
- [x] VS Code Remote SSH integration
- [x] Favorites & tags
- [x] Quick access folders
- [ ] 🔜 Import from `~/.ssh/config`
- [ ] 🔜 Team sharing (JSON export/import)
- [ ] 🔜 Connection health monitoring
- [ ] 💭 Multi-hop (Jump Host) support
- [ ] 💭 SFTP browser integration

---

## 💬 What Developers Are Saying

> *"Finally, a sane way to manage my AWS fleet"* — DevOps Engineer

> *"Onboarding new team members went from hours to minutes"* — Tech Lead

> *"My terminal history thanks you"* — Full Stack Developer

> *"The nautical theme is surprisingly intuitive"* — Homelab Enthusiast

---

## 💡 Pro Tips

1. **Use fleet defaults** — Set user/key once per fleet, not per vessel
2. **Tag everything** — Makes searching lightning fast
3. **Star your top 5** — Favorites always float to the top
4. **Save folders** — SSHarbor remembers where you work

---

## 🆘 Quick Troubleshooting

<details>
<summary>🔴 <strong>Connection refused / Remote SSH not working</strong></summary>

Ensure the Remote-SSH extension is installed:
```bash
code --install-extension ms-vscode-remote.remote-ssh
```

</details>

<details>
<summary>🔴 <strong>SSH key not found</strong></summary>

Use absolute paths instead of `~`:
```
❌ ~/.ssh/key.pem
✅ /Users/yourname/.ssh/key.pem
```

</details>

<details>
<summary>🔴 <strong>Permission denied (publickey)</strong></summary>

1. Check the key file permissions: `chmod 600 ~/.ssh/your-key.pem`
2. Verify the correct username for your server
3. Ensure the key is added to the server's `authorized_keys`

</details>

<details>
<summary>🔴 <strong>Config file not loading</strong></summary>

Run `SSHarbor: Edit Configuration` from the command palette to ensure the file exists and is valid JSON.

</details>

---

## 🤝 Contributing

Found a bug? Have a feature idea?

1. [Open an issue](https://github.com/markfields/ssharbor/issues)
2. Fork & submit a PR
3. Star the repo ⭐

---

## 📄 License

MIT — Use it, modify it, ship it.

---

<h2 align="center">🚀 Ready to dock your connections?</h2>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=marcostullyo.ssharbor">
    <img src="https://img.shields.io/badge/⬇️%20Install%20SSHarbor-VS%20Code%20Marketplace-007ACC?style=for-the-badge&logo=visual-studio-code&logoColor=white" alt="Install SSHarbor">
  </a>
</p>

<p align="center">
  <strong>⚓ Made with love for developers who live in the terminal</strong>
</p>

<p align="center">
  <sub>🌟 If SSHarbor saved you time, consider <a href="https://github.com/markfields/ssharbor">starring the repo</a>!</sub>
</p>

<p align="center">
  <sub>Built by <a href="https://github.com/markfields">Marcos Tullyo</a> @ Markfields Solutions</sub>
</p>

<p align="center">
  <a href="https://ko-fi.com/marcostullyo">☕ Support me on Ko-fi</a>
</p>
