---
title: "Accessibility Review — ql-kho-gcc UX"
reviewer: "a11y-expert (WCAG 2.1 AA)"
date: 2026-05-31
scope:
  - "DESIGN.md"
  - "EXPERIENCE.md"
standard: "WCAG 2.1 AA"
---

# Accessibility Review — ql-kho-gcc UX

## Tóm tắt

Spine có nền tảng a11y khá tốt (đã declare WCAG AA target, touch 44px, focus ring, reduced motion, color-blind safety, font Be Vietnam Pro cho dấu tiếng Việt). Tuy nhiên kiểm tra contrast bằng số cho thấy **một số token màu semantic và muted text KHÔNG đạt 4.5:1** khi dùng làm body text; ngoài ra phần screen-reader/keyboard cho các pattern offline (sync badge, banner, queue drawer) và mobile-only gesture (swipe, long-press) còn thiếu equivalent. **Chưa đạt AA hoàn toàn** — cần fix 2 CRITICAL + 3 HIGH trước khi bind UI system.

## Findings (priority: CRITICAL / HIGH / MEDIUM / LOW)

### CRITICAL

- **C1 — Token `text.muted` `#8B95A4` trên nền trắng/`bg-base` không đạt 4.5:1**
  - File: `DESIGN.md` YAML `colors.text.muted: "#8B95A4"` (dòng 26) + dùng cho helper text, label phụ, placeholder, caption (size 12px ở `typography.scale.xs`).
  - Tính nhẩm: `#8B95A4` trên `#FFFFFF` ≈ **3.4:1**; trên `#F7F8FA` ≈ **3.2:1** → fail body, chỉ pass cho large text (≥18pt). Nhưng caption/helper là 12-13px → chắc chắn fail.
  - Fix: đẩy muted về `#6B7280` (~5.0:1) hoặc `#717B8C` (~4.6:1). Cập nhật cả light + dark token. Test lại bằng axe / contrast checker.

- **C2 — Semantic `warning` `#F59E0B` và `success` `#16A34A` dùng làm nền badge với text trắng KHÔNG đạt AA**
  - File: `DESIGN.md` dòng 30-33 (semantic) + `components.badge` (dòng 132-136) + `Stock indicator` (dòng 233) + `Sync badge` (dòng 232).
  - Tính: trắng trên `#F59E0B` ≈ **2.1:1** (fail nặng kể cả large); trắng trên `#16A34A` ≈ **3.3:1** (fail body, large borderline).
  - Hậu quả: badge "Tồn thấp" (1-9 warning), "Đã đồng bộ" (success), "Đang offline" (warning) sẽ không đọc được với người low-vision.
  - Fix: với `warning` → dùng pattern "nền soft + text đậm" (vd `bg #FEF3C7` + `text #92400E` ≈ 7:1) thay vì trắng trên vàng; với `success` → text dùng `#0F5A29` trên `bg #DCFCE7`. Hoặc đẩy success xuống `#15803D` (~4.7:1 với trắng). Document rõ trong DESIGN.md "không bao giờ text trắng trên warning amber".

### HIGH

- **H1 — Sync badge & offline banner thiếu spec ARIA live region rõ ràng**
  - File: `EXPERIENCE.md` mục `Accessibility Floor` chỉ nói chung "live region cho toast" (dòng 206); mục `Offline & Sync Behavior` UI states table (dòng 224-231) không nói cách screen reader announce khi state đổi từ "Đã đồng bộ" → "Đang sync (3)" → "Lỗi (1)".
  - Why fail: SR user không biết offline đã xảy ra, không biết phiếu vừa lưu đang chờ sync. Vi phạm WCAG 4.1.3 Status Messages.
  - Fix: thêm vào EXPERIENCE.md: sync badge dùng `role="status"` + `aria-live="polite"` + `aria-atomic="true"`; offline banner dùng `role="alert"` (assertive) khi vừa mất net; toast success dùng polite, toast lỗi dùng assertive. Spec rõ text announce ("Đang offline, 3 phiếu chờ đồng bộ").

