---
title: "Architecture — Phần mềm Quản lý Kho Lốp xe (ql-kho-gcc)"
status: final
created: 2026-05-31
updated: 2026-05-31
owner: HieuTV-QL-Kho
language: vi
sources:
  - "../briefs/brief-ql-kho-gcc-2026-05-31/brief.md"
  - "../briefs/brief-ql-kho-gcc-2026-05-31/addendum.md"
  - "../ux-designs/ux-ql-kho-gcc-2026-05-31/DESIGN.md"
  - "../ux-designs/ux-ql-kho-gcc-2026-05-31/EXPERIENCE.md"
---

# Architecture — ql-kho-gcc

## 1. Quyết định chính (Decision Snapshot)

| Lĩnh vực | Lựa chọn | Lý do ngắn |
|---|---|---|
| Frontend | **Next.js 14 (App Router)** + TypeScript | Industry standard, ecosystem mạnh ở VN, PWA tốt qua `serwist`, server actions giảm boilerplate API |
| UI Library | **shadcn/ui** + Tailwind CSS | Map 1-1 với DESIGN.md tokens, không vendor-lock (component copy vào codebase), dark mode + responsive sẵn |
| Backend | **Next.js Route Handlers + Server Actions** | Cùng codebase, 1 deploy unit, đủ cho quy mô <100 SKU + 3 users |
| Database | **SQLite** + WAL mode | Self-host dễ (1 file `.db`), không cần server riêng, đủ scale, easy backup (`cp app.db backup.db`) |
| ORM | **Prisma** | Schema-first, type-safe, migration tự sinh, ecosystem tốt |
| Auth | **Lucia v3** (session + cookie) | Lightweight, không vendor (vs NextAuth quá nhiều plumbing), session lưu DB, hỗ trợ Lucia adapter Prisma |
| PWA / Offline | **Serwist (next-pwa successor)** + IndexedDB qua **Dexie.js** | Service Worker + caching tốt, Dexie cho queue API gọn |
| State client | React Server Components + **TanStack Query** cho client mutation | RSC cho list/read, TanStack Query cho mutation + optimistic update |
| Forms | **react-hook-form** + **zod** | Schema-driven validation, đẹp với TypeScript, integrate aria-invalid tốt |
| Tables | **TanStack Table v8** | Sort/filter/paginate headless, tự render với shadcn primitives |
| Excel I/O | **exceljs** (server) + **xlsx** (client preview) | exceljs giữ format tốt khi xuất, xlsx nhẹ cho preview client |
| PDF | **@react-pdf/renderer** (server) | Hỗ trợ font Việt embed, page-break-inside avoid, layout declarative |
| Date | **date-fns** + locale `vi` | Lightweight, tree-shake, format VN chuẩn |
| Icon | **lucide-react** | Match DESIGN spec (stroke 1.5), nhẹ |
| Validation | **zod** + share schema client-server | Single source of truth |
| Testing | **Vitest** + **Playwright** (E2E) | Vitest nhanh cho unit; Playwright cho golden-path E2E |
| Deploy | Single Node.js server (`pm2` or `systemd`) + Caddy reverse proxy + Let's Encrypt | Self-host theo brief; Caddy auto HTTPS |
| Logs/Audit | DB table `AuditLog` + Pino → file rotation | Đủ cho quy mô; không vendor APM |

## 2. Sơ đồ kiến trúc

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Chrome/Safari/Firefox)                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Next.js PWA (React + RSC + Client Components)       │    │
│  │  ├─ App Router pages (server-rendered)              │    │
│  │  ├─ Client islands (forms, tables, optimistic)      │    │
│  │  ├─ Service Worker (Serwist)                        │    │
│  │  └─ IndexedDB (Dexie):                              │    │
│  │       - cached read data (catalog, recent stock)    │    │
│  │       - mutation queue (offline writes)             │    │
│  │       - draft forms (autosave 10s)                  │    │
│  └─────────────────────────────────────────────────────┘    │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS (Caddy reverse proxy)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Node.js Server (single process, pm2-managed)               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Next.js Server                                      │    │
│  │  ├─ App Router server components                    │    │
│  │  ├─ Route handlers (POST/PUT/DELETE/sync APIs)      │    │
│  │  ├─ Server actions (in-page mutations)              │    │
│  │  ├─ Lucia session middleware                        │    │
│  │  └─ Audit log writer                                │    │
│  └────────────────┬────────────────────────────────────┘    │
│                   │                                          │
│  ┌────────────────▼────────────────────────────────────┐    │
│  │ Prisma Client → SQLite (WAL mode)                   │    │
│  │   file: ./data/app.db                               │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Logs (pino) → ./logs/app-*.log (rotate daily)       │    │
│  │ Backup cron: cp app.db → ./data/backups/{date}.db   │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 3. Cấu trúc thư mục (proposed)

