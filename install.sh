#!/usr/bin/env bash
set -euo pipefail

REPO_URL="git@github.com:UnsafestBox/trallwn-pos.git"
INSTALL_DIR="${1:-/opt/trallwn-pos}"
SERVICE_USER="$(whoami)"

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; RESET='\033[0m'
info()    { echo -e "${GREEN}▸${RESET} $*"; }
warn()    { echo -e "${YELLOW}⚠${RESET}  $*"; }
error()   { echo -e "${RED}✗${RESET}  $*" >&2; exit 1; }
section() { echo -e "\n${BOLD}$*${RESET}"; }

# ── Root check ────────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  error "Run this script with sudo:  sudo bash install.sh"
fi

SERVICE_USER="${SUDO_USER:-$USER}"

section "=== Trallwn Club POS — Ubuntu Installer ==="
echo    "  Install directory : $INSTALL_DIR"
echo    "  Running as user   : $SERVICE_USER"
echo

# ── 1. Node.js 22 ─────────────────────────────────────────────────────────────
section "1. Checking Node.js"

NODE_OK=false
if command -v node &>/dev/null; then
  NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
  if [[ $NODE_VER -ge 22 ]]; then
    info "Node.js $(node --version) already installed"
    NODE_OK=true
  else
    warn "Node.js $(node --version) is too old — installing v22"
  fi
fi

if [[ $NODE_OK == false ]]; then
  info "Installing Node.js 22 via NodeSource..."
  apt-get update -qq
  apt-get install -y -qq curl ca-certificates
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
  info "Node.js $(node --version) installed"
fi

# ── 2. Git ────────────────────────────────────────────────────────────────────
section "2. Checking Git"
if ! command -v git &>/dev/null; then
  info "Installing git..."
  apt-get install -y -qq git
fi
info "git $(git --version | awk '{print $3}')"

# ── 3. Clone or update ────────────────────────────────────────────────────────
section "3. Application files"
if [[ -d "$INSTALL_DIR/.git" ]]; then
  info "Repo already present — pulling latest..."
  sudo -u "$SERVICE_USER" git -C "$INSTALL_DIR" pull
else
  info "Cloning into $INSTALL_DIR..."
  sudo -u "$SERVICE_USER" git clone "$REPO_URL" "$INSTALL_DIR"
fi

# ── 4. Dependencies ───────────────────────────────────────────────────────────
section "4. Installing dependencies"
info "Server..."
sudo -u "$SERVICE_USER" npm --prefix "$INSTALL_DIR/server" install --omit=dev
info "Client..."
sudo -u "$SERVICE_USER" npm --prefix "$INSTALL_DIR/client" install

# ── 5. Build client ───────────────────────────────────────────────────────────
section "5. Building client"
sudo -u "$SERVICE_USER" npm --prefix "$INSTALL_DIR/client" run build
info "Client built to $INSTALL_DIR/client/dist"

# ── 6. config.json ───────────────────────────────────────────────────────────
section "6. Config"
if [[ ! -f "$INSTALL_DIR/config.json" ]]; then
  warn "No config.json found — copying default"
  cp "$INSTALL_DIR/config.json.example" "$INSTALL_DIR/config.json" 2>/dev/null || \
  cat > "$INSTALL_DIR/config.json" <<'JSON'
{
  "theme": "dark",
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
JSON
  info "Default config.json created — edit $INSTALL_DIR/config.json to customise"
else
  info "Existing config.json kept"
fi
chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/config.json"

# ── 7. Systemd service ────────────────────────────────────────────────────────
section "7. Setting up systemd service"

cat > /etc/systemd/system/trallwn-pos.service <<EOF
[Unit]
Description=Trallwn Club POS Server
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR/server
ExecStart=$(which node) index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable trallwn-pos
systemctl restart trallwn-pos
info "Service enabled and started (trallwn-pos)"

# ── 8. Static file serving ────────────────────────────────────────────────────
section "8. Serving the frontend"

# Check if the server can serve static files from client/dist
# If nginx is available, configure it; otherwise advise using serve/npx
if command -v nginx &>/dev/null; then
  info "nginx detected — writing site config"
  cat > /etc/nginx/sites-available/trallwn-pos <<NGINX
server {
    listen 80;
    server_name _;

    root $INSTALL_DIR/client/dist;
    index index.html;

    # Frontend — serve built files, fall back to index.html for SPA routing
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Proxy API requests to the Node server
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
NGINX

  ln -sf /etc/nginx/sites-available/trallwn-pos /etc/nginx/sites-enabled/trallwn-pos
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
  info "nginx configured — POS available on http://localhost"
else
  warn "nginx not found — installing it for static file serving..."
  apt-get install -y -qq nginx

  cat > /etc/nginx/sites-available/trallwn-pos <<NGINX
server {
    listen 80;
    server_name _;

    root $INSTALL_DIR/client/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
NGINX

  ln -sf /etc/nginx/sites-available/trallwn-pos /etc/nginx/sites-enabled/trallwn-pos
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl enable --now nginx
  info "nginx installed and configured"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
section "=== Installation complete ==="
echo
echo -e "  ${GREEN}POS URL${RESET}       : http://$(hostname -I | awk '{print $1}')"
echo -e "  ${GREEN}API server${RESET}    : http://localhost:3001"
echo
echo    "  Default login   : Admin / 0000  (change this immediately)"
echo    "  Config file     : $INSTALL_DIR/config.json"
echo    "  Database        : $INSTALL_DIR/server/pos.db"
echo
echo    "  Useful commands:"
echo    "    sudo systemctl status trallwn-pos   # check server status"
echo    "    sudo systemctl restart trallwn-pos  # restart after config changes"
echo    "    sudo journalctl -u trallwn-pos -f   # live server logs"
echo
