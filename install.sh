#!/usr/bin/env bash
set -euo pipefail

REPO_URL="git@github.com:UnsafestBox/trallwn-pos.git"
INSTALL_DIR="${1:-/opt/trallwn-pos}"

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

# ── Helpers ───────────────────────────────────────────────────────────────────
generate_port() {
  while true; do
    local p=$(( ( RANDOM * RANDOM % 20001 ) + 40000 ))
    if ! ss -tlnp 2>/dev/null | grep -q ":$p "; then
      echo "$p"; return
    fi
  done
}

generate_prefix() {
  # /xk9m2p4  style — 8 random lowercase alphanumeric chars
  printf '/%s' "$(cat /dev/urandom | tr -dc 'a-z0-9' | head -c 8)"
}

# Read a top-level string/number from config.json, returns empty string if missing/null
json_get() {
  local file="$1" key="$2"
  python3 - "$file" "$key" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
    v = d.get(sys.argv[2])
    print(v if v is not None else '', end='')
except Exception:
    print('', end='')
PY
}

# Write port and apiPrefix into config.json
json_set_network() {
  local file="$1" port="$2" prefix="$3"
  python3 - "$file" "$port" "$prefix" <<'PY'
import json, sys
with open(sys.argv[1]) as f:
    d = json.load(f)
d['port'] = int(sys.argv[2])
d['apiPrefix'] = sys.argv[3]
with open(sys.argv[1], 'w') as f:
    json.dump(d, f, indent=2)
    f.write('\n')
PY
}

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

# ── 4. config.json ────────────────────────────────────────────────────────────
section "4. Config"
if [[ ! -f "$INSTALL_DIR/config.json" ]]; then
  warn "No config.json found — creating default"
  cat > "$INSTALL_DIR/config.json" <<'JSON'
{
  "theme": "dark",
  "port": null,
  "apiPrefix": null,
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
fi
chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/config.json"

# Read existing port/prefix, or generate new ones
API_PORT="$(json_get "$INSTALL_DIR/config.json" port)"
API_PREFIX="$(json_get "$INSTALL_DIR/config.json" apiPrefix)"

if [[ -z "$API_PORT" ]]; then
  API_PORT="$(generate_port)"
  info "Generated port: $API_PORT"
else
  info "Using existing port: $API_PORT"
fi

if [[ -z "$API_PREFIX" ]]; then
  API_PREFIX="$(generate_prefix)"
  info "Generated API prefix: $API_PREFIX"
else
  info "Using existing API prefix: $API_PREFIX"
fi

json_set_network "$INSTALL_DIR/config.json" "$API_PORT" "$API_PREFIX"
info "config.json updated"

# ── 5. Dependencies ───────────────────────────────────────────────────────────
section "5. Installing dependencies"
info "Server..."
sudo -u "$SERVICE_USER" npm --prefix "$INSTALL_DIR/server" install --omit=dev
info "Client..."
sudo -u "$SERVICE_USER" npm --prefix "$INSTALL_DIR/client" install

# ── 6. Build client ───────────────────────────────────────────────────────────
section "6. Building client"

# Write env file so Vite bakes the prefix and port into the bundle
cat > "$INSTALL_DIR/client/.env" <<ENV
VITE_API_BASE=$API_PREFIX
VITE_SERVER_PORT=$API_PORT
ENV
chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/client/.env"
info "client/.env written (VITE_API_BASE=$API_PREFIX)"

sudo -u "$SERVICE_USER" npm --prefix "$INSTALL_DIR/client" run build
info "Client built to $INSTALL_DIR/client/dist"

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

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable trallwn-pos
systemctl restart trallwn-pos
info "Service enabled and started (trallwn-pos)"

# ── 8. nginx ──────────────────────────────────────────────────────────────────
section "8. Configuring nginx"

if ! command -v nginx &>/dev/null; then
  info "Installing nginx..."
  apt-get install -y -qq nginx
fi

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

    # API — rewrite obscure prefix back to /api/ before proxying to Node
    location $API_PREFIX/ {
        rewrite ^$API_PREFIX/(.*) /api/\$1 break;
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/trallwn-pos /etc/nginx/sites-enabled/trallwn-pos
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable --now nginx && systemctl reload nginx
info "nginx configured"

# ── Done ──────────────────────────────────────────────────────────────────────
section "=== Installation complete ==="
echo
echo -e "  ${GREEN}POS URL${RESET}       : http://$(hostname -I | awk '{print $1}')"
echo -e "  ${GREEN}API prefix${RESET}    : $API_PREFIX"
echo -e "  ${GREEN}API port${RESET}      : $API_PORT  (internal, not exposed)"
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
warn "Keep config.json private — it contains your API prefix and port."
echo
