---
title: "Epics & Stories — ql-kho-gcc"
status: final
created: 2026-05-31
language: vi
---

# Epics & Stories

## Tổng quan

7 epics chia thành 3 sprint. Mỗi story có ID, title, acceptance criteria ngắn gọn. Chi tiết technical implementation ở `_bmad-output/implementation-artifacts/stories/`.

| Epic | Tên | Stories | Sprint |
|---|---|---|---|
| E1 | Nền tảng & Hệ thống | S1.1 – S1.5 | 1 |
| E2 | Xác thực & Phân quyền | S2.1 – S2.4 | 1 |
| E3 | Danh mục Sản phẩm & Kho | S3.1 – S3.5 | 1 |
| E4 | Phiếu Nhập/Xuất + Tồn kho | S4.1 – S4.6 | 2 |
| E5 | Phiếu Chuyển kho (2-step) | S5.1 – S5.3 | 2 |
| E6 | Báo cáo, PDF, Excel I/O | S6.1 – S6.4 | 3 |
| E7 | Offline / PWA / Sync | S7.1 – S7.5 | 3 |
| E8 | Sprint 5 — Template Excel & Import phiếu chuyển kho | S8.1 – S8.4 | 5 |
| E9 | Sprint 6 — Security hardening (audit-driven) | S9.1 – S9.11 | 6 |

---

## Epic E1 — Nền tảng & Hệ thống

**Mục tiêu**: Có codebase chạy được, theme + shell + database schema sẵn sàng cho các epic sau bind vào.

- **S1.1 — Scaffold Next.js + TypeScript + Tailwind**
  AC: `npm run dev` chạy được, hiển thị trang trống có metadata Tiếng Việt. `tsc --noEmit` pass.

- **S1.2 — Cài shadcn/ui + Tailwind config DESIGN tokens**
  AC: Tokens từ DESIGN.md (colors, typography, spacing, rounded) map vào `tailwind.config.ts` + CSS variables. Dark mode toggle (class-based) hoạt động. Font Be Vietnam Pro load qua `next/font/local`.

- **S1.3 — Khởi tạo Prisma + SQLite + Schema initial**
  AC: `prisma/schema.prisma` chứa toàn bộ model trong ARCHITECTURE §4. `npx prisma migrate dev --name init` tạo DB thành công. Có seed script tạo 2 warehouse + 8 SKU mẫu (từ Excel).

- **S1.4 — App Shell: Sidebar + Topbar + Bottom-nav responsive**
  AC: Layout `(app)/layout.tsx` render đầy đủ sidebar trái (desktop), drawer (mobile), top bar (warehouse switcher + sync badge + user menu), bottom-nav 5 mục (mobile). Match DESIGN spec.

- **S1.5 — Trang lỗi 404 / 500 + Loading skeleton**
  AC: `app/not-found.tsx`, `app/error.tsx`, `app/loading.tsx` style theo DESIGN, có CTA quay về trang chủ.

---

## Epic E2 — Xác thực & Phân quyền

**Mục tiêu**: Có thể đăng nhập, session bền vững, phân quyền theo role + theo kho.

- **S2.1 — Cài Lucia + tạo bảng Session + middleware**
  AC: `lib/auth/` chứa Lucia adapter Prisma + session helpers. Middleware redirect `(app)/*` về `/login` nếu chưa auth.

- **S2.2 — Trang `/login` + form đăng nhập + rate limit**
  AC: Form đăng nhập với react-hook-form + zod. Hash argon2id. Sai 5 lần / 5 phút / IP → block. Offline → banner "Không có mạng — không thể đăng nhập lần đầu".

- **S2.3 — CLI seed initial admin (prompt mật khẩu)**
  AC: `npm run seed:admin` prompt username + password, hash + insert. Nếu đã có admin → từ chối tạo.

- **S2.4 — Trang Quản trị Users: CRUD + gán Warehouse + đổi mật khẩu**
  AC: `/quan-tri/nguoi-dung` table + form. Admin gán user vào warehouses qua multi-select. User-self đổi mật khẩu ở `/ca-nhan`. Block xoá admin cuối cùng.

---

## Epic E3 — Danh mục Sản phẩm & Kho

**Mục tiêu**: Quản trị data master để các phiếu có chỗ tham chiếu.

