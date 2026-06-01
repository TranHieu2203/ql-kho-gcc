---
title: "Addendum — ql-kho-gcc Brief"
related-brief: brief.md
created: 2026-05-31
language: vi
---

# Addendum — Chi tiết kỹ thuật & nghiệp vụ cho PRD/Architecture

Tài liệu này lưu các chi tiết **không thuộc brief** nhưng cần thiết cho PRD, UX, và Architecture giai đoạn sau. Brief giữ ngắn gọn (1-2 trang); addendum giữ chi tiết nguồn.

---

## 1. Phân tích chi tiết file Excel mẫu (`THEO DÕI TỒN KHO LỐP MD-Final.xlsx`)

### Sheet `DANH MỤC` (8 dòng dữ liệu)

| Cột | Tên | Ghi chú |
|---|---|---|
| A | TT | Số thứ tự (cosmetic) |
| B | MÃ HÀNG | **Tên đầy đủ tiếng Việt** (vd: "LỐP KOIVI 1200R20 KV789 H3") — có inconsistency hoa/thường, có "LÓP" vs "LỐP" |
| C | MÃ HÀNG | **SKU code thực** (vd: "KV789H3 1200R20 24PR") — đây là khóa join với 2 sheet kia |
| D | THƯƠNG HIỆU | KOIVI, GASVIDO |
| E | KÍCH THƯỚC (Size) | 1200R20 20PR, 12R22.5 20PR, 1100R20 18PR, 1100R20 22PR |
| F | MÃ GAI (Pattern) | KV789H3, KV888, KV789H2, GD639, GA518, GD737 |

**Vấn đề chất lượng dữ liệu**:
- Cột B (tên đầy đủ) và Cột C (SKU) đôi khi không khớp logic (vd dòng 3: tên có "1200R20" nhưng SKU có "1100R20") — cần kiểm chứng nghiệp vụ.
- Có dấu cách thừa cuối SKU ("GD737 1200R20 20PR ") gây lỗi join.

### Sheet `NHẬP KHO` (~2.115 dòng — nhưng max_row=2117, nhiều dòng có thể trống)

| Cột | Tên | Ghi chú |
|---|---|---|
| A | TT | STT |
| B | NGÀY | datetime — **có dòng là string "0505/2026" sai format**, có dòng trống |
| C | MÃ HÀNG | SKU (khớp với Danh mục cột C) |
| D | THƯƠNG HIỆU | Redundant — derive từ Danh mục |
| E | KÍCH THƯỚC | Redundant — derive từ Danh mục |
| F | MÃ GAI | Redundant — derive từ Danh mục |
| G | ĐVT | "Bộ" hoặc "Chiếc" |
| H | SỐ LƯỢNG | Integer, có dòng trống |
| I | GHI CHÚ | Free text |

### Sheet `XUẤT KHO` (~2.114 dòng)

Cấu trúc giống NHẬP KHO. Cột GHI CHÚ thường chứa **tên khách + tỉnh** ("Hải - Nghệ An", "Hồng Anh- Bắc Ninh", "Tuấn Thành- Hà Nam") hoặc note nghiệp vụ ("a đạt đã trả lại madin 2 lốp mẫu này ngày 18/5", "hàng mẫu").

**Vấn đề**: rất nhiều dòng thiếu ngày, một số dòng thiếu số lượng — sheet NXT sẽ tính sai.

### Sheet `NXT` (Nhập – Xuất – Tồn)

| Cột | Tên |
|---|---|
| A | TT |
| B | MÃ HÀNG (SKU) |
| C | THƯƠNG HIỆU |
| D | KÍCH THƯỚC |
| E | MÃ GAI |
| F | NHẬP (tổng) |
| G | XUẤT (tổng) |
| H | TỒN CUỐI KỲ |
| I | Ghi chú |
| J | **Khách đặt** ← khái niệm reservation |

Có dòng `tổng cộng` ở R3 và các dòng `#N/A` chứng tỏ công thức lookup (VLOOKUP/SUMIF) bị hỏng với một số mã.

---

## 2. Data model đề xuất (lean, để chỗ mở rộng v2+)