```
ql-kho-gcc/                              ← project root
├── app/                                 ← Next.js App Router
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx                   ← bare layout, no sidebar
│   ├── (app)/                           ← authenticated area
│   │   ├── layout.tsx                   ← sidebar + topbar shell
│   │   ├── page.tsx                     ← / dashboard
│   │   ├── danh-muc/
│   │   │   ├── page.tsx
│   │   │   ├── them/page.tsx
│   │   │   ├── [id]/page.tsx
│   │   │   └── import/page.tsx
│   │   ├── nhap-kho/
│   │   │   ├── page.tsx
│   │   │   ├── tao/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── xuat-kho/...                 ← parallel structure
│   │   ├── chuyen-kho/...
│   │   ├── ton-kho/
│   │   │   ├── page.tsx
│   │   │   └── [sku]/page.tsx
│   │   ├── bao-cao/
│   │   │   └── nxt/page.tsx
│   │   ├── quan-tri/
│   │   │   ├── nguoi-dung/
│   │   │   ├── kho/
│   │   │   ├── audit-log/
│   │   │   └── cau-hinh/
│   │   └── ca-nhan/...
│   ├── api/                             ← Route handlers
│   │   ├── auth/[...lucia]/route.ts
│   │   ├── sync/route.ts                ← bulk mutation flush (offline queue)
│   │   ├── import/route.ts              ← Excel upload
│   │   ├── export/[type]/route.ts       ← Excel/PDF download
│   │   └── trpc/[trpc]/route.ts         ← (optional) tRPC if we want typed RPC
│   ├── globals.css                      ← Tailwind base + DESIGN tokens as CSS vars
│   ├── layout.tsx                       ← root layout, PWA meta
│   ├── manifest.ts                      ← PWA manifest
│   └── sw.ts                            ← Serwist service worker
├── components/
│   ├── ui/                              ← shadcn primitives (button, dialog, etc.)
│   ├── shell/                           ← sidebar, topbar, bottom-nav, warehouse-switcher
│   ├── forms/                           ← receipt-form, line-items-editor
│   ├── tables/                          ← data-table, stock-table
│   ├── status/                          ← sync-badge, offline-banner, stock-indicator
│   └── pdf/                             ← PDF templates (server-rendered)
├── lib/
│   ├── auth/                            ← Lucia setup, session helpers
│   ├── db/
│   │   ├── prisma.ts                    ← singleton client
│   │   └── seed.ts                      ← seed data
│   ├── domain/                          ← business logic (pure functions, testable)
│   │   ├── stock.ts                     ← computeStock(), checkStockAvailability()
│   │   ├── receipts.ts                  ← createInbound(), createOutbound(), createTransfer()
│   │   ├── audit.ts                     ← logAction()
│   │   └── excel.ts                     ← import/export helpers
│   ├── schemas/                         ← zod schemas (client + server share)
│   ├── offline/
│   │   ├── dexie.ts                     ← Dexie DB schema (queue + cache)
│   │   ├── queue.ts                     ← enqueue, flush, retry
│   │   └── sync.ts                      ← client-side sync orchestration
│   └── utils/                           ← date, number, id helpers
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── public/
│   ├── icons/                           ← PWA icons (192, 384, 512)
│   └── fonts/                           ← Be Vietnam Pro woff2
├── tests/
│   ├── unit/
│   └── e2e/
├── data/                                ← DB + backups (gitignore)
│   └── app.db
├── logs/                                ← (gitignore)
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── README.md
└── .env.example
```

## 4. Data Model (Prisma Schema)

