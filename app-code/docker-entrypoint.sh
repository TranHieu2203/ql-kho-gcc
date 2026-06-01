#!/bin/sh
set -e

echo "[entrypoint] ql-kho-gcc starting..."

# Default DATABASE_URL nếu chưa set
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="file:/app/data/app.db"
  echo "[entrypoint] DATABASE_URL default → $DATABASE_URL"
fi

# Suy ra data dir từ DATABASE_URL (file:/path/file.db)
DATA_DIR=$(echo "$DATABASE_URL" | sed -E 's|^file:||' | xargs dirname)

# ===== Phase 1: chạy là root (nếu được) → fix permission volume =====
# Volume bind mount từ host thường có owner root → nextjs (UID 1001) không
# ghi được. Sửa bằng cách mkdir + chown ở đây.
if [ "$(id -u)" = "0" ]; then
  echo "[entrypoint] Running as root — fixing volume permissions..."
  mkdir -p "$DATA_DIR"
  chown -R nextjs:nodejs "$DATA_DIR" || echo "[entrypoint] WARN: chown $DATA_DIR thất bại (read-only fs?)"
  # Drop privilege sang nextjs và re-exec chính script này
  echo "[entrypoint] Re-exec as nextjs..."
  exec su-exec nextjs:nodejs "$0" "$@"
fi

# ===== Phase 2: từ đây trở đi đang là nextjs =====
echo "[entrypoint] Running as $(id -un):$(id -gn) ($(id -u):$(id -g))"

# Apply migrations
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
