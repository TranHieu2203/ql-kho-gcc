# ql-kho-gcc — Phần mềm Quản lý Kho Lốp xe

Web app quản lý kho lốp xe đa kho, đa người dùng, offline-capable. Thay thế file Excel theo dõi nhập/xuất/tồn.

## ⚡ Quick start

```bash
# Install
npm install

# Initialize database
npx prisma migrate dev --name init

# Seed sample data (8 SKU + 2 kho + 2 user)
npm run db:seed

# Start dev server
npm run dev
# → http://localhost:3000

# Production build
npm run build
npm run start
```

**Tài khoản mẫu (sau khi seed)**:
- Admin: `admin` / `Admin@123`
- Thủ kho: `hung` / `Staff@123` (có quyền 2 kho HN + BN)

## 🛠️ Tech stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui (Radix primitives)
- Prisma ORM + SQLite (file: `data/app.db`)
- Lucia auth v3 (session cookie + bcrypt)
- ExcelJS (server-side Excel export)
- Zod validation, react-hook-form, lucide-react icons

## 📁 Cấu trúc thư mục

```
app/
├── (auth)/login/        ← đăng nhập
└── (app)/               ← khu vực sau đăng nhập (có shell)
    ├── tong-quan/       ← dashboard
    ├── danh-muc/        ← catalog SP
    ├── nhap-kho/        ← phiếu nhập
    ├── xuat-kho/        ← phiếu xuất
    ├── chuyen-kho/      ← phiếu chuyển (2-step model)
    ├── ton-kho/         ← bảng tồn realtime
    ├── bao-cao/nxt/     ← báo cáo NXT
    ├── quan-tri/        ← admin: kho, người dùng, audit, cấu hình
    └── ca-nhan/         ← profile + đổi mật khẩu
components/
├── ui/                  ← shadcn primitives
├── shell/               ← sidebar + topbar
└── forms/               ← receipt-form (dùng cho nhập/xuất/chuyển)
lib/
├── auth/                ← Lucia + password hash
├── db/                  ← prisma client
├── domain/              ← receipt business logic (computeStock, transfer)
└── utils.ts             ← format helpers
prisma/
├── schema.prisma
├── seed.ts              ← dev seed
└── migrations/
data/                    ← SQLite DB (gitignored)
scripts/seed-admin.ts    ← production admin setup (CLI prompt)
```

## ✅ Features đã có

### Sprint 1 — Nền tảng
- [x] Đăng nhập + session cookie (Lucia, bcrypt)
- [x] App shell: sidebar trái + top bar + warehouse switcher + dark mode toggle
- [x] Phân quyền: ADMIN vs WAREHOUSE_STAFF (gán theo kho)
- [x] Catalog sản phẩm: CRUD + active/inactive
- [x] Quản trị kho: CRUD + soft archive
- [x] Quản trị người dùng: CRUD + gán kho + đổi mật khẩu
- [x] Audit log viewer
- [x] Cấu hình hệ thống (chính sách xuất quá tồn: warn/block)
- [x] Đổi mật khẩu cá nhân
- [x] Rate limit login (5 lần / 5 phút / IP)

### Sprint 2 — Nghiệp vụ phiếu
- [x] Phiếu Nhập (form + list + detail) — idempotent qua clientRequestId
- [x] Phiếu Xuất (warn/block overstock policy)
- [x] Phiếu Chuyển kho 2-step (IN_TRANSIT → CONFIRMED)
- [x] Tồn kho realtime theo (warehouse, product), tính từ StockMovement
- [x] Stock indicator: ✓ Đủ tồn / ⚠ Sắp hết / ✕ Hết hàng (cấu hình ngưỡng/SKU)

### Sprint 3 — Báo cáo
- [x] Báo cáo NXT (Nhập-Xuất-Tồn) với filter kỳ + kho
- [x] Xuất Excel báo cáo NXT (format đẹp, font mono cho SKU)