```prisma
// prisma/schema.prisma

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  ADMIN
  WAREHOUSE_STAFF
}

enum Unit {
  BO          // Bộ
  CHIEC       // Chiếc
}

enum ReceiptType {
  INBOUND
  OUTBOUND
  TRANSFER
  ADJUSTMENT  // tồn khởi đầu / điều chỉnh tay
}

enum ReceiptStatus {
  DRAFT
  CONFIRMED       // hoàn tất, ảnh hưởng tồn
  IN_TRANSIT      // chỉ cho TRANSFER: đã rời from, chưa vào to
  CANCELLED
}

enum MovementSource {
  RECEIPT
  ADJUSTMENT
  INITIAL_IMPORT
}

model User {
  id           String   @id @default(cuid())
  username     String   @unique
  passwordHash String
  fullName     String
  role         Role     @default(WAREHOUSE_STAFF)
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  sessions       Session[]
  warehouseLinks UserWarehouse[]
  inboundCreated  Receipt[] @relation("InboundCreator")
  auditLogs       AuditLog[]
}

model Session {
  id        String   @id
  userId    String
  expiresAt DateTime
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Warehouse {
  id        String   @id @default(cuid())
  code      String   @unique          // vd "WH-HN"
  name      String                    // "Kho Hà Nội"
  address   String?
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  userLinks UserWarehouse[]
  receipts  Receipt[]
  movements StockMovement[]
}

model UserWarehouse {
  userId      String
  warehouseId String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  warehouse   Warehouse @relation(fields: [warehouseId], references: [id], onDelete: Cascade)
  @@id([userId, warehouseId])
}

model Product {
  id          String   @id @default(cuid())
  sku         String   @unique         // "KV789H3 1200R20 24PR"
  fullName    String                   // "LỐP KOIVI 1200R20 KV789 H3"
  brand       String                   // "KOIVI"
  size        String                   // "1200R20 20PR"
  pattern     String                   // "KV789H3"
  defaultUnit Unit     @default(BO)
  lowStockThreshold Int @default(10)   // ngưỡng "sắp hết"
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  receiptLines    ReceiptLine[]
  movements       StockMovement[]
}

model Receipt {
  id              String         @id @default(cuid())
  code            String         @unique  // "IN-2026-0043", "OUT-...", "TR-...", "ADJ-..."
  type            ReceiptType
  status          ReceiptStatus  @default(CONFIRMED)
  warehouseId     String         // for INBOUND/OUTBOUND/ADJUSTMENT
  fromWarehouseId String?        // for TRANSFER
  toWarehouseId   String?        // for TRANSFER
  date            DateTime
  customerOrPartner String?      // free-text MVP (sau v2 thay bằng FK)
  note            String?
  createdById     String
  clientRequestId String?        @unique  // idempotency cho offline retry
  version         Int            @default(1) // optimistic concurrency

  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  confirmedAt     DateTime?      // when CONFIRMED (or rolled to CONFIRMED from IN_TRANSIT)
  cancelledAt     DateTime?

  warehouse       Warehouse      @relation(fields: [warehouseId], references: [id])
  createdBy       User           @relation("InboundCreator", fields: [createdById], references: [id])
  lines           ReceiptLine[]
  movements       StockMovement[]

  @@index([type, warehouseId, date])
  @@index([code])
}

model ReceiptLine {
  id         String  @id @default(cuid())
  receiptId  String
  productId  String
  unit       Unit
  quantity   Int                          // >0
  lineNote   String?

  receipt    Receipt @relation(fields: [receiptId], references: [id], onDelete: Cascade)
  product    Product @relation(fields: [productId], references: [id])

  @@index([receiptId])
  @@index([productId])
}

// Sổ chi tiết — derived, append-only. Source of truth cho tồn.
model StockMovement {
  id            String         @id @default(cuid())
  warehouseId   String
  productId     String
  unit          Unit
  qtyDelta      Int                       // +N (nhập) hoặc -N (xuất)
  source        MovementSource
  sourceId      String?                   // FK to Receipt.id nếu source=RECEIPT
  occurredAt    DateTime                  // = receipt.date (cho backdate)
  recordedAt    DateTime @default(now())  // khi ghi vào DB

  warehouse     Warehouse @relation(fields: [warehouseId], references: [id])
  product       Product   @relation(fields: [productId], references: [id])

  @@index([warehouseId, productId, occurredAt])
  @@index([sourceId])
}

model AuditLog {
  id         String   @id @default(cuid())
  userId     String?
  action     String                       // "create", "update", "delete", "login", ...
  entityType String                       // "Receipt", "Product", "Warehouse", "User"
  entityId   String
  before     Json?
  after      Json?
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime @default(now())

  user       User?    @relation(fields: [userId], references: [id])

  @@index([entityType, entityId])
  @@index([userId, createdAt])
}

model Setting {
  key       String   @id           // "low_stock_threshold_default", "out_overstock_policy" ("warn"|"block"), "transfer_timeout_days"
  value     String                 // JSON-stringified
  updatedAt DateTime @updatedAt
}
```

### Quy ước tính tồn

```ts
// computeStock(warehouseId, productId, asOf?) -> number
SELECT COALESCE(SUM(qtyDelta), 0)
FROM StockMovement
WHERE warehouseId = ?
  AND productId = ?
  AND occurredAt <= COALESCE(?, CURRENT_TIMESTAMP)
```

