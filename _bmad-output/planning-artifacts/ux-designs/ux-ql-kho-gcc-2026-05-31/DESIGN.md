---
title: "DESIGN — Phần mềm Quản lý Kho Lốp xe (ql-kho-gcc)"
status: final
created: 2026-05-31
updated: 2026-05-31
owner: HieuTV-QL-Kho
language: vi
sources:
  - "_bmad-output/planning-artifacts/briefs/brief-ql-kho-gcc-2026-05-31/brief.md"
  - "_bmad-output/planning-artifacts/briefs/brief-ql-kho-gcc-2026-05-31/addendum.md"
colors:
  brand:
    primary: "#1E5FB4"      # Blue 700 — màu chủ đạo (tin cậy, business)
    primary-hover: "#174A8E"
    primary-soft: "#E8F0FB"
    accent: "#F59E0B"        # Amber — dùng cho cảnh báo tồn thấp, status pending
  surface:
    bg-base: "#F7F8FA"       # nền app (light)
    bg-elevated: "#FFFFFF"   # card, modal, sidebar
    bg-muted: "#F1F2F5"      # hover, ô không active
    border: "#E2E5EB"
    border-strong: "#C8CDD7"
  text:
    primary: "#1B1F26"
    secondary: "#5A6473"
    muted: "#6B7280"         # WCAG AA — đạt 4.6:1 trên nền trắng (cũ #8B95A4 fail body)
    inverse: "#FFFFFF"
    link: "#1E5FB4"
  semantic:
    # ICON / BORDER / FILL color — KHÔNG được dùng làm nền badge có text trắng.
    success: "#15803D"       # icon ✓, border. Đạt 4.7:1 với trắng cho icon-only.
    warning: "#B45309"       # icon ⚠, border. Đạt 5.1:1 với trắng cho icon-only.
    danger: "#B91C1C"        # icon ✕, border. Đạt 6.6:1 với trắng cho icon-only.
    info: "#1D4ED8"          # icon ⓘ, border.
  semantic-soft:             # NỀN cho badge / banner — dùng kèm text đậm "-strong" dưới
    success: "#DCFCE7"
    warning: "#FEF3C7"
    danger: "#FEE2E2"
    info: "#DBEAFE"
  semantic-strong:           # TEXT trên nền soft — đạt >7:1 cho mọi cặp
    success: "#0F5A29"
    warning: "#92400E"
    danger: "#7F1D1D"
    info: "#1E3A8A"
  dark:                      # dark mode (đã chốt là có support)
    bg-base: "#0F141C"
    bg-elevated: "#1A2231"
    bg-muted: "#222B3D"
    border: "#2D384D"
    text-primary: "#E8ECF3"
    text-secondary: "#A8B1C2"
    primary: "#4D8FE5"        # tăng độ sáng cho contrast dark mode
typography:
  font-family:
    sans: "'Inter', 'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', sans-serif"
    mono: "'JetBrains Mono', 'Consolas', monospace"  # cho mã SKU, số liệu
  scale:
    xs: "12px"      # caption, label phụ
    sm: "13px"      # body phụ, table cell
    base: "14px"    # body chính (dense)
    md: "15px"      # body easy-reading
    lg: "16px"      # subheading, button mobile
    xl: "18px"      # section heading
    "2xl": "22px"   # page title
    "3xl": "28px"   # dashboard hero numbers
  weight:
    normal: 400
    medium: 500
    semibold: 600
    bold: 700
  line-height:
    tight: 1.2
    base: 1.5
    relaxed: 1.7
rounded:
  none: "0"
  sm: "4px"        # input, badge nhỏ
  md: "6px"        # button, card nhỏ
  lg: "8px"        # card, modal
  xl: "12px"       # hero panel, drawer
  full: "9999px"   # pill, avatar
spacing:
  "0": "0"
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"      # padding/gap mặc định
  "5": "20px"
  "6": "24px"      # padding card
  "8": "32px"      # khoảng giữa section
  "10": "40px"
  "12": "48px"
  "16": "64px"
  touch-min: "44px" # touch target tối thiểu mobile (a11y)
