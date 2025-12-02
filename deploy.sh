#!/bin/bash
set -euo pipefail

GREEN="\e[32m"
YELLOW="\e[33m"
CYAN="\e[36m"
RED="\e[31m"
RESET="\e[0m"

info()  { echo -e "${GREEN}[+] ${1}${RESET}"; }
warn()  { echo -e "${YELLOW}[!] ${1}${RESET}"; }
error() { echo -e "${RED}[-] ${1}${RESET}"; }

if [[ $EUID -ne 0 ]]; then
	error "Run this script as root (use sudo)."
	exit 1
fi

REPO_URL="${REPO_URL:-https://github.com/jerffmar/bitbeatsP2P.git}"
FRONTEND_DIR="/var/www/bitbeats/frontend"
BACKEND_DIR="/var/www/bitbeats/backend"
HTML_DIR="/var/www/bitbeats/html"
UPLOAD_DIR="/opt/bitbeats/uploads"
DB_USER="bitbeats"
DB_NAME="bitbeats_main"
DB_PASSWORD="${DB_PASSWORD:-bitbeats_strong_password}"

info "Updating system packages"
apt update && apt -y upgrade

info "Checking RAM and configuring swap if needed"
RAM_MB=$(awk '/MemTotal/ { printf "%d", $2 / 1024 }' /proc/meminfo)
if (( RAM_MB < 2000 )); then
	if [[ ! -f /swapfile ]]; then
		info "Creating 2G swap file due to low RAM (${RAM_MB}MB)"
		fallocate -l 2G /swapfile
		chmod 600 /swapfile
		mkswap /swapfile
		swapon /swapfile
		echo "/swapfile none swap sw 0 0" >> /etc/fstab
	else
		warn "Swap file already exists; skipping creation"
	fi
else
	info "Sufficient RAM detected (${RAM_MB}MB); swap file not required"
fi

info "Installing base dependencies"
apt install -y curl git python3 make g++ build-essential ca-certificates gnupg lsb-release ufw

info "Installing Node.js 20.x"
if ! command -v node >/dev/null 2>&1; then
	curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
	apt install -y nodejs
else
	warn "Node.js already installed; skipping"
fi

if command -v pm2 >/dev/null 2>&1; then
	warn "PM2 already installed; skipping"
else
	npm install -g pm2
fi

info "Installing Nginx and Certbot"
apt install -y nginx python3-certbot-nginx

info "Installing PostgreSQL 16"
apt install -y postgresql postgresql-contrib

info "Configuring PostgreSQL role and database"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
	sudo -u postgres psql -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}'"
else
	warn "PostgreSQL role ${DB_USER} already exists"
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
	sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}"
else
	warn "PostgreSQL database ${DB_NAME} already exists"
fi

sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET client_encoding TO 'UTF8'"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET default_transaction_isolation TO 'read committed'"
sudo -u postgres psql -c "ALTER ROLE ${DB_USER} SET timezone TO 'UTC'"

info "Ensuring uploads directory exists"
mkdir -p "${UPLOAD_DIR}"
chown www-data:www-data "${UPLOAD_DIR}"

info "Configuring UFW firewall"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 6881/tcp
ufw allow 6881/udp
ufw --force enable

info "Preparing application directories"
mkdir -p /var/www/bitbeats
if [[ -d /var/www/bitbeats/.git ]]; then
	info "Repository already cloned; pulling latest changes"
	git -C /var/www/bitbeats pull || { error "git pull failed"; exit 1; }
else
	info "Cloning repository from ${REPO_URL}"
	if ! git clone "${REPO_URL}" /var/www/bitbeats; then
		error "git clone failed – verify repo access"
		exit 1
	fi
fi

info "Installing frontend dependencies and building"
if [[ -d "${FRONTEND_DIR}" ]]; then
	pushd "${FRONTEND_DIR}" >/dev/null
	npm install
	npm run build
	popd >/dev/null
	mkdir -p "${HTML_DIR}"
	rsync -a --delete "${FRONTEND_DIR}/dist/" "${HTML_DIR}/"
else
	warn "Frontend directory not found at ${FRONTEND_DIR}; skipping build"
fi

info "Installing backend dependencies, running migrations, and building"
if [[ -d "${BACKEND_DIR}" ]]; then
	pushd "${BACKEND_DIR}" >/dev/null
	npm install
	export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}?schema=public"
	npx prisma migrate deploy
	npm run build
	popd >/dev/null
else
	warn "Backend directory not found at ${BACKEND_DIR}; skipping setup"
fi

info "Creating Nginx server block"
cat <<'EOF' >/etc/nginx/sites-available/bitbeats
server {
	listen 80;
	server_name _;

	root /var/www/bitbeats/html;
	index index.html;

	gzip on;
	gzip_types text/css application/javascript application/json image/svg+xml;
	gzip_min_length 256;

	location / {
		try_files $uri /index.html;
	}

	location /api/ {
		proxy_pass http://127.0.0.1:3000/;
		proxy_set_header Host $host;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
	}

	location /tracker/ {
		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection "upgrade";
		proxy_pass http://127.0.0.1:3000/tracker/;
		proxy_set_header Host $host;
	}
}
EOF

ln -sf /etc/nginx/sites-available/bitbeats /etc/nginx/sites-enabled/bitbeats
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

if [[ -d "${BACKEND_DIR}" ]]; then
	info "Starting backend with PM2"
	pushd "${BACKEND_DIR}" >/dev/null
	pm2 start ecosystem.config.js
	pm2 save
	pm2 startup systemd -u "${SUDO_USER:-root}" --hp "$(eval echo ~${SUDO_USER:-root})" >/tmp/pm2.txt
	bash /tmp/pm2.txt || true
	popd >/dev/null
else
	warn "PM2 not started because backend directory is missing"
fi

info "Running health check"
curl -I http://localhost | head -n 1

info "Deployment complete"