- **S3.1 — Trang `/danh-muc` table list sản phẩm**
  AC: TanStack Table với sort/filter/paginate. Search theo SKU/brand. Cột: SKU, Tên, Brand, Size, Pattern, ĐVT, Trạng thái, Tồn tổng. Mỗi row có kebab Sửa/Vô hiệu hoá.

- **S3.2 — Form Tạo/Sửa sản phẩm**
  AC: Modal/page với react-hook-form + zod validation. Unique SKU. Trường: SKU, Tên đầy đủ, Brand, Size, Pattern, ĐVT default, Ngưỡng tồn thấp.

- **S3.3 — Trang Quản trị Kho: CRUD warehouses**
  AC: `/quan-tri/kho` table + form. Code unique. Xoá hard chỉ khi không có movement; có movement → chỉ archive (active=false).

- **S3.4 — Warehouse Switcher (top bar)**
  AC: Dropdown ở top bar list các kho user có quyền + option "Tất cả". Selection persist localStorage. Filter toàn app theo selection.

- **S3.5 — Audit Log Viewer (admin only)**
  AC: `/quan-tri/audit-log` table read-only, filter theo entityType/user/date range.

---

## Epic E4 — Phiếu Nhập/Xuất + Tồn kho

**Mục tiêu**: Lõi nghiệp vụ — tạo phiếu, tồn tính đúng, race-safe.

- **S4.1 — Trang `/nhap-kho` list + tạo Phiếu Nhập**
  AC: Form tạo theo EXPERIENCE.md Form pattern. Server action POST `/api/receipts` với type=INBOUND. Tạo Receipt + ReceiptLines + StockMovements trong 1 transaction. Idempotent qua `clientRequestId`. Mã `IN-{YYYY}-{0001}`.

- **S4.2 — Trang `/xuat-kho` list + tạo Phiếu Xuất + chính sách quá tồn**
  AC: Form tương tự nhập. Setting `out_overstock_policy = "warn"|"block"`. Race-safe: server check-and-decrement trong transaction; conflict → 409 + UI dialog "Tồn đã thay đổi".

- **S4.3 — Trang `/ton-kho` bảng tồn realtime**
  AC: Server query: cho mỗi (warehouse, product), `SUM(qtyDelta)` từ StockMovement. Filter theo brand/size/pattern. Stock indicator badge soft+strong+icon theo ngưỡng.

- **S4.4 — Chi tiết SKU `/ton-kho/[sku]` + lịch sử movement**
  AC: Hiển thị tồn hiện tại từng kho + bảng movement chronological. Link tới phiếu gốc.

- **S4.5 — Xem chi tiết phiếu `/{type}/[id]` + xoá có cascade check**
  AC: Page xem chi tiết. Nút Xoá: nếu là INBOUND có OUTBOUND sau đó → block hard, chỉ admin override với dialog cảnh báo. OUTBOUND xoá → bù movement +qty.

- **S4.6 — Backdate validation + qty rules**
  AC: Form save: nếu date < hôm nay → simulate tồn timeline; nếu sẽ âm ở thời điểm nào → cảnh báo cụ thể. Qty integer >0, ≤9999, >500 cảnh báo confirm.

---

## Epic E5 — Phiếu Chuyển kho (2-step model)

- **S5.1 — Tạo Phiếu Chuyển (status = IN_TRANSIT)**
  AC: Form `/chuyen-kho/tao`: chọn from + to (khác nhau, user có quyền cả 2 — nếu không có quyền to → option disable). Lưu → status IN_TRANSIT, tạo StockMovement âm cho from-warehouse. Mã `TR-{YYYY}-{0001}`.

- **S5.2 — Xác nhận nhận hàng (to-warehouse)**
  AC: Trên `/chuyen-kho/[id]`, nếu user có quyền to-warehouse và status=IN_TRANSIT → nút "Xác nhận đã nhận". Click → tạo StockMovement dương cho to-warehouse, status → CONFIRMED. Audit log.

- **S5.3 — Timeout 7 ngày auto-rollback + notify admin**
  AC: Background job (cron node-cron) chạy hàng ngày: IN_TRANSIT > 7 ngày → tạo movement bù `+qty` cho from-warehouse, status → CANCELLED, ghi audit "auto_rollback".

---

## Epic E6 — Báo cáo, PDF, Excel I/O

