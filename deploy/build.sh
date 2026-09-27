#!/usr/bin/env bash
# Runs on the VDS: installs dependencies, syncs the DB schema, builds and restarts Somon.
set -e
# binaries.prisma.sh is throttled from Russian networks; the npmmirror copy is identical.
export PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
APP=/opt/somon/app
DOMAIN=87-228-40-247.sslip.io

if [ ! -f /opt/somon/backend.env ]; then
  cat > /opt/somon/backend.env <<EOF
DATABASE_URL="file:./prod.db"
JWT_SECRET="$(openssl rand -hex 48)"
JWT_EXPIRES_IN="7d"
PORT=4000
FRONTEND_URL="https://$DOMAIN"
UPLOAD_DIR="/opt/somon/uploads"
MAX_FILE_SIZE_MB=20
COOKIE_SECURE=true
LESSON_REMINDER_HOURS=3
APP_TIMEZONE=Asia/Dushanbe
EOF
fi
chmod 600 /opt/somon/backend.env
cp /opt/somon/backend.env $APP/backend/.env
mkdir -p /opt/somon/uploads

cd $APP/backend
npm ci --no-audit --no-fund --loglevel=error
npx prisma generate >/dev/null
npx prisma db push --skip-generate >/dev/null
if [ ! -f /opt/somon/.seeded ]; then
  npx tsx prisma/seed.ts
  touch /opt/somon/.seeded
fi
npm run build >/dev/null

cd $APP/frontend
printf 'BACKEND_URL=http://127.0.0.1:4000\nNEXT_PUBLIC_API_URL=\n' > .env.production.local
npm ci --no-audit --no-fund --loglevel=error
NEXT_TELEMETRY_DISABLED=1 npm run build 2>&1 | tail -5

chown -R somon:somon /opt/somon
if systemctl is-enabled somon-api >/dev/null 2>&1; then
  systemctl restart somon-api somon-web
fi
echo BUILD_OK
