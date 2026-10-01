#!/bin/bash
set -e
cd /root/pkl-management
# Build dengan .env produksi (VITE_API_URL=https://pkl.jolink.co.id)
npm run build
# Sync ke webroot Caddy
cp -a dist/. /var/www/pkl/
chown -R caddy:caddy /var/www/pkl
chmod -R 755 /var/www/pkl
echo "Deploy frontend OK -> https://pkl.jolink.co.id"
