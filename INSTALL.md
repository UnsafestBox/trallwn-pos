# Trallwn Club POS — Installation

## Requirements

- **Node.js 22 or later** — the server uses the built-in `node:sqlite` module, which requires Node 22+
- npm (bundled with Node)

Check your version:
```bash
node --version   # must be v22.x.x or higher
```

---

## Installing prerequisites

### Windows

**Option A — winget (Windows 10/11)**
```powershell
winget install OpenJS.NodeJS.LTS
```
Restart your terminal after install, then verify:
```powershell
node --version
```

**Option B — installer**
1. Download the LTS installer from [nodejs.org](https://nodejs.org)
2. Run the `.msi` and follow the wizard (accept the default options)
3. Open a new PowerShell or Command Prompt and verify: `node --version`

**Option C — nvm-windows** (recommended if you manage multiple Node versions)
1. Download and run the installer from [github.com/coreybutler/nvm-windows](https://github.com/coreybutler/nvm-windows/releases)
2. Then:
```powershell
nvm install 22
nvm use 22
```

---

### Linux

**Option A — NodeSource repository** (Debian/Ubuntu)
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Option A — NodeSource repository** (RHEL/Fedora/CentOS)
```bash
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs
```

**Option B — nvm** (works on any distro, no sudo required)
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# Restart your shell, then:
nvm install 22
nvm use 22
```

**Option C — system package manager**

Arch / CachyOS:
```bash
sudo pacman -S nodejs npm
```
> Note: verify the packaged version is 22+. If your distro ships an older version, use nvm instead.

---

## 1. Clone the repository

```bash
git clone <repo-url>
cd "Trallwn Club POS"
```

---

## 2. Install dependencies

Run from the project root to install both server and client in one step:

```bash
npm run install:all
```

Or install them separately:

```bash
cd server && npm install
cd ../client && npm install
```

---

## 3. Start the application

Two terminals are needed — one for the API server, one for the frontend.

**Terminal 1 — API server (port 3001)**
```bash
cd server
npm start
```

**Terminal 2 — Frontend (port 5173)**
```bash
cd client
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## 4. First login

The database is created automatically on first run at `server/pos.db`. A default admin account is seeded:

| Field | Value |
|-------|-------|
| Name  | Admin |
| PIN   | 0000  |

**Change the PIN immediately** via the Users page after first login.

---

## 5. First-time setup

1. Log in as **Admin**
2. Go to **Stock** → add your products with prices and stock quantities
3. Set minimum stock levels for low-stock alerts
4. Switch to **POS** to open tabs and record orders
5. Settle tabs via **POS** or the **Tabs** view
6. Check **Reports** for daily takings and stock summaries

---

## Roles

| Role    | Permissions |
|---------|-------------|
| `normal` | POS, Tabs, Reports |
| `super`  | Everything above + Stock management, User management, Event log |

Manage users (add, change PIN, set role) from the **Users** page (super users only).

---

## Configuration

### Feature flags and auth settings

Edit `config.json` at the project root. Changes take effect after restarting the server.

```json
{
  "auth": {
    "requirePin": true,
    "inactivityTimeoutMinutes": 3,
    "inactivityWarningSecs": 30
  },
  "features": {
    "bills": true,
    "reports": true,
    "stockManagement": true,
    "eventLog": true,
    "memberPricing": true,
    "offBook": true
  }
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `theme` | `"dark"` | UI theme: `"dark"` (amber, dark), `"light"` (bright environments), `"slate"` (indigo, cool dark), `"dyslexic"` (cream bg, Atkinson Hyperlegible font, wider spacing) |
| `auth.requirePin` | `true` | Set to `false` to let users log in by name only — no PIN pad shown |
| `auth.inactivityTimeoutMinutes` | `3` | Minutes of inactivity before auto sign-out. Set to `0` to disable |
| `auth.inactivityWarningSecs` | `30` | Seconds of warning shown before auto sign-out triggers |
| `features.bills` | `true` | Bills page |
| `features.reports` | `true` | Reports page |
| `features.stockManagement` | `true` | Stock management page (super users only) |
| `features.eventLog` | `true` | Event log page (super users only) |
| `features.memberPricing` | `true` | Member price field and toggle in POS |
| `features.offBook` | `true` | Off-the-book / Open Cash option on products |

### Database path

By default the database is stored at `server/pos.db`. Override with an environment variable:

```bash
DB_PATH=/var/data/pos.db npm start
```

### Development mode (auto-restart on changes)

```bash
cd server && npm run dev   # uses nodemon
```

---

## Running tests

```bash
cd server && npm test
```
