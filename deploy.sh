#!/bin/bash

# Arquivo: deploy.sh
# Script de deploy para BitBeats em um Ubuntu 24.04 Minimal VPS
# Assume que o script é executado a partir do diretório raiz do projeto (bitbeats/)

# --- Configurações ---
clear
PROJECT_DIR=$(pwd)
REPO_URL="<URL_DO_SEU_REPOSITORIO_GIT>" # Substitua pela URL real
# Detect Public IP
SERVER_IP=$(curl -s ifconfig.me)
if [ -z "$SERVER_IP" ]; then
    SERVER_IP="127.0.0.1"
fi
DOMAIN_NAME=$SERVER_IP 
APP_HOST="127.0.0.1"
APP_PORT="3000"

# Detect Real User (if running with sudo)
if [ -n "$SUDO_USER" ]; then
    USER_NAME=$SUDO_USER
    USER_HOME=$(getent passwd $SUDO_USER | cut -d: -f6)
else
    USER_NAME=$(whoami)
    USER_HOME=$HOME
fi

# --- Funções Auxiliares ---
log() {
    echo -e "\n\033[1;34m==> $1\033[0m"
}

error() {
    echo -e "\n\033[1;31m!!! ERRO: $1\033[0m"
    exit 1
}

ensure_dir_case() {
    local expected="$1"
    if [ -d "$expected" ]; then
        return
    fi
    local name
    name=$(basename "$expected")
    local alt
    alt=$(find "$PROJECT_DIR" -type d -iname "$name" | head -n 1)
    if [ -n "$alt" ]; then
        log "Criando link simbólico para corrigir case de $name"
        mkdir -p "$(dirname "$expected")"
        ln -s "$alt" "$expected"
    else
        error "Diretório obrigatório não encontrado: $expected"
    fi
}
ensure_module_case() {
    local base_dir="$1"
    local module="$2"
    if [ ! -d "$base_dir" ]; then
        error "Diretório base para módulos não encontrado: $base_dir"
    fi
    for ext in ts tsx js cjs mjs; do
        if [ -f "$base_dir/$module.$ext" ]; then
            return
        fi
    done
    local alt
    alt=$(find "$base_dir" -maxdepth 1 -type f -iname "$module.*" | head -n 1)
    if [ -n "$alt" ]; then
        local ext="${alt##*.}"
        log "Criando link simbólico para corrigir case de $module.$ext"
        ln -s "$alt" "$base_dir/$module.$ext"
    else
        error "Arquivo obrigatório não encontrado: $base_dir/$module.(ts|js)"
    fi
}
resolve_server_entry() {
    local candidates=("src/server.ts" "server.ts" "src/server.js" "server.js" "client/src/server.ts")
    for candidate in "${candidates[@]}"; do
        if [ -f "$PROJECT_DIR/$candidate" ]; then
            echo "$candidate"
            return 0
        fi
    done
    return 1
}
resolve_track_controller() {
    local candidates=(
        "src/controllers/TrackController.ts"
        "src/controllers/TrackController.js"
        "controllers/TrackController.ts"
        "controllers/TrackController.js"
        "TrackController.ts"
        "TrackController.js"
    )
    for candidate in "${candidates[@]}"; do
        if [ -f "$PROJECT_DIR/$candidate" ]; then
            echo "$candidate"
            return 0
        fi
    done
    local found
    found=$(find "$PROJECT_DIR" -maxdepth 3 -type f \( -name "TrackController.ts" -o -name "TrackController.js" \) | head -n 1 || true)
    if [ -n "$found" ]; then
        echo "$found"
        return 0
    fi
    return 1
}

# --- 1. Preparação do Sistema ---
log "1. Atualizando o sistema e instalando dependências básicas"
sudo apt update -y
sudo apt upgrade -y

# Instalar ferramentas de build (necessárias para webtorrent-hybrid)
sudo apt install -y build-essential python3 make g++

# Criar Swap (2GB) - Essencial para VPS com pouca RAM
if ! grep -q "swapfile" /etc/fstab; then
    log "Criando arquivo de swap (2GB)"
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
else
    log "Arquivo de swap já existe."
fi

# --- 2. Instalação do Node.js e PM2 ---
log "2. Instalando Node.js v20"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

log "Instalando PM2 e TSX (TypeScript Execute)"
sudo npm install -g pm2 tsx

# --- 3. Instalação do Nginx e Certbot ---
log "3. Instalando Nginx e Certbot"
sudo apt install -y nginx certbot python3-certbot-nginx

# --- 4. Preparação do Projeto ---
log "4. Clonando ou garantindo o código-fonte"
if [ ! -d "$PROJECT_DIR/.git" ]; then
    log "Aviso: Não é um repositório Git. Assumindo que o código já está aqui."
fi
log "Garantindo case correto dos diretórios essenciais"

npx prisma generate
npx prisma db push

log "Instalando dependências do projeto (Backend e Frontend)"
npm install || error "Falha ao instalar dependências do projeto."
npm install -D tsx # Install tsx locally to ensure it is available for PM2
log "Garantindo dependência dotenv"
if ! npm ls dotenv >/dev/null 2>&1; then
    npm install dotenv || error "Falha ao instalar dotenv."
fi

log "Construindo o Frontend (React/Vite)"
npm run client:build || error "Falha ao construir o frontend."

log "Migrando o banco de dados (Prisma/SQLite)"
# Cria o arquivo prod.db e aplica as migrações
npx prisma db push || error "Falha ao sincronizar o banco de dados."
npx prisma generate || error "Falha ao gerar o cliente Prisma."

