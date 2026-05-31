#!/usr/bin/env bash
# BilgeBaykuş — Ubuntu 22.04/24.04 kurulum scripti
# Kullanım: chmod +x scripts/ubuntu-install.sh && ./scripts/ubuntu-install.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> BilgeBaykuş Ubuntu kurulumu ($ROOT)"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl bulunamadı, yükleniyor..."
  sudo apt-get update -qq
  sudo apt-get install -y curl ca-certificates gnupg
fi

if ! command -v node >/dev/null 2>&1; then
  echo "==> Node.js 20 kuruluyor..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "Node: $(node -v) | npm: $(npm -v)"

if ! command -v mongod >/dev/null 2>&1; then
  echo "==> MongoDB 7 kuruluyor..."
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc \
    | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
  echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
    | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y mongodb-org
  sudo systemctl enable --now mongod
fi

if ! command -v redis-server >/dev/null 2>&1; then
  echo "==> Redis kuruluyor..."
  sudo apt-get update -qq
  sudo apt-get install -y redis-server
  sudo systemctl enable --now redis-server
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "==> PM2 kuruluyor..."
  sudo npm install -g pm2
fi

echo "==> npm install..."
npm ci 2>/dev/null || npm install

echo "==> Derleme..."
npm run build

node scripts/ensure-dirs.mjs

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo ""
  echo "!! .env dosyası oluşturuldu — Discord token ve BOT_OWNER_ID değerlerini düzenleyin."
fi

echo ""
echo "Kurulum tamamlandı."
echo ""
echo "Sonraki adımlar:"
echo "  1. .env dosyasını düzenleyin"
echo "  2. Slash komutları: npm run deploy"
echo "  3. Başlatma: npm run pm2:start"