### Sprint 4 — Mở rộng
- [x] **In phiếu PDF A4** — `@react-pdf/renderer` + embed font Roboto Vietnamese, header lặp, page-break-inside avoid, footer trang X/Y, chữ ký 2 bên. `GET /api/receipts/[id]/pdf`
- [x] **Mobile bottom-nav** — 5 mục chính + bottom sheet "Thêm"
- [x] **Delete cascade UI** — dialog xác nhận gõ mã phiếu; check cascade cho INBOUND; chỉ admin override khi có cascade
- [x] **Backdate validation** — phiếu xuất ngày quá khứ: server simulate tồn timeline, nếu sẽ âm → cảnh báo cụ thể, chỉ admin override
- [x] **Import Excel wizard 3-step** — đọc 4 sheet, validate per-row, tải file lỗi, dedupe idempotent
- [x] **PWA basics** — manifest + service worker (network-first HTML, cache-first static, SWR API, /offline fallback)
- [x] **SKU detail page** — tồn theo từng kho + 200 movement gần nhất với link đến phiếu gốc

### Sprint 6 — Security hardening (audit-driven)
Khắc phục 11 lỗ hổng từ security audit. Severity progression: **5 vulns (3 mod, 1 high, 1 critical) → 4 vulns (3 mod, 1 high DoS-only)**.

- [x] **C1 — Next.js 14.2.13 → 14.2.35** — patch CVE-2025-29927 (authorization bypass via `x-middleware-subrequest`) + 14+ other CVEs
- [x] **H1 — PDF route check warehouse permission** — `assertCanAccessWarehouse` cho cả INBOUND/OUTBOUND + TRANSFER (cho phép nếu có quyền ≥1 trong 2 kho). Filename Content-Disposition sanitize chống CRLF injection
- [x] **H2 — Move xlsx parsing server-side** (exceljs), bỏ `xlsx` (SheetJS) khỏi client → eliminate prototype pollution + ReDoS CVE. File error report đổi từ .xlsx → .csv (UTF-8 BOM cho Excel VN)
- [x] **H3 — Rate limit theo IP** (30 attempts / 10 phút) song song với username (5 / 5 phút) → block credential stuffing đa-username từ 1 IP
- [x] **H4 — Audit log fill ipAddress + userAgent** ở mọi action qua helper `audit()` + module [`lib/security/audit.ts`](app-code/lib/security/audit.ts) + [`lib/security/request-meta.ts`](app-code/lib/security/request-meta.ts)
- [x] **M1 — Self-host PDF font** (`public/fonts/roboto-vi-{400,700}.woff` — 47KB) — bỏ jsdelivr CDN runtime fetch
- [x] **M2 — `rows.max(10_000)`** cho import payload + `MAX_UPLOAD_BYTES = 8MB` cho upload file
- [x] **M3 — Service worker BỎ cache `/api/*`** — tránh cross-user data leak trên shared device (SW version bump v1→v2)
- [x] **M4 — Security headers** trong `next.config.mjs`: X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin, Permissions-Policy lock down camera/mic/geo/payment, X-DNS-Prefetch-Control off, Cache-Control no-store cho /api
- [x] **M5 — Password complexity rule** — min 8 ký tự + phải có ≥1 chữ + ≥1 số (áp dụng cho `change-password` + `createUser` + `updateUser`)
- [x] **M6 — PDF filename sanitize** — `replace(/[^A-Za-z0-9._-]/g, '_')` + length cap 64 ký tự
- [x] Cleanup audit log helper — tự stringify object + giới hạn 8KB tránh log bloat

**Audit logging coverage**: login, login_fail, login_blocked, logout, create/update/delete/activate/deactivate cho mọi entity (User, Warehouse, Product, Receipt, Setting, BulkImport, confirm_arrival). Mỗi entry tự động gắn IP + UserAgent.

**Vulns còn lại sau Sprint 6** (chấp nhận được cho self-host LAN):
- `next 14.2.35` high — DoS issues (Image Optimizer disk cache, RSC DoS, cache poisoning). Fix yêu cầu Next 15 (breaking change). Internal LAN không phải vector attack thực tế.
- `postcss <8.5.10` moderate — build-time only, không runtime risk
- `uuid <11.1.1` moderate via exceljs (uuid v3/5/6 only, exceljs dùng v8+ → not affected)