components:
  button:
    height-sm: "32px"
    height-md: "36px"
    height-lg: "44px"        # = touch-min
    padding-x: "16px"
    radius: "{rounded.md}"
    font-weight: "{typography.weight.medium}"
  input:
    height: "36px"
    height-mobile: "44px"    # = touch-min
    padding-x: "12px"
    radius: "{rounded.sm}"
    border: "1px solid {colors.surface.border}"
    border-focus: "2px solid {colors.brand.primary}"
  card:
    padding: "{spacing.6}"
    radius: "{rounded.lg}"
    bg: "{colors.surface.bg-elevated}"
    border: "1px solid {colors.surface.border}"
    shadow: "{elevation.sm}"
  table:
    row-height: "40px"
    row-height-mobile: "52px" # rộng hơn để touch
    cell-padding-x: "12px"
    header-bg: "{colors.surface.bg-muted}"
    header-font-weight: "{typography.weight.semibold}"
    zebra-stripe: "{colors.surface.bg-muted}"     # row chẵn
    row-hover-bg: "{colors.brand.primary-soft}"   # hover khác zebra để keyboard user phân biệt được
    row-focus-outline: "2px solid {colors.brand.primary}" # outline inset cho focus-visible
    border: "1px solid {colors.surface.border}"
  sidebar:
    width-expanded: "240px"
    width-collapsed: "64px"
    bg: "{colors.surface.bg-elevated}"
    item-height: "40px"
    item-active-bg: "{colors.brand.primary-soft}"
    item-active-fg: "{colors.brand.primary}"
  topbar:
    height: "56px"
    bg: "{colors.surface.bg-elevated}"
    border-bottom: "1px solid {colors.surface.border}"
  bottom-nav:                # mobile only
    height: "64px"
    bg: "{colors.surface.bg-elevated}"
    item-count-max: 5
  modal:
    radius: "{rounded.xl}"
    padding: "{spacing.6}"
    backdrop: "rgba(15, 20, 28, 0.45)"
  badge:
    radius: "{rounded.full}"
    padding: "2px 8px"
    font-size: "{typography.scale.xs}"
    font-weight: "{typography.weight.medium}"
elevation:
  none: "none"
  sm: "0 1px 2px rgba(15, 20, 28, 0.06)"
  md: "0 4px 8px rgba(15, 20, 28, 0.08)"
  lg: "0 12px 24px rgba(15, 20, 28, 0.10)"
---

# DESIGN.md — Visual Identity

## Brand & Style

**Personality.** "Người trợ lý kho cần mẫn" — đáng tin cậy như một người thủ kho lâu năm, gọn gàng như một cuốn sổ sách kế toán, nhưng không lạnh lùng. Hợp với cảm giác sản phẩm VN phổ thông (KiotViet, Misa, Sapo): chuyên nghiệp đủ để chủ doanh nghiệp tin tưởng, gần gũi đủ để thủ kho dùng hàng ngày không thấy "máy móc".

**Visual mood.** Nền sáng sạch, một màu thương hiệu xanh dương duy nhất làm nhấn (không loè loẹt), bảng dữ liệu là nhân vật chính. Không dùng gradient màu rực, không dùng illustration hoạt hình. Iconography theo phong cách stroke 1.5px (Lucide / Tabler / Heroicons outline).