- **H2 — Density "Compact" không bảo vệ touch target khi user touch trên màn hình lai (tablet, laptop touchscreen)**
  - File: `DESIGN.md` dòng 190-192 + `EXPERIENCE.md` dòng 336-339. "Compact" row 32px / button 28px được mô tả "cho power user máy tính" nhưng không có guard ngăn enable trên thiết bị có touch (laptop touchscreen, Surface, iPad với keyboard).
  - Why fail: 28px button < 44px target → vi phạm WCAG 2.5.5 Target Size (AAA) và 2.5.8 (AA — 24px minimum), nguy hiểm bấm nhầm khi xoá phiếu.
  - Fix: hoặc (a) chỉ cho phép Compact khi `(pointer: fine)` & viewport ≥1024 và disable + warning nếu thiết bị touch; hoặc (b) bỏ Compact ở MVP (đã đánh `[ASSUMPTION]`); hoặc (c) giữ touch target 44px ngay cả Compact, chỉ giảm padding visual, không giảm hit area.

- **H3 — Mobile-only gesture (swipe-left xoá, long-press context, pull-to-refresh) thiếu fallback bàn phím và screen reader**
  - File: `EXPERIENCE.md` mục `Interaction Primitives` (dòng 184-196). Swipe-left → xoá nhanh; long-press → context menu; pull-to-refresh.
  - Why fail: SR user trên mobile (VoiceOver/TalkBack) không thể swipe row, không thể long-press chính xác. Vi phạm 2.1.1 Keyboard và 2.5.1 Pointer Gestures (gesture phức tạp phải có alternative đơn-thao tác).
  - Fix: mỗi row table luôn có nút "..." (kebab) visible với `aria-label="Tuỳ chọn cho phiếu IN-..."` mở menu chứa Sửa/In/Xoá. Pull-to-refresh có nút "Làm mới" trong toolbar. Document rõ trong State Patterns.

- **H4 — Form validation thiếu spec link error ↔ field cho screen reader**
  - File: `EXPERIENCE.md` mục Form (dòng 138-142) "border đỏ + helper text dưới khi blur" nhưng không nói `aria-invalid="true"` + `aria-describedby="<error-id>"`.
  - Why fail: SR đọc field xong không nghe lỗi → user không biết lỗi gì. Vi phạm 3.3.1, 3.3.3, 4.1.2.
  - Fix: thêm rule trong Component Patterns: mọi input lỗi set `aria-invalid="true"` + `aria-describedby` trỏ tới helper text node; helper text node có `id` ổn định. Form submit thất bại → focus về field lỗi đầu tiên + announce tổng số lỗi qua live region.

### MEDIUM

- **M1 — Sync badge dùng chấm tròn 🟢🟡🔴 — chỉ phân biệt bằng MÀU + chữ; thiếu shape redundancy**
  - File: `DESIGN.md` dòng 232 + `EXPERIENCE.md` dòng 226-230. Đã có text label ("Đã đồng bộ", "Lỗi") nên không hoàn toàn fail 1.4.1 Use of Color, nhưng khi sidebar collapsed/mobile chỉ thấy chấm + số → màu trở thành phương tiện chính.
  - Fix: thay chấm bằng icon shape (check ✓ cho success, dấu chấm than ⚠ cho warning, X cho error, cloud-off cho offline). Giữ màu nhưng shape carry chính.

- **M2 — Reduced motion declaration chưa enumerate animation cụ thể**
  - File: `EXPERIENCE.md` dòng 208 "tôn trọng `prefers-reduced-motion` — bỏ animation transition, chỉ giữ fade". Nhưng skeleton có "pulse" (dòng 173), spinner button (dòng 174), slide drawer right/bottom, toast slide-in, optimistic update badge, FAB sheet trượt — không nói cái nào tắt.
  - Why borderline: 2.3.3 Animation from Interactions (AAA) + 2.2.2 Pause/Stop/Hide. Pulse skeleton + spinner liên tục có thể gây khó chịu cho người vestibular.
  - Fix: bảng enumeration: với `prefers-reduced-motion: reduce` → skeleton chuyển từ pulse sang tĩnh; spinner chuyển sang text "Đang tải..."; slide drawer/sheet thay bằng fade; bỏ FAB ripple. Toast vẫn fade, không slide.

- **M3 — Zebra stripe + row hover dùng cùng color `bg-muted` `#F1F2F5` → mất khả năng phân biệt hover**
  - File: `DESIGN.md` dòng 111-112 `zebra-stripe: "{colors.surface.bg-muted}"` + dòng 223 "row hover bg-muted".
  - Why issue: row chẵn (zebra) và row đang hover sẽ trông giống nhau; keyboard user duyệt bằng arrow không biết đang ở row nào. Affects 1.4.11 Non-text Contrast (focus indicator).
  - Fix: hover dùng `primary-soft` `#E8F0FB` (đã có token, contrast tốt với cả 2 stripe) hoặc darken thêm 1 step `#E2E5EB`; focus-visible row có outline 2px primary inset.

