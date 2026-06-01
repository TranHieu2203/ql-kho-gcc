# syntax=docker/dockerfile:1.6

# ===== Stage 1: deps — install production deps =====
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ===== Stage 2: builder — compile Next.js standalone =====
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma generate runs at install time, but ensure client is fresh for build
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ===== Stage 3: runner — minimal runtime image =====
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Add non-root user
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S -G nodejs nextjs

# Tools cần thiết lúc runtime:
#  - openssl: prisma engine
#  - tini:    PID 1 signal handling
#  - wget:    healthcheck
#  - su-exec: drop privilege từ root xuống nextjs (cho phép entrypoint
#             tự fix permission của volume bind mount lúc start)
#  - tzdata:  cho phép set TZ ở runtime (vd: Asia/Ho_Chi_Minh)
RUN apk add --no-cache libc6-compat openssl tini wget su-exec tzdata

# Default timezone VN (UTC+7). Override qua env TZ trong docker-compose.
ENV TZ=Asia/Ho_Chi_Minh

# Standalone build → copy chỉ runtime cần thiết (server.js + .next + lib min)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma — schema + client + CLI + engines + migrations + bootstrap script
# (standalone không copy prisma/ và devDeps → phải copy thủ công)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
# Copy TOÀN BỘ @prisma/* (client, engines, engines-version, debug, fetch-engine, get-platform, ...)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
# Prisma CLI binary (devDep — không có trong standalone, phải copy)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
# bcryptjs (đã marked external trong webpack) — copy luôn
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs

# Entrypoint script
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Prepare data dir (mount point for SQLite + backups)
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data
VOLUME ["/app/data"]

# LƯU Ý: KHÔNG set USER nextjs ở đây — entrypoint phải start là root để
# có thể chown /app/data (volume bind mount thường có owner root từ host).
# Sau khi chown xong, entrypoint tự dùng su-exec drop privilege sang nextjs.
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--", "./docker-entrypoint.sh"]
CMD ["node", "server.js"]