- **S6.1 — Báo cáo NXT `/bao-cao/nxt`**
  AC: Filter kỳ + kho + sản phẩm. Bảng giống sheet NXT cũ với cột TT/SKU/Brand/Size/Pattern/Nhập/Xuất/Tồn cuối kỳ. Row "Tổng cộng" trên cùng. Export Excel button tải `bao-cao-nxt-{kỳ}-{kho}.xlsx` (dùng exceljs giữ format đẹp).

- **S6.2 — In Phiếu PDF (Inbound/Outbound/Transfer)**
  AC: `GET /api/receipts/:id/pdf` server-render dùng `@react-pdf/renderer`. A4 portrait, font Be Vietnam Pro embed. Header lặp mỗi trang. Page-break-inside avoid. Footer trang X/Y + chỗ ký 2 bên.

- **S6.3 — Import Excel lịch sử (3 step wizard)**
  AC: `/danh-muc/import` upload → preview → validate → confirm. Hiển thị {N} hợp lệ + {M} lỗi với chi tiết row. Button tải `loi-import.xlsx`. Idempotent (row-hash dedupe). Policy: bỏ qua lỗi / huỷ toàn bộ. Phiếu lịch sử dedupe `mã+ngày+kho`.

- **S6.4 — Tồn khởi đầu (Adjustment Receipt)**
  AC: Sau import, admin có nút "Tạo phiếu khởi tạo tồn" tại `/quan-tri/cau-hinh`. Form gõ tay điều chỉnh từng (warehouse, product) → tạo Receipt type=ADJUSTMENT + StockMovement, ghi audit `source = "INITIAL_IMPORT"` hoặc `"ADJUSTMENT"`.

---

## Epic E7 — Offline / PWA / Sync

- **S7.1 — Cài Serwist + Manifest + Icons + Install prompt**
  AC: PWA cài được trên Chrome/Safari. Manifest có icon 192/384/512, theme color brand, standalone display.

- **S7.2 — Dexie IndexedDB + cache strategy**
  AC: `lib/offline/dexie.ts` schema theo ARCHITECTURE §6. SW cache strategies: NetworkFirst HTML, CacheFirst static, SWR API GET. POST không cache.

- **S7.3 — Mutation Queue + Sync Orchestration**
  AC: Mọi mutation flow qua `lib/offline/queue.ts`. Online → POST trực tiếp, fail → enqueue. Offline → enqueue ngay. Flush trên `online` event + visibility change + foreground polling. Retry exponential backoff.

- **S7.4 — Sync Badge + Offline Banner + Queue Drawer**
  AC: Top bar badge: ✓/↻/⚠/⊘ tuỳ state với ARIA live region. Banner offline sticky. Drawer queue list với retry/edit/delete per item.

- **S7.5 — Autosave Drafts + Re-login Form Preservation**
  AC: Form receipt autosave Dexie `drafts` mỗi 10s. Mở lại form → banner "Nháp lưc 14:23 [Khôi phục]". Token expire detect 401 → modal đăng nhập lại, sau re-login restore form.

---

---

## Epic E8 — Template Excel & Import phiếu chuyển kho (Sprint 5)

**Mục tiêu**: Người dùng có template Excel chuẩn để tự nhập dữ liệu, không phải đoán cấu trúc. Mở rộng import wizard hỗ trợ phiếu chuyển kho.

- **S8.1 — Template Excel download** (`GET /api/import/template.xlsx`)
  AC: File `.xlsx` 5 sheet (HƯỚNG DẪN + DANH MỤC + NHẬP KHO + XUẤT KHO + CHUYỂN KHO). Mỗi sheet header style chuẩn (bg primary-soft, font primary, viền), 2 dòng ví dụ, 1 dòng note hướng dẫn cuối. Sheet HƯỚNG DẪN tóm tắt cách điền + chính sách dedupe + mã kho có sẵn (lấy từ DB).

- **S8.2 — Import wizard hỗ trợ sheet CHUYỂN KHO**
  AC: Client parse thêm sheet `CHUYỂN KHO` với 7 cột (NGÀY, MÃ HÀNG, TỪ KHO, ĐẾN KHO, ĐVT, SỐ LƯỢNG, GHI CHÚ). Validate: mã kho phải tồn tại, from≠to, qty>0. Step 3 hiển thị thêm card "Chuyển kho" count.

