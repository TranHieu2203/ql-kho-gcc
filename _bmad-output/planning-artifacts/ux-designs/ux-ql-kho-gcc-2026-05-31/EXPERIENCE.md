---
title: "EXPERIENCE — Phần mềm Quản lý Kho Lốp xe (ql-kho-gcc)"
status: final
created: 2026-05-31
updated: 2026-05-31
owner: HieuTV-QL-Kho
language: vi
sources:
  - "_bmad-output/planning-artifacts/briefs/brief-ql-kho-gcc-2026-05-31/brief.md"
  - "_bmad-output/planning-artifacts/briefs/brief-ql-kho-gcc-2026-05-31/addendum.md"
design-ref: "./DESIGN.md"
form-factor: web-responsive-pwa
ui-system: none-bound  # Architecture phase sẽ chọn (shadcn/ui, MUI, hoặc custom)
---

# EXPERIENCE.md — Information architecture, behavior, flows

## Foundation

**Form-factor**: Web responsive + PWA offline-capable. Một codebase, ba breakpoint:
- **Desktop** ≥ 1024px — sidebar trái cố định, bảng nhiều cột, hover state đầy đủ.
- **Tablet** 768-1023px — sidebar collapse thành icon, bảng vẫn full nhưng có horizontal scroll cho cột phụ.
- **Mobile** < 768px — sidebar ẩn (drawer trượt từ trái), bottom-nav 5 mục, bảng auto-collapse cột phụ.

**UI system**: chưa bind. Visual identity ở [`DESIGN.md`](./DESIGN.md). Architecture phase sẽ quyết chọn shadcn/ui (Tailwind), MUI, hoặc custom — DESIGN.md đủ trung lập để map vào cả ba.

