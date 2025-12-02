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
USER_NAME="ubuntu" # Usuário padrão do VPS

# --- Funções Auxiliares ---
log() {
    echo -e "\n\033[1;34m==> $1\033[0m"
}

error() {
    echo -e "\n\033[1;31m!!! ERRO: $1\033[0m"
    exit 1
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

log "Instalando dependências do projeto (Backend e Frontend)"
npm install || error "Falha ao instalar dependências do projeto."

log "Construindo o Frontend (React/Vite)"
npm run client:build || error "Falha ao construir o frontend."

log "Migrando o banco de dados (Prisma/SQLite)"
# Cria o arquivo prod.db e aplica as migrações
npx prisma migrate deploy || error "Falha ao migrar o banco de dados."

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

# Generate Self-Signed Certificate
log "Gerando certificado auto-assinado para $SERVER_IP"
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/nginx-selfsigned.key \
    -out /etc/ssl/certs/nginx-selfsigned.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=$SERVER_IP"

sudo bash -c "cat > $NGINX_CONF" <<EOF
server {
    listen 80 default_server;
    server_name _;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl default_server;
    server_name _;

    ssl_certificate /etc/ssl/certs/nginx-selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/nginx-selfsigned.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx || error "Falha na configuração ou reinício do Nginx."

# --- 6. Configuração do Certbot (HTTPS) ---
log "6. Pular Certbot (Usando Self-Signed para IP)"

# --- 7. Configuração do PM2 ---
log "7. Configurando PM2 para manter o servidor Node.js ativo"
pm2 stop bitbeats 2>/dev/null
pm2 delete bitbeats 2>/dev/null

# Debug: Verificar se o arquivo existe
if [ ! -f "server.ts" ]; then
    log "DEBUG: Arquivo server.ts não encontrado no diretório atual: $(pwd)"
    log "Conteúdo do diretório:"
    ls -la
    error "Arquivo de entrada do servidor não encontrado."
fi

# Usar TSX (mais robusto que ts-node para Node 22+)
# Definimos HOST para 127.0.0.1 para garantir que o Nginx encontre o serviço
HOST=127.0.0.1 PORT=3000 pm2 start server.ts --interpreter tsx --name "bitbeats"

log "Configurando PM2 para iniciar no boot"
pm2 save --force
sudo env PATH=\$PATH:/usr/bin pm2 startup systemd -u $USER_NAME --hp /home/$USER_NAME

# --- 8. Verificação de Status ---
log "8. Verificando status da aplicação"
sleep 5 # Aguarda alguns segundos para o servidor iniciar

HTTP_STATUS=$(curl -o /dev/null -s -w "%{http_code}\n" http://127.0.0.1:3000)

if [ "$HTTP_STATUS" == "200" ] || [ "$HTTP_STATUS" == "301" ] || [ "$HTTP_STATUS" == "302" ]; then
    log "SUCESSO: Aplicação respondendo (HTTP $HTTP_STATUS)"
else
    log "AVISO: Aplicação retornou status inesperado: $HTTP_STATUS. Verifique os logs: pm2 logs bitbeats"
fi

log "Deployment concluído!"
echo "Acesse seu aplicativo em https://$DOMAIN_NAME (Aceite o certificado auto-assinado)"
echo "Status do PM2: pm2 status"
pm2 status bitbeats