**Voice carry-over.** Microcopy ngắn, dùng "anh/chị", tránh jargon ("phiếu nhập" không phải "inbound receipt"). Chi tiết về voice ở [`EXPERIENCE.md`](./EXPERIENCE.md#voice-and-tone).

## Colors

Hai bảng: light (mặc định) và dark (đã chốt có support). Mã token đầy đủ ở YAML frontmatter trên.

**Light mode (mặc định)**
- **Primary** `#1E5FB4` — màu thương hiệu duy nhất. Dùng cho: nút hành động chính, link, item active sidebar, focus ring.
- **Surface** dùng 3 tầng: nền app `#F7F8FA` (đỡ chói), card/sidebar `#FFFFFF`, hover/mute `#F1F2F5`.
- **Semantic** chỉ dùng đúng nghĩa — không trang trí: `success` (xanh lá) cho phiếu lưu xong / sync OK, `warning` (vàng cam) cho offline + tồn thấp, `danger` (đỏ) cho xuất quá tồn + lỗi sync.
- **Quan trọng — pattern badge/banner WCAG-safe**: KHÔNG dùng text trắng trên nền semantic gốc (`#15803D`/`#B45309`/`#B91C1C`) — contrast không đủ. Dùng pattern **soft bg + strong text**: nền `semantic-soft.*` + chữ `semantic-strong.*`. VD badge "Sắp hết" = nền `#FEF3C7` + text `#92400E` (≈ 8:1). Semantic gốc chỉ dùng cho **icon**, **border 1-2px**, hoặc **fill SVG** — không làm nền chứa text trắng.

**Dark mode**
- Nền `#0F141C`, không pure black (giảm halation cho mắt).
- Primary đẩy sáng hơn (`#4D8FE5`) để giữ contrast WCAG AA trên nền tối.

**Tỉ lệ dùng màu**: ~70% surface trung tính + ~25% text + ~5% accent màu (primary + semantic). Brand không spam — chỉ ở chỗ cần thu hút mắt.

## Typography

**Font chính**: Inter (Latin) + Be Vietnam Pro (tiếng Việt — dấu chuẩn, không bị vỡ). Cả hai đều miễn phí Google Fonts, render tốt mọi browser, có nhiều weight. `[ASSUMPTION]` cuối cùng có thể dùng `system-ui` nếu không muốn load font — Architecture phase quyết định.

**Font mono**: JetBrains Mono cho mã SKU (`KV789H3 1200R20 24PR`) và số liệu trong bảng — căn cột đẹp, dễ phân biệt `0` và `O`, `1` và `l`.

**Scale**: hệ 8 mức từ 12-28px. Body mặc định 14px (dense, phù hợp bảng nhiều cột); mobile đẩy lên 15px cho dễ đọc. Số liệu hero ở Dashboard dùng 28px semibold để chủ DN nhìn thoáng qua biết ngay.

**Weight**: chỉ dùng 4 (normal/medium/semibold/bold). Không dùng light/thin (khó đọc trên màn nhỏ, render kém với tiếng Việt có dấu).

## Layout & Spacing

**Grid**: hệ 8px (mọi spacing là bội số của 4px). Mặc định gap/padding `16px`; card padding `24px`; section gap `32px`.

**Container**:
- Desktop: full-width, sidebar `240px` + content area linh hoạt. Max content `1440px` cho khả năng đọc.
- Tablet: sidebar collapse thành icon-only (`64px`).
- Mobile: sidebar ẩn → drawer + bottom-nav 5 mục.

**Touch target tối thiểu 44px** trên mobile (a11y bắt buộc cho touch-first).

**Density**: chỉ 1 mức "Thoải mái" ở MVP (row table 40px, button 36px). Density "Compact" 28px-button bị bỏ vì vi phạm WCAG 2.5.8 Target Size khi enable trên thiết bị touch (laptop touchscreen, Surface, iPad+keyboard). Có thể cân nhắc lại ở v2 với guard: chỉ enable khi `(pointer: fine)` và viewport ≥ 1024px.

## Elevation & Depth

3 tầng shadow + 1 không có. Dùng tiết kiệm — không phải mọi card đều cần shadow.
- `sm` — card list bình thường, sidebar item active.
- `md` — dropdown, popover, drawer.
- `lg` — modal, dialog full-screen mobile.

Không dùng inner shadow, không dùng colored shadow (giữ "công cụ làm việc" không phải "app marketing").

## Shapes

**Rounded scale** (4 → 12px, full pill).
- Input/badge: `sm` 4px (gọn gàng, không "vui vẻ quá").
- Button/card nhỏ: `md` 6px.
- Card/modal: `lg` 8-12px.
- Avatar/pill badge: full.

Không dùng sharp corners (0px) — cảm giác quá kỹ thuật, lạnh. Không dùng siêu tròn (>16px) — quá "tiêu dùng/giải trí".

## Components

Visual specs của các thành phần chính ghi ở YAML frontmatter `components`. Behavior chi tiết của từng component ở [`EXPERIENCE.md`](./EXPERIENCE.md#component-patterns).

**Inventory cơ bản cần có:**

| Component | Visual note |
|---|---|
| **Button** | 3 size (sm/md/lg=44px). 3 variant: `primary` (nền brand), `secondary` (border, text brand), `ghost` (text-only, hover bg-muted), `danger` (nền đỏ — chỉ cho xoá). |
| **Input / Select / Datepicker** | Border 1px, focus ring 2px brand. Label ở trên, helper text/error ở dưới. Mobile chiều cao 44px. |
| **Table** | Header sticky, zebra stripe nhẹ, row hover bg-muted. Cột số/qty align-right + mono font. Mobile auto-collapse cột phụ → "..." mở chi tiết. |
| **Card** | Padding 24px, radius 8px, shadow-sm. Dùng cho metric ở Dashboard, list item dạng card trên mobile. |
| **Modal/Drawer** | Modal cho form ngắn (sửa item). Drawer phải cho form dài (tạo phiếu nhiều dòng) — dễ scroll. Mobile: full-screen sheet. |
| **Sidebar** | Width 240/64 (expand/collapse). Item active: bg `primary-soft` + viền trái 3px primary + text primary. Icon Lucide stroke 1.5. |
| **Top bar** | Logo + tên app | warehouse switcher (dropdown) | offline/sync status badge | user menu avatar. |
| **Bottom nav (mobile)** | 5 mục: Tổng quan, Nhập, Xuất, Tồn, Thêm. Icon + label dưới. Item active: brand color + dấu chấm nhỏ trên đầu. |
| **Toast** | Top-right desktop, top-center mobile. Auto-dismiss 4s. Có color theo semantic (success/warning/danger/info). |
| **Empty state** | Icon line-art lớn 64px + heading 18px + 1-2 dòng hướng dẫn + CTA primary. Không "vui vẻ thái quá". |
| **Offline banner** | Banner thin 32px sticky trên cùng. Vàng cam nền soft, text đậm: "Đang offline — phiếu sẽ tự đồng bộ khi có mạng". Bấm vào → xem hàng chờ sync. |
| **Status badge (sync)** | Pill nhỏ ở top bar: ✓ "Đã đồng bộ" / ↻ "Đang sync (3)" / ⚠ "Lỗi sync (1)" / ⊘ "Offline". Icon shape carry trạng thái (không chỉ màu — bảo vệ user color-blind và khi sidebar collapsed). Nền dùng `semantic-soft`, text dùng `semantic-strong`. |
| **Stock indicator** | Số tồn + badge dạng "soft bg + strong text + icon": ≥10 ✓ "Đủ tồn", 1-9 ⚠ "Sắp hết", 0 ✕ "Hết hàng". Ngưỡng cấu hình ở `/quan-tri/cau-hinh`. Luôn có **cả số + chữ + icon** — không chỉ màu. |

## Do's and Don'ts

**DO**
- Giữ **một** màu brand (xanh dương). Mọi nhấn mạnh tone-on-tone trong scale xanh.
- Dùng **mono font cho số và mã SKU** — căn cột đẹp, dễ scan.
- Hiển thị trạng thái offline/sync **ngay từ top bar** mọi lúc — đây là contract niềm tin của thủ kho.
- Đảm bảo **touch target ≥44px** trên mobile cho mọi action.
- Cho phép **dark mode toggle** ở user menu, lưu preference.

**DON'T**
- Không dùng **>1 màu brand**. Không gradient xanh-tím-hồng. Không màu pastel.
- Không dùng **illustration hoạt hình** (cute mascot, character) ở empty state — sai tone "công cụ làm việc".
- Không **ẩn tồn kho** sau click — phải nhìn được số ngay khi mở 1 sản phẩm/màn hình.
- Không dùng **modal lồng modal**. Form dài → drawer; form ngắn → modal đơn. Wizard chỉ cho Import Excel.
- Không dùng **icon-only** cho action quan trọng (Save, Delete) — luôn có label tiếng Việt rõ ràng.
- Không dùng **toast cho lỗi cần xử lý** (lỗi sync, xuất quá tồn) — phải là banner/dialog, không tự biến mất.
- Không **text trắng trên nền semantic gốc** (warning amber, success green) — vi phạm WCAG. Luôn dùng cặp `semantic-soft` + `semantic-strong`.
- Không phân biệt trạng thái **chỉ bằng màu**. Sync/Stock/Status đều phải có thêm icon shape hoặc label text.