- **M4 — Heading hierarchy chưa spec cho Modal/Drawer/Sheet**
  - File: `EXPERIENCE.md` Accessibility Floor dòng 207 chỉ nói "h1 page title, h2 section". Modal/Drawer/Sheet (đầy form tạo phiếu) không spec heading.
  - Why fail: SR mở drawer không biết tiêu đề; vi phạm 2.4.6 Headings and Labels, 4.1.2.
  - Fix: mọi Modal/Drawer/Sheet có `<h2>` (hoặc h1 nếu là page-equivalent trên mobile) là tiêu đề; container có `role="dialog"` + `aria-labelledby` trỏ tới h2 + `aria-modal="true"`. Focus trap + return focus sau khi đóng.

- **M5 — Bottom nav label "Tổng quan" + 5 mục trong viewport hẹp có nguy cơ truncate / chen dấu tiếng Việt**
  - File: `DESIGN.md` dòng 124-127 `bottom-nav.height: 64px, item-count-max: 5` + `EXPERIENCE.md` dòng 83 "[Tổng quan] [Nhập] [+] [Xuất] [Tồn]".
  - Why issue: trên iPhone SE (375px) chia 5 cột → 75px/cột; "Tổng quan" 9 ký tự + dấu sẽ wrap/truncate; FAB ở giữa chiếm chỗ → còn 4 cột text. Dấu "ổ" trong "Tổng" cần line-height đủ.
  - Fix: dùng label ngắn hơn (vd "Tổng" thay "Tổng quan"), font 11px medium, line-height ≥1.3 để chứa dấu, `text-overflow: ellipsis` + `title` attr. Test cụ thể trên 320-375px width.

### LOW

- **L1 — Font size base 14px (`scale.base`) cho body desktop là tối thiểu chấp nhận được; 12px (`xs`) cho caption với dấu tiếng Việt rủi ro nhỏ về legibility**
  - File: `DESIGN.md` typography scale dòng 47-54.
  - Note: 12px Be Vietnam Pro với dấu (vd "Ổn", "ỗ", "ặ") có nguy cơ dấu mờ trên màn DPI thấp.
  - Fix: ưu tiên 13px cho mọi label hiển thị thông tin user phải đọc; giữ 12px chỉ cho label tag/uppercase đơn giản không dấu phức tạp. Test render thực tế.

- **L2 — Keyboard shortcut help (`?`) cần được announce + accessible launcher**
  - File: `EXPERIENCE.md` dòng 195. Shortcut `?` mở help là tốt, nhưng nếu user không biết → không tìm thấy. Cần một entry "Phím tắt" trong user menu để keyboard non-power-user và SR user discover.
  - Fix: thêm mục "Phím tắt bàn phím" trong user menu dropdown, mở cùng overlay; overlay có `role="dialog"`, focus trap.

## Strengths (cái đã làm tốt)

- **Touch target 44px được nâng lên thành design token** (`spacing.touch-min`) và áp dụng vào button-lg, input-mobile, table row mobile — pattern enforce đúng.
- **Chọn font Be Vietnam Pro** cho tiếng Việt là quyết định đúng — render dấu chuẩn; có note test cụ thể với "Ổn", "ĐVT" trong Accessibility Floor.
- **Color-blind safety đã được nêu rõ ràng** trong EXPERIENCE.md với rule "không dùng MÀU làm phương tiện duy nhất" + ví dụ stock indicator có cả số + text "Thấp/Đủ".
- **Microcopy lỗi theo pattern "chỗ sai + cách sửa"** (dòng 116) — đúng nguyên tắc WCAG 3.3.3 Error Suggestion bằng tiếng Việt tự nhiên.
- **Toast không dùng cho lỗi nghiêm trọng** (anti-pattern dòng 320) — tránh được pitfall phổ biến nơi SR user miss thông báo quan trọng.
- **Dark mode primary được đẩy sáng hơn** (`#4D8FE5`) có ý thức giữ contrast — tính ra ~4.7:1 với nền tối, đạt AA borderline.
- **Focus ring 2px brand** declare ở input (`border-focus: "2px solid {colors.brand.primary}"`) — đạt 1.4.11 Non-text Contrast cho focus indicator.
- **Reduced motion + prefers-reduced-motion** đã được nêu (cần enumerate kỹ hơn — xem M2).
- **Anti-pattern "icon-only cho action quan trọng"** được liệt kê trong DESIGN.md DON'T (dòng 249) — phòng được pitfall lớn về SR labeling.
