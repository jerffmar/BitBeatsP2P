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
    local candidates=("src/server.ts" "server.ts" "src/server.js" "server.js")
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
# --- Início do Deploy ---
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