# --- 5. Configuração do Nginx ---
log "5. Configurando Nginx Reverse Proxy"
NGINX_CONF="/etc/nginx/sites-available/bitbeats_ip"

# Remove default nginx config if exists
if [ -f /etc/nginx/sites-enabled/default ]; then
    log "Removendo configuração padrão do Nginx"
    sudo rm /etc/nginx/sites-enabled/default
fi

# Remove old config if exists (from previous runs)
if [ -f /etc/nginx/sites-enabled/bitbeats.example.com ]; then
    log "Removendo configuração antiga (bitbeats.example.com)"
    sudo rm /etc/nginx/sites-enabled/bitbeats.example.com
fi

# Generate Self-Signed Certificate only if not already exist
if [ ! -f /etc/ssl/certs/nginx-selfsigned.crt ] || [ ! -f /etc/ssl/private/nginx-selfsigned.key ]; then
    log "Gerando certificado auto-assinado para $SERVER_IP e localhost"
    SAN_CONF=$(mktemp)
    cat <<EOF > "$SAN_CONF"
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
C = BR
ST = SP
L = SaoPaulo
O = BitBeats
CN = $SERVER_IP

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = $SERVER_IP
EOF
    sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/ssl/private/nginx-selfsigned.key \
        -out /etc/ssl/certs/nginx-selfsigned.crt \
        -config "$SAN_CONF"
    rm -f "$SAN_CONF"
else
    log "Certificado auto-assinado já existe, pulando criação."
fi

if [ ! -f "$NGINX_CONF" ]; then
    sudo bash -c "cat > $NGINX_CONF" <<EOF
server {
    listen 80 default_server;
    server_name _;
    client_max_body_size 200m;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl default_server;
    server_name _;
    client_max_body_size 200m;

    ssl_certificate /etc/ssl/certs/nginx-selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/nginx-selfsigned.key;

    location / {
        proxy_pass http://$APP_HOST:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
    log "Configuração Nginx criada em $NGINX_CONF"
else
    log "Configuração Nginx já existe em $NGINX_CONF, pulando criação."
fi

sudo ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx || error "Falha na configuração ou reinício do Nginx."

# --- 6. Configuração do Certbot (HTTPS) ---
log "6. Pular Certbot (Usando Self-Signed para IP)"

# --- 7. Configuração do PM2 ---
log "7. Configurando PM2 para manter o servidor Node.js ativo"

# Clearing old PM2 logs
log "Limpando logs antigos do PM2"
pm2 flush
if [ "$USER_NAME" != "root" ]; then
    sudo -u $USER_NAME pm2 flush
fi  
# Stop existing processes (try both root and user)
pm2 stop bitbeats 2>/dev/null
pm2 delete bitbeats 2>/dev/null
if [ "$USER_NAME" != "root" ]; then
    sudo -u $USER_NAME pm2 stop bitbeats 2>/dev/null
    sudo -u $USER_NAME pm2 delete bitbeats 2>/dev/null
fi

SERVER_ENTRY=$(resolve_server_entry) || error "Arquivo de entrada do servidor não encontrado."
log "Entrada do servidor detectada em $SERVER_ENTRY"

# Fix permissions for the project directory so the user can run it
log "Ajustando permissões do diretório para $USER_NAME"
chown -R $USER_NAME:$USER_NAME $PROJECT_DIR

# Usar TSX local (mais robusto que global)
TSX_PATH="./node_modules/.bin/tsx"

# Definimos HOST para 127.0.0.1 para garantir que o Nginx encontre o serviço
# Executamos como o usuário real, não root
log "Iniciando aplicação como usuário: $USER_NAME"
sudo -u "$USER_NAME" env HOST=$APP_HOST PORT=$APP_PORT pm2 start "$SERVER_ENTRY" --interpreter "$TSX_PATH" --name "bitbeats" --cwd "$PROJECT_DIR" --exp-backoff-restart-delay=100

log "Configurando PM2 para iniciar no boot"
sudo -u $USER_NAME pm2 save --force
sudo env PATH=\$PATH:/usr/bin pm2 startup systemd -u $USER_NAME --hp $USER_HOME

# --- 8. Verificação de Status ---
log "8. Verificando status da aplicação"
sleep 10 # Aumentado para dar tempo ao TSX compilar/iniciar

HTTP_STATUS=$(curl -o /dev/null -s -w "%{http_code}\n" http://$APP_HOST:$APP_PORT)

if [ "$HTTP_STATUS" == "200" ] || [ "$HTTP_STATUS" == "301" ] || [ "$HTTP_STATUS" == "302" ]; then
    log "SUCESSO: Aplicação respondendo (HTTP $HTTP_STATUS)"
else
    log "AVISO: Aplicação retornou status inesperado: $HTTP_STATUS. Verifique os logs: pm2 logs bitbeats"
fi

log "Deployment concluído!"
echo "Acesse seu aplicativo em https://$DOMAIN_NAME (Aceite o certificado auto-assinado)"
echo "Status do PM2 (usuário $USER_NAME): sudo -u $USER_NAME pm2 status bitbeats"
sudo -u "$USER_NAME" pm2 status bitbeats
sudo -u "$USER_NAME" pm2 status
echo "Logs do PM2 (usuário $USER_NAME): sudo -u $USER_NAME pm2 logs bitbeats --lines 100 --nostream"
sudo -u "$USER_NAME" pm2 logs bitbeats --lines 100 --nostream