### Sprint 5 — Template Excel & Import điều chuyển
- [x] **Template Excel download** — `GET /api/import/template.xlsx` sinh file 5 sheet (HƯỚNG DẪN + DANH MỤC + NHẬP KHO + XUẤT KHO + CHUYỂN KHO). Header có style (bg primary-soft + font primary), 2 dòng ví dụ + 1 dòng ghi chú trong mỗi sheet, **mã kho hợp lệ embed sẵn** lấy động từ DB
- [x] **Import wizard hỗ trợ CHUYỂN KHO** — parse sheet CHUYỂN KHO 7 cột (NGÀY / MÃ HÀNG / TỪ KHO / ĐẾN KHO / ĐVT / SỐ LƯỢNG / GHI CHÚ); validate mã kho tồn tại + from≠to + tồn dương
- [x] **Server import xử lý TRANSFER** — nhóm theo (date + from + to) → 1 phiếu chuyển status CONFIRMED, tạo 2 movement (-từ kho, +đến kho), idempotent qua `clientRequestId="IMPORT:TRANSFER:{date}:{fromId}:{toId}"`
- [x] **UI link tải template** ở bước 1 wizard (banner info với mô tả 4 sheet)
- [x] **Outbound import** thêm cột Khách hàng → gom theo (date + customer) → lưu vào `customerOrPartner` thay vì ghi chú free-text