Đối với TRANSFER:
- Tạo phiếu (status = IN_TRANSIT) → 1 movement `-qty` cho from-warehouse với `occurredAt = receipt.date`.
- to-warehouse confirm (status = CONFIRMED) → thêm 1 movement `+qty` cho to-warehouse với `occurredAt = NOW`.
- Cancel/rollback → tạo movement bù `+qty` cho from-warehouse (giữ audit trail, không xoá movement cũ).

## 5. API surface (Server Actions + Route Handlers)

### Mutation pattern (idempotent)
- Mọi mutation chấp nhận `clientRequestId` (UUID) trong body/form.
- Server check `Receipt.clientRequestId` exists → return existing record (200), không tạo trùng.
- Sau khi server xử lý, response trả về `code` chính thức (vd `IN-2026-0043`) để client cập nhật badge từ `IN-DRAFT-xxx`.

### Endpoints chính

```
POST   /api/auth/login                 ← Lucia
POST   /api/auth/logout
GET    /api/me                         ← current user + warehouses

# Catalog
GET    /api/products                   (filter, paginate)
POST   /api/products                   (admin or staff)
PUT    /api/products/:id
DELETE /api/products/:id               (soft delete: active=false)
POST   /api/products/import            (multipart .xlsx → wizard validation)

# Receipts (parameterized type)
GET    /api/receipts?type=...&warehouseId=...&from=...&to=...
GET    /api/receipts/:id
POST   /api/receipts                   ← idempotent, body includes type + lines + clientRequestId
PUT    /api/receipts/:id               ← optimistic concurrency via version
DELETE /api/receipts/:id               ← cascade check before allowing
POST   /api/receipts/:id/confirm-arrival  ← for TRANSFER IN_TRANSIT → CONFIRMED
POST   /api/receipts/:id/cancel

# Stock
GET    /api/stock?warehouseId=...      ← list theo SKU + tồn hiện tại
GET    /api/stock/:productId/movements ← lịch sử movement

# Reports
GET    /api/reports/nxt?from=...&to=...&warehouseId=...
GET    /api/reports/nxt.xlsx           ← Excel download
GET    /api/receipts/:id/pdf           ← PDF download

# Admin
GET/POST/PUT/DELETE /api/users
GET/POST/PUT/DELETE /api/warehouses    ← DELETE → soft archive only
GET    /api/audit-log
GET/PUT /api/settings

# Sync (offline queue flush)
POST   /api/sync                       ← body: { mutations: [{...}] }, returns per-item result
```

### Idempotency policy

Mọi `POST /api/receipts` và `POST /api/sync` REQUIRE `clientRequestId`. Server lưu `clientRequestId` UNIQUE → retry an toàn.

### Optimistic concurrency

`PUT /api/receipts/:id` REQUIRE `version` của bản client đang giữ. Server check `WHERE id=? AND version=?` — nếu mismatch → 409 + trả bản mới để client diff.

## 6. Offline Architecture

### Service Worker (Serwist)
- **Cache strategy**:
  - HTML / app shell: `NetworkFirst` (timeout 3s → fallback cache)
  - Static (JS/CSS/font/image): `CacheFirst` (long TTL)
  - API GET: `StaleWhileRevalidate` (đọc cache nhanh, refresh ngầm)
  - API POST/PUT/DELETE: KHÔNG cache; route qua queue (xem dưới)

### IndexedDB schema (Dexie)
```ts
// lib/offline/dexie.ts
db.version(1).stores({
  products: 'id, sku, brand, size, pattern, active, updatedAt',
  stockByWarehouse: '[warehouseId+productId], warehouseId, productId, qty, asOf',
  recentReceipts: 'id, type, warehouseId, date, code',
  mutationQueue: '++localId, clientRequestId, endpoint, method, payload, status, attempts, createdAt, lastError',
  drafts: 'formKey, payload, savedAt'   // autosave 10s
})
```

### Sync orchestration
```
1. UI Submit:
   - Generate clientRequestId (UUID v4)
   - If online → POST directly + optimistic insert local cache
       - 2xx → confirm
       - Network error → push to queue, badge ↻ "Đang xác nhận"
   - If offline → push to queue, badge ⏳ "Chờ đồng bộ"

2. Background sync:
   - On `online` event → flush queue oldest first
   - On Service Worker `sync` event (Background Sync API) → flush
   - On app open / visibility change → flush
   - Retry policy: exponential backoff (1s, 5s, 30s, 5min, max 3 attempts)
   - On 4xx (validation) → mark FAILED, surface in queue panel for user fix
   - On 5xx → retry later
   - On 409 (conflict) → surface "Conflict tồn" dialog
   - On 401 → pause queue, prompt re-login

3. Safari iOS fallback:
   - Background Sync API unavailable
   - Fallback: foreground polling khi app mở; banner "App phải mở để đồng bộ {N} phiếu"
```

