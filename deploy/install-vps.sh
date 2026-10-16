#!/usr/bin/env bash
# Run on the VPS, from an extracted deployment bundle: sudo bash deploy/install-vps.sh
set -euo pipefail
umask 022
DOMAIN=eduagentpct.my.id
NODE_VERSION=24.19.0
SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR=/opt/eduagentpct
STATE_DIR=/var/lib/eduagentpct
NGINX_CONFIG=/etc/nginx/sites-available/eduagentpct
[[ "$EUID" -eq 0 ]] || { echo 'Run this installer with sudo.' >&2; exit 1; }
[[ -f "$SOURCE_DIR/server.js" && -f "$SOURCE_DIR/package-lock.json" ]] || { echo 'Missing application files.' >&2; exit 1; }
[[ "$(uname -m)" == x86_64 ]] || { echo 'This installer requires x86_64. Inspect the VPS architecture before adapting.' >&2; exit 1; }
if [[ -e "$NGINX_CONFIG" ]] && ! grep -q '# Managed by EduAgentPCT' "$NGINX_CONFIG"; then
  echo 'Existing Nginx config is not managed by this app; refusing to overwrite.' >&2; exit 1
fi
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl xz-utils nginx certbot sqlite3
if ! id eduagentpct >/dev/null 2>&1; then useradd --system --home-dir "$STATE_DIR" --shell /usr/sbin/nologin eduagentpct; fi
install -d -m 0700 -o eduagentpct -g eduagentpct "$STATE_DIR"
install -d -m 0755 "$APP_DIR/releases" /var/www/eduagentpct-acme/.well-known/acme-challenge
if [[ ! -x "/opt/node-v$NODE_VERSION/bin/node" ]]; then
  TEMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TEMP_DIR"' EXIT
  FILE="node-v$NODE_VERSION-linux-x64.tar.xz"
  curl --fail --show-error --location --proto '=https' --tlsv1.2 "https://nodejs.org/dist/v$NODE_VERSION/$FILE" -o "$TEMP_DIR/$FILE"
  curl --fail --show-error --location --proto '=https' --tlsv1.2 "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt" -o "$TEMP_DIR/SHASUMS256.txt"
  (cd "$TEMP_DIR"; awk -v file="$FILE" '$2 == file { print; found=1 } END { if (!found) exit 1 }' SHASUMS256.txt > expected.sha256; sha256sum --check expected.sha256)
  tar -xJf "$TEMP_DIR/$FILE" -C /opt
  mv "/opt/node-v$NODE_VERSION-linux-x64" "/opt/node-v$NODE_VERSION"
