#!/bin/sh
set -e

echo "[entrypoint] ql-kho-gcc starting..."

# Default DATABASE_URL nếu chưa set (production thường set qua env)
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="file:/app/data/app.db"
  echo "[entrypoint] DATABASE_URL default → $DATABASE_URL"
fi

# Ensure data directory exists and is writable
DATA_DIR=$(echo "$DATABASE_URL" | sed -E 's|^file:||' | xargs dirname)
mkdir -p "$DATA_DIR" 2>/dev/null || true

# Apply migrations (gọi prisma trực tiếp, không qua npx — npm script lookup
# không hoạt động trong standalone build)
echo "[entrypoint] prisma migrate deploy..."
node node_modules/prisma/build/index.js migrate deploy

# Bootstrap admin nếu DB chưa có admin nào và env có ADMIN_INITIAL_PASSWORD
if [ -n "$ADMIN_INITIAL_PASSWORD" ]; then
  echo "[entrypoint] Bootstrap admin (if needed)..."
  node prisma/bootstrap-admin.js
else
  echo "[entrypoint] ADMIN_INITIAL_PASSWORD chưa set — bỏ qua bootstrap admin."
fi

echo "[entrypoint] Starting Next.js server on port ${PORT:-3000}..."
exec "$@"