- **S8.3 — Server action `importData` xử lý TRANSFER**
  AC: Nhóm theo (date + from + to) → 1 phiếu chuyển per group, status=CONFIRMED (lịch sử đã hoàn tất), tạo 2 movement (-qty kho nguồn + +qty kho đích) cùng `occurredAt`. Idempotent qua `clientRequestId = "IMPORT:TRANSFER:{date}:{fromId}:{toId}"`. Outbound thêm group theo customer + lưu vào `customerOrPartner`.

- **S8.4 — UI link tải template trong wizard bước 1**
  AC: Bước 1 hiện banner info với nút "Tải template (ql-kho-template.xlsx)". Mô tả 4 sheet và quy tắc XÓA dòng ví dụ trước khi điền.

---

---

## Epic E9 — Security hardening (Sprint 6, audit-driven)

**Mục tiêu**: Khắc phục toàn bộ findings từ security audit (1 CRITICAL, 4 HIGH, 6 MEDIUM/LOW). Giảm vuln count từ 5 (3 mod + 1 high + 1 critical) xuống 4 (3 mod + 1 high DoS-only).

- **S9.1 — Upgrade Next.js** 14.2.13 → 14.2.35 (patch CVE-2025-29927 + 14 CVE khác). AC: build pass + npm audit không còn critical.

- **S9.2 — PDF route warehouse permission check**. AC: `GET /api/receipts/[id]/pdf` enforce `assertCanAccessWarehouse` cho INBOUND/OUTBOUND; với TRANSFER cho phép nếu có quyền ≥1 trong 2 kho. Filename Content-Disposition sanitize (chỉ A-Za-z0-9._-, max 64).

- **S9.3 — Move xlsx parsing server-side** (eliminate SheetJS CVE). AC: New action `parseImportFile(formData)` dùng exceljs đọc file, validate per-row, return ValidatedRow[]. Client wizard không còn `import * as XLSX from 'xlsx'`. File error report đổi sang CSV (UTF-8 BOM).

- **S9.4 — IP-based rate limit** song song username. AC: Module `lib/security/rate-limit.ts` quản 2 bucket (5/5min user, 30/10min IP). Login action gọi `checkLoginRateLimit` trước khi check password. `getRequestMeta()` lấy IP từ `x-forwarded-for` → `x-real-ip` → `cf-connecting-ip`.

- **S9.5 — Audit log fill ipAddress + userAgent**. AC: Helper `audit(input)` trong `lib/security/audit.ts` auto-stringify object before/after (cap 8KB), gọi `getRequestMeta()` mỗi lần. Refactor mọi `prisma.auditLog.create` sang `audit(...)` ở 10 file actions.

- **S9.6 — Self-host PDF font**. AC: `public/fonts/roboto-vi-{400,700}.woff` (~47KB tổng). `receipt-pdf.tsx` đọc filesystem path qua `process.cwd()`. Bỏ jsdelivr CDN URL hoàn toàn.

- **S9.7 — Import rows cap**. AC: `z.array(...).max(10_000)` ở `importData`. Server-side parser từ chối file >8MB (`MAX_UPLOAD_BYTES`).

- **S9.8 — SW không cache `/api/*`**. AC: Service worker `v2` — fetch handler return ngay với `/api/*` (browser fetch network bình thường, không SW intercept). Tránh user A thấy data cached của user B trên shared device.

- **S9.9 — Security headers**. AC: `next.config.mjs` `headers()` trả về cho mọi route: X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy lock camera/mic/geo/payment, X-DNS-Prefetch-Control off. Riêng `/api/*` thêm Cache-Control no-store.

- **S9.10 — Password complexity**. AC: Schema `passwordSchema = z.string().min(8).refine(/[A-Za-z]/).refine(/\d/)`. Áp dụng ở `change-password` (ca-nhan/actions.ts) + `createUser` + `updateUser` (quan-tri/nguoi-dung/actions.ts).

- **S9.11 — Cleanup**: bỏ `xlsx` khỏi package.json. Verify `npm audit` final report.

---

## Story files

Mỗi story sẽ có file riêng `_bmad-output/implementation-artifacts/stories/SX.Y-{slug}.md` với:
- Context (link Epic + EXPERIENCE.md surface tham chiếu)
- AC chi tiết
- Files to create/edit
- Tests required
- Dependencies (story IDs cần xong trước)

Trong session này tôi sẽ inline code thẳng từ checklist trên thay vì tạo từng story file riêng, để tiết kiệm context. Stories đầy đủ có thể được sinh ra ở phase sau nếu cần.