**Offline-first** là contract cốt lõi của sản phẩm, không phải tính năng "nếu có thời gian". Xem mục [Offline & Sync Behavior](#offline--sync-behavior).

**Ngôn ngữ**: chỉ Tiếng Việt ở MVP. Toàn bộ microcopy, error message, date format (`dd/MM/yyyy`), number format (`1.234,56` — dấu chấm hàng nghìn, phẩy thập phân) theo chuẩn VN.

## Information Architecture

### Sitemap (level 1-2)

```
/login                                    ← auth (chưa login)
/                                         ← Tổng quan (Dashboard) [landing]
/danh-muc                                 ← Danh mục sản phẩm
  /danh-muc/them                          ← Thêm sản phẩm
  /danh-muc/{id}                          ← Xem/sửa sản phẩm
  /danh-muc/import                        ← Import từ Excel
/nhap-kho                                 ← Phiếu Nhập (list)
  /nhap-kho/tao                           ← Tạo phiếu nhập
  /nhap-kho/{id}                          ← Xem/sửa/in phiếu
/xuat-kho                                 ← Phiếu Xuất (list)
  /xuat-kho/tao                           ← Tạo phiếu xuất
  /xuat-kho/{id}                          ← Xem/sửa/in phiếu
/chuyen-kho                               ← Phiếu Chuyển kho (list)
  /chuyen-kho/tao                         ← Tạo phiếu chuyển
  /chuyen-kho/{id}                        ← Xem/sửa/in phiếu
/ton-kho                                  ← Tồn kho hiện tại (theo SKU)
  /ton-kho/{sku}                          ← Chi tiết 1 SKU + lịch sử movement
/bao-cao                                  ← Báo cáo
  /bao-cao/nxt                            ← Báo cáo Nhập-Xuất-Tồn (giống sheet NXT)
/quan-tri                                 ← Admin only
  /quan-tri/nguoi-dung                    ← User CRUD + gán kho
  /quan-tri/kho                           ← Warehouse CRUD
  /quan-tri/audit-log                     ← Audit log viewer
  /quan-tri/cau-hinh                      ← Settings (chính sách xuất quá tồn, ngưỡng tồn thấp)
/ca-nhan                                  ← Hồ sơ cá nhân
  /ca-nhan/doi-mat-khau
  /ca-nhan/giao-dien                      ← Dark mode toggle, density toggle
```

### Sidebar groups (desktop)

```
[ Tổng quan ]
─── HOẠT ĐỘNG ───
[ Phiếu Nhập ]
[ Phiếu Xuất ]
[ Phiếu Chuyển ]
─── DỮ LIỆU ───
[ Tồn kho ]
[ Danh mục SP ]
[ Báo cáo ]
─── HỆ THỐNG (admin only) ───
[ Quản trị ]
```

### Bottom nav (mobile, 5 mục max)

```
[Tổng quan] [Nhập] [+] [Xuất] [Tồn]
                    ↑
              "Tạo nhanh" FAB
              → bottom sheet: Tạo nhập / Tạo xuất / Tạo chuyển / Thêm SP
```

Các mục còn lại (Danh mục, Báo cáo, Chuyển kho, Quản trị) truy cập qua **drawer trái** (trượt từ cạnh hoặc bấm icon hamburger trong top bar).

### IA closure check

| Stated need (từ brief) | Surface phục vụ | Journey kết thúc tại đó |
|---|---|---|
| Quản lý SKU | `/danh-muc` | Hùng tạo SP mới, Anh Tuấn import từ Excel |
| Nhập kho | `/nhap-kho/tao` | Hùng tạo phiếu nhập sau khi nhận hàng |
| Xuất kho | `/xuat-kho/tao` | Hùng tạo phiếu xuất khi giao khách |
| Tồn realtime | `/` (dashboard) + `/ton-kho` | Hùng tra cứu khi khách hỏi điện thoại |
| Chuyển kho | `/chuyen-kho/tao` | Anh Tuấn chuyển 20 lốp HN → BN |
| Báo cáo NXT | `/bao-cao/nxt` | Anh Tuấn xuất Excel cuối tháng |
| In phiếu | `/{loại}/{id}` button "In PDF" | Hùng in phiếu xuất cho khách ký nhận |
| Import lịch sử Excel | `/danh-muc/import` (one-shot wizard) | Anh Tuấn nạp 2000 dòng cũ ngày đầu |
| Đa kho + phân quyền | warehouse switcher (top bar) + `/quan-tri/nguoi-dung` | Anh Tuấn gán Hùng vào kho HN |
| Audit log | `/quan-tri/audit-log` | Anh Tuấn xem ai sửa phiếu nào |

→ Mọi need có surface; mọi surface có ít nhất 1 journey land. **IA closed**.

## Voice and Tone

**Xưng hô**: dùng "anh/chị" mặc định cho microcopy hướng người dùng. Trong UI dữ liệu (label cột, button), dùng dạng trung tính tránh "bạn"/"anh chị".

**Nguyên tắc microcopy**:
- Câu ngắn, không jargon Anh-Việt lẫn lộn. "Phiếu nhập" không phải "Inbound receipt". "Đồng bộ" không phải "Sync".
- Hành động viết theo **động từ + danh từ** ngắn gọn: "Lưu phiếu", "Tạo sản phẩm", "Xoá", "Chuyển kho" — không "Lưu lại phiếu nhập này".
- Lỗi viết theo **chỗ sai + cách sửa**: ❌ "Lỗi xác thực" → ✅ "Ngày không được để trống. Hãy chọn ngày trên lịch."
- Empty state luôn có **CTA** chỉ rõ việc cần làm: "Chưa có phiếu nhập nào. **Tạo phiếu nhập đầu tiên** →"

**Bảng đối chiếu microcopy nhanh** (`[ASSUMPTION]` — sẽ tinh chỉnh khi PRD/Stories):

| Tình huống | Microcopy đề xuất |
|---|---|
| Lưu thành công | Toast: "Đã lưu phiếu nhập #IN-2026-0042" |
| Lưu thất bại (mạng OK) | Banner đỏ in form: "Không lưu được. Vui lòng thử lại hoặc liên hệ admin." |
| Đang offline khi nhập phiếu | Inline pill vàng dưới nút Lưu: "Sẽ đồng bộ khi có mạng" |
| Xuất quá tồn (mode cảnh báo) | Dialog: "Tồn hiện tại của GD639 là 5 Bộ. Bạn đang xuất 10. Tiếp tục?" [Huỷ] [Tiếp tục] |
| Xuất quá tồn (mode chặn) | Inline error: "Không đủ tồn. Còn 5 Bộ, cần 10. Hãy giảm số lượng hoặc nhập thêm trước." |
| Xoá phiếu nhập (cascade) | Dialog 2 mức: nếu phiếu nhập đã có phiếu xuất từ lô đó → hiện "Phiếu này đã được dùng cho {N} phiếu xuất sau đó. Xoá sẽ làm tồn các phiếu kia bất hợp lệ. Đề xuất: tạo phiếu điều chỉnh thay vì xoá. [Tạo phiếu điều chỉnh] [Xoá vĩnh viễn (cần xác nhận)]". Chỉ admin được Xoá vĩnh viễn. |
| Xoá phiếu thường | Dialog confirm: "Xoá phiếu xuất #OUT-2026-0042? Tồn kho sẽ được điều chỉnh tự động." |
| Xoá kho (warehouse) | BLOCK nếu còn tồn > 0 hoặc còn phiếu lịch sử. Dialog: "Kho này còn {N} SKU tồn + {M} phiếu lịch sử. Không thể xoá. [Vô hiệu hoá kho (ẩn khỏi list)]". Chỉ cho phép soft-delete (archive). |
| Xoá user admin cuối cùng | BLOCK: "Phải có ít nhất 1 admin khác trước khi xoá tài khoản này." |
| Lỗi import Excel | "12/2117 dòng có lỗi (xem chi tiết)". Không bắt user đoán lỗi gì. |

## Component Patterns

Visual specs ở [`DESIGN.md`](./DESIGN.md#components). Behavior dưới đây.

### Form (Tạo phiếu Nhập/Xuất/Chuyển)

- **Layout**: 1 cột trên mobile, 2 cột (header info + line items) trên desktop.
- **Header**: kho, ngày, ghi chú.
  - Ngày mặc định = hôm nay.
  - **Ngày tương lai**: cảnh báo nhưng cho phép (đặt trước).
  - **Backdate (ngày quá khứ)**: yêu cầu xác nhận; nếu tính toán cho thấy tồn kho ở thời điểm đó sẽ âm → cảnh báo cụ thể "Nếu backdate phiếu này về 12/05, tồn ngày 13/05 của GD639 sẽ âm 4 Bộ. Tiếp tục?" Chỉ admin mới được vượt cảnh báo này.
- **Line items**: bảng inline thêm-dòng. Mỗi dòng = chọn SP (autocomplete) + ĐVT + qty + ghi chú dòng.
- **Quy đổi ĐVT** (chốt MVP): 1 SKU chỉ 1 ĐVT cơ sở (lấy từ catalog). Không có quy đổi Bộ↔Chiếc ở MVP. Field ĐVT hiển thị nhưng readonly bằng default từ catalog (cho phép v2 mở rộng multi-ĐVT).
- **Validation**:
  - Realtime trên blur: trường lỗi → `aria-invalid="true"` + border `{colors.semantic.danger}` + helper text dưới (linked qua `aria-describedby`).
  - Qty rule: `integer > 0`, `≤ 9999`. Số decimal → reject. Số > 500 → cảnh báo confirm "Số lượng bất thường ({n}). Xác nhận?".
  - Submit thất bại → focus về field lỗi đầu tiên + announce tổng số lỗi qua live region.
- **Save**: button primary dưới cùng. Có "Lưu & tạo phiếu mới" (giảm friction nhập liên tục).
- **Autosave draft mỗi 10s**: lưu local (IndexedDB) cho hồi phục nếu đóng tab nhầm hoặc token expire. Khi mở lại form → có banner "Nháp đã lưu lúc 14:23 — [Khôi phục] [Bỏ]".
- **Mã phiếu**: server cấp mã chính thức (`IN-2026-0043`). Khi tạo offline, client sinh mã tạm `IN-DRAFT-{uuid8}`, sau khi sync server cấp mã chính thức + UI hiển thị cả 2 trong toast "Đã đồng bộ. Mã tạm `IN-DRAFT-a3f9` đã được lưu thành `IN-2026-0043`."

### Table (list phiếu, danh mục, tồn kho)

- **Sort**: click header để sort. Indicator mũi tên + `aria-sort="ascending|descending"`.
- **Filter**: thanh filter trên đầu table với chip filter (xoá từng cái dễ).
- **Search**: ô search dạng debounce 300ms.
- **Bulk action**: BỎ ở MVP (giảm complexity; có thể thêm v2).
- **Empty state**: thay table bằng panel empty (xem Empty state pattern).
- **Loading**: skeleton row (không spinner che full).
- **Pagination**: 20/page mặc định, dropdown 20/50/100. Tổng số ở dưới.
- **Row click**: mở chi tiết (modal hoặc page) — tuỳ context.
- **Mỗi row PHẢI có nút "..." (kebab) visible** ở cột cuối, `aria-label="Tuỳ chọn cho phiếu {mã}"`, mở menu Sửa/In/Xoá. Đây là fallback bàn phím/SR thay cho long-press mobile và swipe-delete. Không bao giờ ẩn action chỉ sau gesture.

### Modal vs Drawer vs Sheet

- **Modal** — form ngắn (1-5 trường), confirm action. Click backdrop hoặc Esc đóng.
- **Drawer (phải)** — form dài (tạo phiếu nhiều dòng) — desktop/tablet.
- **Sheet (đáy)** — tương đương drawer nhưng cho mobile (trượt từ đáy). FAB "Tạo nhanh" mở sheet.
- **Không lồng modal**. Nếu cần thêm context (vd chọn SP từ trong form phiếu), dùng search inline hoặc autocomplete — không mở popup chồng.

### Warehouse switcher (top bar)

- Dropdown ở top bar, mặc định hiển thị tên kho hiện tại (`Kho Hà Nội`).
- Người dùng có nhiều kho → chọn để filter toàn bộ app theo kho đó (sidebar + dashboard + danh sách phiếu).
- Có option **"Tất cả các kho"** cho Admin và báo cáo tổng hợp.
- Lưa chọn persist qua localStorage; khi đăng nhập mới → mặc định kho đầu tiên user được gán.

## State Patterns

| State | UI |
|---|---|
| **Loading initial** | Skeleton (placeholder xám pulse) cho card/table. Không full-page spinner. |
| **Loading inline** (sau click) | Button → spinner thay icon + disable. Không che màn hình. |
| **Empty (chưa có data)** | Icon line-art 64px + heading 18px + 1-2 dòng + CTA primary. VD: "Chưa có sản phẩm nào. Bắt đầu bằng cách thêm hoặc import từ Excel." |
| **Empty (filter không có kết quả)** | "Không tìm thấy phiếu phù hợp. [Xoá filter]" |
| **Error 4xx (validate sai)** | Inline form error. Không banner toàn page. |
| **Error 5xx (server lỗi)** | Banner đỏ trên cùng: "Lỗi máy chủ. Đang thử lại... ⓘ liên hệ admin nếu lặp lại." Auto retry với backoff. |
| **Error network (mất net)** | Banner vàng sticky: "Đang offline — phiếu sẽ đồng bộ khi có mạng." Không che dữ liệu cache. |
| **Success** | Toast top-right (desktop) / top-center (mobile), 4s auto dismiss. |
| **Confirmation destructive** | Dialog 2 nút (Huỷ secondary, Xoá danger). Yêu cầu gõ tên item nếu xoá Warehouse/User (`[ASSUMPTION]`). |
| **Optimistic update** | Phiếu lưu offline → hiển thị ngay với badge ⏳ "Chờ đồng bộ"; sync OK → badge biến mất; sync lỗi → badge ⚠ "Lỗi sync" + cho retry. |
| **In-flight uncertain** | Khi đang submit thì mất net giữa chừng (server đã nhận hay chưa không rõ) → badge ↻ "Đang xác nhận". Server dedupe qua `client_request_id` (UUID) — retry an toàn không tạo phiếu trùng. Sau retry: nếu thành công → badge biến mất; nếu fail thật → badge ⚠ "Lỗi". |
| **Conflict tồn (race)** | 2 user cùng xuất khi tồn = 8, mỗi người 5 — phiếu thứ 2 server reject với mã `STOCK_CONFLICT`. UI hiện dialog: "Trong lúc anh tạo phiếu, kho đã xuất bớt. Tồn còn 3 (trước đó 8). [Chỉnh số lượng] [Huỷ]". Form giữ nguyên data để chỉnh. |
| **Phiên hết hạn khi đang điền form** | Detect 401 lúc Save → modal "Phiên hết hạn. Đăng nhập lại để lưu phiếu — dữ liệu form sẽ được giữ nguyên." Form data preserve trong autosave draft, sau re-login restore. Proactive refresh token 5 phút trước expire. |

## Interaction Primitives

- **Click/tap**: hành động chính, hover state có (chỉ desktop).
- **Long-press** (mobile): mở context menu trên row table (sửa, in, xoá).
- **Swipe** (mobile): swipe-left trên row → action xoá nhanh. Tắt theo default (tránh xoá nhầm), bật trong Settings.
- **Pull-to-refresh** (mobile): trên list page, refresh sync.
- **Keyboard** (desktop, power user):
  - `Ctrl/Cmd + N` — tạo mới (theo context page: ở `/nhap-kho` → phiếu nhập mới)
  - `Ctrl/Cmd + S` — lưu form
  - `Esc` — đóng modal/drawer
  - `/` — focus search global
  - `?` — show keyboard shortcut help
  - Tab order tuân thủ thứ tự visual

## Accessibility Floor

- **WCAG 2.1 AA** mục tiêu, ưu tiên các check sau:
  - Tỉ lệ contrast text/bg ≥ 4.5:1 cho body, ≥ 3:1 cho large text — đã verify ở DESIGN.md sau khi fix muted color và badge pattern (semantic-soft + semantic-strong).
  - Touch target ≥ 44×44px trên mobile (token `{spacing.touch-min}`); density Compact đã bỏ khỏi MVP vì vi phạm 2.5.8.
  - Focus visible (ring 2px brand) cho mọi interactive element; row table có outline 2px primary inset khi focus.
  - Mọi icon-only button có `aria-label` tiếng Việt.
- **Keyboard navigation đầy đủ** — không có thao tác chỉ có thể làm bằng chuột. Mọi mobile gesture (swipe-delete, long-press context, pull-to-refresh) phải có fallback bàn phím/SR (xem `Interaction Primitives`).
- **Screen reader**:
  - Heading hierarchy: `h1` page title, `h2` section, `h2` cho mỗi Modal/Drawer/Sheet (với `role="dialog"` + `aria-labelledby` + `aria-modal="true"` + focus trap + return focus).
  - Landmark roles: `nav` (sidebar + bottom-nav), `main` (content), `aside` (drawer/queue panel), `header` (top bar), `footer` (form sticky footer).
  - **Live regions**: sync badge dùng `role="status"` + `aria-live="polite"` + `aria-atomic="true"`; offline banner dùng `role="alert"` (assertive) khi mới mất net; toast success → polite, toast lỗi → assertive. Spec announce: "Đang offline, 3 phiếu chờ đồng bộ".
  - **Form validation**: mọi input lỗi set `aria-invalid="true"` + `aria-describedby` trỏ tới helper text node (có `id` ổn định). Submit thất bại → focus về field lỗi đầu tiên + announce tổng số lỗi qua live region "Có 2 lỗi cần sửa".
- **Tiếng Việt có dấu**: font Be Vietnam Pro render dấu đúng. Test với "Ổn", "ĐVT", "Lốp", "Nhập", "Tổng quan" ở các size 11/12/13/14/22/28px trên DPI thấp (Android cũ).
- **Reduced motion** — tôn trọng `prefers-reduced-motion: reduce`:
  - Skeleton pulse → tĩnh (chỉ màu xám đậm hơn).
  - Spinner button → text "Đang tải..." (không xoay).
  - Slide drawer/sheet → fade-in (không trượt).
  - FAB sheet → fade.
  - Toast vẫn fade, không slide.
  - Bỏ FAB ripple, bỏ confetti success (nếu có).
- **Color blind safety**: KHÔNG dùng MÀU làm phương tiện duy nhất. Mọi state indicator (sync, stock, status) phải có **icon shape + text + (optional) color**. Sync: ✓/↻/⚠/⊘. Stock: ✓ "Đủ tồn" / ⚠ "Sắp hết" / ✕ "Hết hàng".
- **Keyboard shortcut help discoverable**: ngoài `?` mở help, user menu dropdown có mục "Phím tắt bàn phím" → mở cùng overlay (`role="dialog"` + focus trap).

## Offline & Sync Behavior

> Đây là section invented riêng cho sản phẩm — offline là contract niềm tin cốt lõi.

### Nguyên tắc

1. **Đọc luôn được**: dữ liệu user đã từng xem (danh mục, tồn cuối lần xem, lịch sử phiếu của họ) cache vào IndexedDB và luôn truy cập được dù mất net.
2. **Ghi vẫn được**: mọi thao tác Nhập/Xuất/Chuyển khi offline được lưu vào queue local + hiển thị với badge "Chờ đồng bộ".
3. **Sync minh bạch**: top bar luôn có badge sync status — user biết chính xác có bao nhiêu phiếu chưa lên server, có lỗi gì.
4. **Conflict = last-write-wins ở v1** (theo brief). UI báo rõ khi có conflict bị overwrite, kèm khả năng xem lịch sử nếu lo lắng.

### UI states

| State | Banner top | Sync badge top bar | Action |
|---|---|---|---|
| Online, mọi thứ OK | (none) | 🟢 "Đã đồng bộ" | — |
| Online, đang sync | (none) | 🔵 "Đang đồng bộ (3)" + spinner nhỏ | — |
| Offline, chưa có data chờ | 🟡 "Đang offline" | 🟡 "Offline" | — |
| Offline, có data chờ | 🟡 "Đang offline — 3 phiếu chờ đồng bộ" | 🟡 "Offline (3 chờ)" | Tap → xem danh sách queue |
| Sync lỗi 1 phiếu | 🔴 "1 phiếu không đồng bộ được" | 🔴 "Lỗi (1)" | Tap → xem chi tiết lỗi + retry/sửa/bỏ |
| Conflict overwrite | Toast info: "Phiếu IN-... đã cập nhật từ thiết bị khác. Đã ưu tiên thay đổi mới nhất." | — | Có link "Xem lịch sử" |

### Queue panel (drawer)

Khi tap sync badge → drawer phải hiện:
- List các phiếu đang trong queue, mỗi item: loại phiếu, mã (local id), thời gian tạo, trạng thái (Pending/Syncing/Failed).
- Failed item: nút [Thử lại] / [Sửa] / [Xoá khỏi queue].
- Footer: "Đồng bộ tất cả" + "Xoá queue" (confirm).

## Multi-warehouse Behavior

> Section invented — đa kho có quy tắc riêng cần làm rõ.

- **Selected warehouse là "ngữ cảnh app"**: chọn ở top bar → toàn bộ list phiếu, dashboard, tồn kho đều filter theo kho đó.
- **Option "Tất cả các kho"** chỉ visible cho user có quyền nhiều kho. Khi chọn:
  - Dashboard hiển thị tồn tổng + breakdown theo kho.
  - List phiếu thêm cột "Kho" hiển thị rõ.
  - Tạo phiếu mới: trường "Kho" bắt buộc chọn (không default).
  - **FAB mobile** "Tạo nhanh" khi ở mode "Tất cả": bottom sheet thêm step trước "Chọn kho để tạo phiếu" rồi mới mở form.
- **Phiếu Chuyển kho** đặc biệt:
  - Luôn hỏi from + to, hai kho phải khác nhau.
  - Dropdown "Đến kho" chỉ list các kho user có quyền. Nếu chuyển ra kho không có quyền → option disable kèm tooltip "Anh chưa có quyền kho này. Liên hệ admin để được cấp."
  - **Model 2-step** ở MVP (an toàn hơn 1-step): tạo phiếu → trạng thái "Đang đi" (tồn from giảm, tồn to CHƯA tăng). Khi to-warehouse "Xác nhận nhận" → trạng thái "Hoàn tất" (tồn to tăng). Có timeout 7 ngày: chưa confirm → auto-rollback + thông báo admin.
- **User bị remove khỏi kho khi đang có draft**: mở draft → readonly banner "Anh không còn quyền kho {tên kho}. Liên hệ admin để khôi phục, hoặc [Xoá nháp]".
- **Warehouse switcher persist** qua localStorage — quay lại session sau vẫn nhớ kho cuối.

## Key Flows

### Flow 1 — Hùng nhập 1 lô lốp mới (mobile, tại kho)

**Protagonist**: Hùng, thủ kho kho Hà Nội. Vừa nhận 30 lốp GASVIDO GD639 1100R20 từ xe NCC.

1. Hùng rút iPhone XR ra, mở Safari → app đã add-to-home-screen, mở dưới dạng PWA fullscreen.
2. App đã đăng nhập sẵn (token còn hạn). Landing: Dashboard, sync badge xanh — "Đã đồng bộ".
3. Hùng tap FAB **[+]** ở bottom-nav → bottom sheet hiện 4 lựa chọn → tap **"Tạo phiếu nhập"**.
4. Form mở fullscreen (sheet). Trường "Kho" auto-fill `Kho Hà Nội` (kho của Hùng), "Ngày" auto-fill hôm nay.
5. Hùng tap "+ Thêm sản phẩm" → autocomplete search → gõ "GD639" → list 1 kết quả "GD639 1100R20 18PR" → tap.
6. Dòng line item hiện: SP đã chọn, ĐVT default "Bộ" (lấy default từ catalog), qty trống.
7. Hùng gõ `30` vào qty. Validation OK (xanh).
8. Tap **"Lưu phiếu"** (button primary đáy). 
9. Loading 1s → toast top-center: "Đã lưu phiếu nhập #IN-2026-0043". Form đóng. Quay về Dashboard.
10. **★ CLIMAX**: Card "Tồn kho gần đây" trên Dashboard đã hiện GD639 1100R20 với tồn mới (cũ 9 → mới 39). Anh Tuấn ở văn phòng cũng thấy con số đó cập nhật realtime trên laptop. Không còn cảnh "đợi Hùng gửi file Excel cuối tuần".

### Flow 2 — Hùng tra cứu tồn cho khách qua điện thoại (offline)

**Protagonist**: Hùng. Đang đứng giữa kho, sóng 4G mất do tường thép. Khách Hải gọi: "Còn GD639 1200R20 không em? Anh lấy 20 cái."

1. Hùng vào app — banner vàng trên cùng: 🟡 "Đang offline". Không panic — biết là sẽ vẫn dùng được.
2. Tap "/" (mobile = icon search ở top bar) → ô search global mở.
3. Gõ "GD639 1200" → list cached hiện ngay: "GD639 1200R20 20PR — Tồn: 48 Bộ (Kho Hà Nội)".
4. **★ CLIMAX**: 3 giây sau khi khách hỏi, Hùng đã trả lời được: "Anh ơi còn 48 Bộ kho Hà Nội, em giữ 20 cho anh". Không phải bảo khách "đợi em ra ngoài kho cho có sóng".
5. Hùng tap vào item → chi tiết SP, lịch sử movement (cached) — bấm "Xuất kho" để tạo phiếu xuất ngay (sẽ vào queue chờ sync khi có sóng).

### Flow 3 — Anh Tuấn xuất báo cáo NXT cuối tháng (desktop)

**Protagonist**: Anh Tuấn, chủ DN. Cuối tháng 5, cần báo cáo cho kế toán + đối chiếu kho.

1. Mở Chrome → app trên laptop. Đăng nhập. Sidebar trái mở rộng.
2. Click **[Báo cáo]** → **[Báo cáo NXT]**.
3. Trang báo cáo: filter ở trên (Kỳ: dropdown chọn "Tháng 5/2026", Kho: dropdown chọn "Tất cả các kho", Sản phẩm: để trống).
4. Click **[Áp dụng]** → bảng cập nhật giống y sheet NXT cũ: cột TT, Mã hàng, Thương hiệu, Kích thước, Mã gai, Nhập, Xuất, Tồn cuối kỳ.
5. Anh Tuấn scan nhanh — 8 dòng, tổng cộng dòng đầu: Nhập 394, Xuất 201, Tồn 193. Khớp với Excel cũ.
6. Click **[Xuất Excel]** ở góc phải. File `bao-cao-nxt-2026-05-tat-ca-kho.xlsx` tải xuống trong 2s, format giữ giống sheet NXT cũ để dán vào file kế toán quen thuộc không bị shock.
7. **★ CLIMAX**: 30 giây từ lúc click menu đến lúc có file Excel ngon lành. Trước đây phải nhắn Hùng "em gửi anh file Excel kho đi", đợi vài tiếng, lo Hùng chưa cập nhật xong tuần này. Giờ tự lấy được, tin số liệu vì biết mọi phiếu đã enforce validation và có audit log.

### Flow 4 — Anh Tuấn chuyển 20 lốp từ Hà Nội sang Bắc Ninh

**Protagonist**: Anh Tuấn. Khách Bắc Ninh đặt 20 GA518 1200R20, kho BN chỉ còn 5, kho HN còn 27.

1. Sidebar → **[Phiếu Chuyển]** → **[Tạo phiếu chuyển]**.
2. Drawer phải mở. Trường "Từ kho": chọn `Kho Hà Nội`. Trường "Đến kho": chọn `Kho Bắc Ninh`. (Validation: 2 kho khác nhau ✓).
3. Ngày: hôm nay. Ghi chú: "Chuyển bù cho đơn HồngAnh-BN".
4. Thêm line: chọn "GA518 1200R20 20PR" — autocomplete hiện kèm tồn kho HN hiện tại (27 Bộ) để Anh Tuấn yên tâm có đủ. Qty: 20.
5. Click **[Lưu phiếu]**. Toast: "Đã tạo phiếu chuyển #TR-2026-0007".
6. **★ CLIMAX**: Tồn HN cập nhật ngay từ 27 → 7 (badge warning vàng vì <10), tồn BN cập nhật từ 5 → 25 (success). Hùng (BN) trên điện thoại nhận push notification trong vòng 5s: "Có phiếu chuyển đến: 20 cái GA518". Anh Tuấn thấy mọi thứ atomic, không có khoảnh khắc "tồn lệch" giữa 2 kho.

## Inspiration & Anti-patterns

### Inspiration (giữ lại)

| App | Cái nên học |
|---|---|
| **KiotViet** | Sidebar trái rõ ràng, ngôn ngữ tiếng Việt tự nhiên, autocomplete sản phẩm nhanh. |
| **Misa** | Báo cáo có filter mạnh + export Excel sạch sẽ. |
| **Linear** | Keyboard shortcut overlay (`?` mở help), command palette (`Cmd+K`). |
| **Notion** | Density tuỳ chỉnh, dark mode polish. |
| **Figma** | Status indicator real-time + offline mode minh bạch. |

### Anti-patterns (tránh)

| Anti-pattern | Lý do tránh |
|---|---|
| **Wizard 5+ bước cho tạo phiếu** | Hùng tạo 30 phiếu/ngày — wizard sẽ giết tốc độ. Form 1 trang đủ. |
| **Modal lồng modal** | Mobile càng tệ. Dùng autocomplete inline thay vì popup chọn SP. |
| **Toast cho lỗi nghiêm trọng** | Lỗi sync, xuất quá tồn phải hiện banner persistent, không tự biến mất sau 4s. |
| **Báo cáo PDF mặc định** | Người dùng cần Excel để edit/copy vào file kế toán. PDF chỉ cho in phiếu, không cho báo cáo. |
| **"Đăng xuất" ở vị trí dễ bấm nhầm** | Đặt trong user menu dropdown, không ở sidebar item. |
| **Confirm dialog kiểu "Are you sure?" trống rỗng** | Phải nói rõ hậu quả: "Xoá phiếu này sẽ điều chỉnh tồn kho. Tiếp tục?" |
| **Spinner che full màn hình** | Dùng skeleton + spinner inline, không chặn user. |

## Responsive & Platform

### Breakpoints

| Tên | Range | Layout chính |
|---|---|---|
| `mobile` | < 768px | Sidebar = drawer; bottom nav 5 mục + FAB; table collapse cột phụ; sheet thay drawer. |
| `tablet` | 768-1023px | Sidebar icon-only (collapsed); table full với h-scroll; modal vẫn dùng. |
| `desktop` | ≥ 1024px | Sidebar full 240px; table full; keyboard shortcuts active; hover state đầy đủ. |

### Density modes (`[ASSUMPTION]`)

- "Thoải mái" — default, row 40px.
- "Compact" — desktop power user, row 32px, font 13px.

### PWA specifics

- **Install prompt** sau lần thứ 3 user mở app trong tuần.
- **App icon + splash screen** dùng logo + màu brand.
- **Standalone display-mode**: ẩn URL bar, hiện như native app.
- **Background sync**: queue phiếu sync ngay khi network available.
- **Push notification** (`[ASSUMPTION]`): cho phiếu chuyển đến + lỗi sync; cần permission grant.

### Browser support floor

- Chrome/Edge ≥ 100, Safari iOS ≥ 15, Safari macOS ≥ 15, Firefox ≥ 100.
- IE 11 — KHÔNG hỗ trợ.

### Login & Auth edge states

- **Mất net khi đăng nhập lần đầu trên thiết bị**: không thể auth offline (cần server). Form hiện banner đỏ "Không có mạng — không thể đăng nhập lần đầu" + nút "Thử lại".
- **Mất net khi đã từng login trên thiết bị**: cho phép "Mở chế độ chỉ xem" với cached profile + IndexedDB data; mọi mutation đi vào queue chờ sync.
- **Token expire khi offline có queue**: KHÔNG drop queue. Khi online lại → detect expire → pause queue + banner "Phiên hết hạn — đăng nhập lại để đồng bộ ({N} phiếu chờ)". Sau re-login → resume queue.
- **Queue lưu kèm `user_id` + `created_at`** — không gắn nhầm với user re-login khác.

## Print PDF Spec

> Invented section — print spec là gap edge-case reviewer flag.

- **Format**: A4 portrait, font Be Vietnam Pro embed (KHÔNG dùng Helvetica/Arial — mất dấu tiếng Việt).
- **Layout từng trang**:
  - Header lặp lại mọi trang: tên app + logo + tên phiếu + mã + kho + ngày + tên người tạo.
  - Body: bảng line items với cột STT/SKU/Tên/ĐVT/Qty/Ghi chú.
  - Footer lặp: trang `{X}/{Y}` + chỗ ký 2 bên (Người lập / Người nhận).
- **Pagination rules**: max ~25 dòng/trang A4. CSS `page-break-inside: avoid` cho mỗi row line — không gãy giữa 1 SKU. Nếu phiếu > 25 line → trang 2+ lặp header bảng.
- **Báo cáo PDF**: đảo orientation sang landscape khi báo cáo có ≥6 cột. Footer thêm timestamp generate + filter applied ("Kỳ: 5/2026 · Kho: Tất cả").
- **Implementation note**: server-side PDF (Puppeteer / WeasyPrint / PDFKit) ưu tiên hơn client-side để control font embed; client-side `window.print()` chỉ là fallback.

## Import Wizard Spec (One-shot Excel)

> Invented section — gap về import edge case.

3 bước:

1. **Upload + Preview** — drop file `.xlsx`. App đọc sheet, hiện preview 10 dòng đầu của mỗi sheet (Danh mục / Nhập kho / Xuất kho). User confirm mapping cột.

2. **Validate** — full scan. Bảng kết quả:
   - "{N} dòng hợp lệ" (xanh)
   - "{M} dòng lỗi" (vàng) — list cụ thể row + cell + lý do (vd: "Dòng 47: cột NGÀY giá trị '0505/2026' không phải định dạng ngày hợp lệ").
   - Button "Tải về file lỗi" — xuất `loi-import.xlsx` với chỉ các dòng lỗi để user sửa offline.

3. **Confirm** — chọn policy:
   - **Bỏ qua lỗi, import {N} dòng hợp lệ** (default).
   - **Huỷ toàn bộ** — không import gì.
   - **Cập nhật SKU trùng** (radio: Bỏ qua / Cập nhật / Báo lỗi).
   - Với phiếu lịch sử: dedupe bắt buộc theo `mã phiếu + ngày + kho`; phiếu trùng → reject.
   - Idempotent: re-import cùng file (row-hash check) không tạo duplicate.

Sau import → màn hình kết quả: "Đã import 2.105 dòng. Bỏ qua 12 dòng (xem `loi-import.xlsx`). Đã skip 23 dòng trùng."

**Tồn đầu kỳ**: sau khi import lịch sử, hệ thống tính tồn bằng `SUM(nhập) - SUM(xuất)` theo từng SKU. Nếu kết quả != tồn thực tế → admin có nút "Tạo phiếu khởi tạo tồn" cho phép gõ tay điều chỉnh, ghi rõ `source = "Tồn khởi đầu nhập tay"` trong audit log.

---

> **Hai spine win on conflict** với mọi mock, wireframe, hoặc import. Khi PRD/Architecture/Code diverge khỏi DESIGN.md hoặc EXPERIENCE.md, hai file này là nguồn sự thật — phải update spine trước khi đổi code.