```
Warehouse (kho)
  - id, name, address, manager, active

Product (sản phẩm — từ DANH MỤC)
  - id, sku, full_name, brand, size, pattern, default_unit, active

User
  - id, username, password_hash, full_name, role
  - role: admin | warehouse_staff
  - warehouses[]: kho được phép thao tác

InboundReceipt (Phiếu Nhập)
  - id, code, warehouse_id, date, note, created_by, created_at
  - lines: [{ product_id, unit, quantity, line_note }]

OutboundReceipt (Phiếu Xuất)
  - id, code, warehouse_id, date, customer_note (free text — v1)
  - lines: [{ product_id, unit, quantity, line_note }]

TransferReceipt (Phiếu Chuyển kho)
  - id, code, from_warehouse_id, to_warehouse_id, date, note, created_by
  - lines: [{ product_id, unit, quantity }]
  - atomic: 1 transfer = 1 outbound from + 1 inbound to (same transaction)

StockMovement (sổ chi tiết — derived, append-only)
  - id, warehouse_id, product_id, unit, qty (+/-), source_type, source_id, date
  - "Tồn = SUM(qty)" theo product+warehouse

AuditLog
  - id, user_id, action, entity_type, entity_id, before, after, timestamp
```

**Chỗ chừa cho v2+**: thêm `Customer`, `Supplier`, `Reservation`, `Price` mà không phải đập lại model.

---

## 3. Quyết định đã loại khỏi MVP (lưu lại lý do)

| Item | Lý do dời | Khi nào nên cân nhắc lại |
|---|---|---|
| Customer master | Người dùng chọn KHÔNG cho MVP — muốn launch nhanh, giữ trường tự do như Excel hiện tại | v2, sau khi có 1-2 tháng dữ liệu thực tế để biết khách nào lặp lại |
| Reservation ("Khách đặt") | Đi cùng Customer master | v2 |
| Supplier | Không trong scope MVP | v3, khi mở quản lý PO |
| Quản lý giá / công nợ | Người dùng chọn "chỉ quản số lượng" | v3 |
| Mã vạch / QR | Quy mô <100 SKU + 1-3 user thì gõ tay vẫn nhanh | v5, khi volume nhập liệu > 100 phiếu/ngày |
| Mobile app native | PWA đủ cho quy mô hiện tại | Khi volume nhập liệu lớn + offline phức tạp hơn last-write-wins |

---

## 4. Câu hỏi mở cần PRD/Architecture trả lời

1. **Xuất quá tồn**: cảnh báo (cho phép) hay chặn cứng? Có cho "Khách đặt" trừ vào tồn khả dụng ngay từ MVP không, hay v1 chỉ là số liệu báo cáo?
2. **Quyền theo kho**: 1 user có quyền thao tác trên *nhiều kho* hay chỉ *1 kho*? Admin có làm thay thủ kho được không?
3. **Quy tắc đánh mã phiếu**: ví dụ `IN-2026-0001` hay theo kho `WH01-IN-001`?
4. **Đơn vị Bộ vs Chiếc**: có ratio quy đổi cố định không (1 Bộ = ? Chiếc)? Hay là 2 đơn vị độc lập, tồn riêng?
5. **Số dư đầu kỳ**: khi import lịch sử Excel, làm thế nào để tính tồn đầu kỳ chính xác? Cần phiếu "Tồn khởi đầu" không?
6. **Sync conflict offline**: thủ kho A và thủ kho B cùng xuất 5 cái sản phẩm X khi tồn = 8 (cả 2 đều offline) — khi sync lên, cái nào ưu tiên? UI báo lỗi ra sao?
7. **Audit log scope**: log mọi field hay chỉ field nghiệp vụ chính (qty, date, product)?
8. **Auth recovery**: quên mật khẩu — admin reset hay self-service email?
9. **Backup**: ai backup CSDL, định kỳ nào? Đây là dữ liệu kinh doanh.

---

## 5. Ràng buộc đã chốt (carry-over sang PRD)

- **Ngôn ngữ UI và document**: 100% Tiếng Việt.
- **Không cloud có phí định kỳ** — phải tự host được trên hạ tầng của người dùng.
- **Web app responsive** — bắt buộc dùng tốt trên điện thoại (thủ kho dùng tại kho).
- **PWA offline-capable** — bắt buộc cho MVP, không phải nice-to-have.
- **Không bao gồm tiền (giá, công nợ)** trong MVP.
- **Multi-warehouse** từ ngày 1 (không phải single-warehouse rồi mở rộng).