### Accessibility & UX
- [x] WCAG 2.1 AA contrast (text muted #6B7280 đạt 4.6:1)
- [x] Badge dùng pattern soft+strong (không text trắng trên warning/success)
- [x] Touch target ≥ 44px trên mobile
- [x] Focus ring 2px primary cho mọi interactive element
- [x] `aria-live="polite"` cho sync badge, role="alert" cho lỗi
- [x] Reduced motion support (`prefers-reduced-motion: reduce`)
- [x] Dark mode (toggle + persist localStorage)
- [x] Vietnamese throughout (date dd/mm/yyyy, number 1.234)
- [x] Font Be Vietnam Pro qua next/font (render dấu chuẩn)

## 🚧 Chưa làm (out of MVP-this-session)

- [ ] **Full offline sync queue** (Dexie + Background Sync API) — service worker đã có basic caching (network-first HTML / cache-first static / SWR API), queue cho mutation offline cần thêm
- [ ] **Transfer auto-rollback cron** 7 ngày — cần process cron riêng (node-cron hoặc OS cron + endpoint)
- [ ] **E2E tests (Playwright)** — chỉ có smoke test thủ công qua curl
- [ ] **PWA icons** (192/512/maskable PNG) — manifest có reference, file PNG chưa tạo (browser dùng favicon mặc định)

Tất cả các phần này đã có spec rõ trong `_bmad-output/planning-artifacts/architecture/ARCHITECTURE.md` và `_bmad-output/planning-artifacts/ux-designs/.../EXPERIENCE.md`. Các sprint sau cứ theo đó mà code.

## 🔒 Bảo mật (sau Sprint 6 hardening)

**Authentication & Session**
- Password hash: bcryptjs 10 rounds + complexity rule (min 8, ≥1 chữ, ≥1 số)
- Session: Lucia opaque tokens stored DB → revocable, HttpOnly + SameSite=Lax + Secure (prod)
- Rate limit login: 5/5min per-username + 30/10min per-IP

**Authorization**
- Page level: `redirect('/tong-quan')` nếu thiếu role
- Server actions: `requireUser()`/`requireAdmin()` + `assertCanAccessWarehouse()` cho mọi mutation theo kho
- API routes: full warehouse permission check cho PDF, Excel report (trừ template — public-to-authenticated)
- TRANSFER PDF: cho phép nếu user có quyền ≥1 trong 2 kho (from hoặc to)

**Injection / XSS / CSRF**
- SQL injection: Prisma parameterized — zero `$queryRaw`/`$executeRaw`
- DOM XSS: zero `dangerouslySetInnerHTML`
- CSRF: Next.js Server Actions auto-protected (Origin/Host check + Next-Action header)
- File upload: server-side parse (exceljs), 8MB cap, 10K rows cap, .xlsx extension check

**Security headers**
- X-Frame-Options: DENY (chống clickjacking)
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera/mic/geo/payment OFF
- Cache-Control no-store cho /api (tránh proxy cache lộ data)
- HSTS sẵn template trong `next.config.mjs` (uncomment khi deploy HTTPS)

**Audit logging**
- Mọi action security-sensitive log: who/what/when + ipAddress + userAgent
- Login: success/fail/blocked đều ghi (forensics)
- Tự động qua helper `lib/security/audit.ts`

**PWA / Service worker**
- Same-origin only, never cache mutation
- `/api/*` excluded khỏi cache (tránh cross-user data leak)
- Network-first HTML, cache-first static assets
- DEV mode KHÔNG register SW (tránh stale cache khi dev)

**Defense in depth**
- PDF font self-hosted (không CDN runtime fetch — chống MITM)
- Content-Disposition filename sanitize (chống CRLF injection)
- Soft-delete cho warehouse/admin có lịch sử
- Cascade check cho xoá phiếu nhập (chỉ admin override)

## 🚀 Deploy production

**Khuyến nghị: Docker + Caddy (auto HTTPS)** — xem hướng dẫn đầy đủ tại [`../DEPLOY.md`](../DEPLOY.md).

Tóm tắt nhanh:
```bash
# Trên server đã cài Docker
git clone <repo> /opt/ql-kho-gcc
cd /opt/ql-kho-gcc
cp .env.example .env
nano .env  # điền DOMAIN, ACME_EMAIL, ADMIN_INITIAL_PASSWORD
docker compose up -d --build
# Sau ~3-6 phút lần đầu: https://your-domain.com đã sẵn sàng + cert Let's Encrypt
```

Container build verified locally: image **322MB**, healthy sau ~10s, bootstrap admin tự động, security headers đầy đủ.

### Deploy thủ công (không Docker)
<details>
<summary>Hướng dẫn cũ với PM2 + Caddy host</summary>

```bash
# Trên server (Ubuntu 22.04 / Windows Server)
git clone <repo> /opt/ql-kho-gcc
cd /opt/ql-kho-gcc/app-code

npm ci
npx prisma migrate deploy

# Tạo admin lần đầu
ADMIN_INITIAL_PASSWORD='YourStrongPass123' node prisma/bootstrap-admin.js

npm run build

# PM2
npm i -g pm2
pm2 start npm --name ql-kho-gcc -- start
pm2 save
pm2 startup

# Caddy reverse proxy
# /etc/caddy/Caddyfile:
# kho.example.com {
#   reverse_proxy localhost:3000
# }
```
</details>

**Backup**: SQLite chỉ là 1 file. Cron mỗi 6h:
```cron
0 */6 * * * cp /opt/ql-kho-gcc/app-code/data/app.db /opt/ql-kho-gcc/app-code/data/backups/app-$(date +\%Y\%m\%d-\%H).db
```

## 📚 Tài liệu thiết kế đầy đủ

- **Brief**: `../_bmad-output/planning-artifacts/briefs/brief-ql-kho-gcc-2026-05-31/`
- **UX (DESIGN + EXPERIENCE)**: `../_bmad-output/planning-artifacts/ux-designs/ux-ql-kho-gcc-2026-05-31/`
- **Architecture**: `../_bmad-output/planning-artifacts/architecture/ARCHITECTURE.md`
- **Epics & Stories**: `../_bmad-output/planning-artifacts/epics/EPICS.md`
- **Sprint Plan**: `../_bmad-output/implementation-artifacts/sprint/SPRINT-PLAN.md`

## 📝 License

Internal use.