## 7. Bảo mật

- **Password**: hash bằng `argon2id` (qua `oslo/password` của Lucia).
- **Session**: cookie HttpOnly + SameSite=Lax + Secure (production). 30 ngày sliding.
- **CSRF**: Next.js Server Actions có built-in protection (Origin check); route handler dùng same-origin.
- **Authorization**: middleware check role + warehouse access ở mọi route `(app)`. Helper `assertCanAccessWarehouse(user, warehouseId)`.
- **SQL injection**: Prisma parameterize sẵn — không raw queries từ user input.
- **Input validation**: zod schema ở mọi mutation entry point.
- **Rate limit**: simple in-memory limiter cho `/api/auth/login` (5 req / 5 phút / IP).
- **HTTPS**: Caddy reverse proxy + Let's Encrypt auto.
- **Backup**: cron mỗi 6h `cp data/app.db data/backups/app-{ISO}.db`, giữ 30 ngày.

## 8. Triển khai (Self-hosted)

### Minimal requirements
- Server: Ubuntu 22.04 LTS hoặc Windows Server 2022. RAM 2GB, disk 20GB.
- Node.js 20 LTS.
- Caddy 2.x.
- Mở port 80, 443.

### Steps
```bash
# 1. Copy code
git clone <repo> /opt/ql-kho-gcc && cd /opt/ql-kho-gcc

# 2. Install
npm ci
npx prisma migrate deploy
npm run build

# 3. .env (production)
DATABASE_URL="file:./data/app.db"
NODE_ENV=production
PORT=3000
SESSION_SECRET="<generate>"

# 4. PM2
npm i -g pm2
pm2 start npm --name ql-kho-gcc -- start
pm2 save && pm2 startup

# 5. Caddy
# /etc/caddy/Caddyfile:
# kho.example.com {
#   reverse_proxy localhost:3000
# }
sudo systemctl reload caddy

# 6. Backup cron
echo "0 */6 * * * cp /opt/ql-kho-gcc/data/app.db /opt/ql-kho-gcc/data/backups/app-$(date +\%Y\%m\%d-\%H).db && find /opt/ql-kho-gcc/data/backups/ -mtime +30 -delete" | crontab -
```

## 9. Quality gates

- **Type check**: `tsc --noEmit` pass.
- **Lint**: `eslint` (Next config) + `prettier` formatting.
- **Unit test**: Vitest cho `lib/domain/` (stock computation, receipt validation, idempotency).
- **E2E test**: Playwright golden paths — login, create inbound, create outbound (with stock conflict), create transfer (full lifecycle), report NXT, import Excel, offline → online sync.
- **Build**: `next build` pass without warnings.
- **a11y**: `axe-core` integration in Playwright tests for key screens.

## 10. Câu hỏi mở (carried forward to Implementation)

| ID | Câu hỏi | Resolution |
|---|---|---|
| AQ-1 | EC-04: clear cache với queue > 0 — implement IndexedDB quota warning? | Defer to Sprint 3, low risk |
| AQ-2 | EC-06: Safari iOS Background Sync fallback — push notification permission flow? | Sprint 3 if push toggled on |
| AQ-3 | EC-09: LWW granularity — cả phiếu (đã chọn whole-record version) đủ chưa? | Test trong E2E Sprint 2-3 |
| AQ-4 | Backup destination khi production — local disk đủ hay cần S3 / external? | User decide pre-deploy |
| AQ-5 | Initial admin account — seed hardcoded credentials hay CLI prompt khi setup? | Sprint 1 — CLI prompt safest |
| AQ-6 | Transfer timeout 7 ngày — ai nhận thông báo "đang chờ confirm"? | Email/notif Sprint 3 |

## 11. Non-goals (rõ ràng KHÔNG làm ở MVP)

- Microservices, container orchestration, K8s.
- Real-time websockets (polling đủ — tồn không thay đổi giây/giây).
- Mobile native app.
- Multi-tenant.
- API public cho 3rd-party.
- Caching layer (Redis) — SQLite + cache headers đủ.
- Internationalization (chỉ tiếng Việt).
- Theming nhiều brand color (chỉ 1 brand fixed).