fi
export PATH="/opt/node-v$NODE_VERSION/bin:$PATH"
RELEASE="$APP_DIR/releases/$(date -u +%Y%m%dT%H%M%SZ)-$$"
install -d -m 0755 "$RELEASE"
cp "$SOURCE_DIR/server.js" "$SOURCE_DIR/career.js" "$SOURCE_DIR/branch-migration.js" "$SOURCE_DIR/approvals.js" "$SOURCE_DIR/mail.js" "$SOURCE_DIR/package.json" "$SOURCE_DIR/package-lock.json" "$RELEASE/"
cp -R "$SOURCE_DIR/public" "$SOURCE_DIR/scripts" "$RELEASE/"
find "$RELEASE" -type d -exec chmod 0755 {} +
find "$RELEASE" -type f -exec chmod 0644 {} +
(cd "$RELEASE"; npm ci --omit=dev --ignore-scripts --cache /var/cache/eduagentpct-npm)
if [[ -f "$STATE_DIR/app.sqlite" ]]; then
  install -d -m 0700 /var/backups/eduagentpct
  sqlite3 "$STATE_DIR/app.sqlite" ".backup '/var/backups/eduagentpct/pre-deploy-$(date -u +%Y%m%dT%H%M%SZ).sqlite'"
  chmod 0600 /var/backups/eduagentpct/*.sqlite
fi
# Import the user-confirmed list under the service account; preserve existing entries.
# Pause requests while account/letter uniqueness is migrated to per-branch.
systemctl stop eduagentpct 2>/dev/null || true
if ! runuser -u eduagentpct -- env DB_PATH="$STATE_DIR/app.sqlite" "/opt/node-v$NODE_VERSION/bin/node" "$RELEASE/scripts/import-partners.js" "$RELEASE/scripts/partners-palcomtech.json"; then
  systemctl start eduagentpct 2>/dev/null || true
  echo 'Migration/import failed; deployment stopped. Inspect logs before retrying.' >&2
  exit 1
fi
# Seed the owner-supplied Career Match workbook once, without replacing later operator edits.
if ! runuser -u eduagentpct -- env DB_PATH="$STATE_DIR/app.sqlite" "/opt/node-v$NODE_VERSION/bin/node" "$RELEASE/scripts/import-partner-profiles.js" "$RELEASE/scripts/career-partners-lahat.json" --only-missing; then
  systemctl start eduagentpct 2>/dev/null || true
  echo 'Career profile import failed; deployment stopped. Inspect logs before retrying.' >&2
  exit 1
fi
# Keep any existing current release for operator rollback; never remove the database.
ln -s "$RELEASE" "$APP_DIR/current.next"
mv -Tf "$APP_DIR/current.next" "$APP_DIR/current"
cat > /etc/systemd/system/eduagentpct.service <<SERVICE
[Unit]
Description=EduAgentPCT student portal
After=network.target
[Service]
Type=simple
User=eduagentpct
Group=eduagentpct
WorkingDirectory=$APP_DIR/current
ExecStart=/opt/node-v$NODE_VERSION/bin/node server.js
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=3000
Environment=DB_PATH=$STATE_DIR/app.sqlite
Environment=TRUST_LOCAL_PROXY=1
EnvironmentFile=-/etc/eduagentpct.env
Restart=on-failure
RestartSec=5
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=$STATE_DIR
[Install]
WantedBy=multi-user.target
SERVICE
systemctl daemon-reload
systemctl enable --now eduagentpct
systemctl restart eduagentpct
for attempt in {1..15}; do
  if curl --fail --silent http://127.0.0.1:3000/api/health | grep -q '"status":"ok"'; then break; fi
  if [[ "$attempt" == 15 ]]; then journalctl -u eduagentpct -n 40 --no-pager; exit 1; fi
  sleep 1
done
# Preserve other sites. HTTP only serves ACME, and redirects other requests to HTTPS.
if [[ ! -s "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
cat > "$NGINX_CONFIG" <<NGINX
# Managed by EduAgentPCT
server {
    listen 80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/eduagentpct-acme; }
    location / { return 301 https://\$host\$request_uri; }
}
NGINX
ln -sfn "$NGINX_CONFIG" /etc/nginx/sites-enabled/eduagentpct
nginx -t
systemctl enable --now nginx
systemctl reload nginx
# DNS A must point to this VPS; remove incorrect AAAA records before running.
certbot certonly --webroot -w /var/www/eduagentpct-acme -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email
fi
cat > "$NGINX_CONFIG" <<NGINX
# Managed by EduAgentPCT
server {
    listen 80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/eduagentpct-acme; }
    location / { return 301 https://\$host\$request_uri; }
}
server {
    listen 443 ssl;
    server_name $DOMAIN;
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 64k;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
NGINX
ln -sfn "$NGINX_CONFIG" /etc/nginx/sites-enabled/eduagentpct
nginx -t
systemctl enable --now nginx
systemctl reload nginx
install -d /etc/letsencrypt/renewal-hooks/deploy
printf '%s\n' '#!/bin/sh' 'systemctl reload nginx' > /etc/letsencrypt/renewal-hooks/deploy/eduagentpct-nginx
chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/eduagentpct-nginx
systemctl enable --now certbot.timer
curl --fail --show-error "https://$DOMAIN/api/health"
curl --fail --silent "https://$DOMAIN/" | grep -q 'Masuk ke ruang siswa'
printf '\nEduAgentPCT deployed. Confirm browser registration and PDF workflow after importing verified partners.\n'
