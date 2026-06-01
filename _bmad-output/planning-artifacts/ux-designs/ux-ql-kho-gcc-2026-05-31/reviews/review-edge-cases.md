---
title: "Edge Case Review — ql-kho-gcc UX"
reviewer: "Edge Case Hunter"
created: 2026-05-31
target:
  - "../EXPERIENCE.md"
  - "../DESIGN.md"
language: vi
---

# Edge Case Review — ql-kho-gcc UX

## Tóm tắt

Spine UX phủ tốt happy-path và đã invent section Offline + Multi-warehouse, nhưng nhiều boundary condition của offline-first + multi-user + đa kho chưa được nêu hành vi cụ thể. 18 finding dưới đây là các nhánh chưa có behavior expectation rõ trong spec — cần chốt trước Architecture phase, vì hầu hết ảnh hưởng schema (sync queue, audit, recompute tồn) chứ không chỉ UI.

## Edge cases CHƯA xử lý

### Category: Offline & Sync

- **EC-01. Mất net giữa lúc submit phiếu (mid-flight)**. Behavior expectation: request đã gửi nhưng chưa biết server có nhận hay không → phải có state "Đang gửi, mất kết nối" và policy idempotent (client-id + retry an toàn, không tạo 2 phiếu trùng). Spec gap: section "Offline & Sync" giả định mọi action OR là online-OK OR là offline-queue, không có trạng thái "in-flight uncertain". Fix: yêu cầu mọi mutation có `client_request_id` (UUID), server dedupe; UI hiển thị badge "⏳ Đang xác nhận" cho phiếu in-flight + retry an toàn khi mạng lên lại.

- **EC-02. Mất net khi đang đăng nhập (chưa có token)**. Expectation: form login phải báo rõ "Không có mạng — không thể đăng nhập lần đầu" (vì PWA không thể auth offline nếu chưa từng login máy này). Spec gap: flow `/login` không nói gì về offline. Fix: thêm state offline cho `/login` + cho phép "Mở chế độ chỉ xem" nếu device đã từng login (có cached profile + IndexedDB data) — nếu chưa từng → block với CTA "Kết nối mạng để đăng nhập lần đầu".

- **EC-03. Token hết hạn khi đang offline có queue**. Expectation: queue không bị mất, khi online lại app phải refresh token (hoặc bắt user re-login) trước khi flush queue, và phải gắn được phiếu queue với user gốc (không phải user mới login). Spec gap: Auth + Offline không giao nhau trong spec. Fix: queue lưu kèm `user_id` + `created_at`; khi token expire khi flush → pause queue, hiện banner "Phiên hết hạn, đăng nhập lại để đồng bộ (3 phiếu chờ)", không drop queue.

- **EC-04. User clear browser cache / xoá PWA khi còn queue chưa sync**. Expectation: cảnh báo "Bạn còn N phiếu chưa đồng bộ" trước khi mất, hoặc ít nhất giải thích hậu quả ở Settings. Spec gap: không nhắc. Fix: thêm warning dialog khi user vào `/ca-nhan/giao-dien` chọn "Xoá dữ liệu cục bộ" + cảnh báo trên banner offline nếu queue > 0 và quota IndexedDB sắp đầy.

- **EC-05. Cùng 1 user mở app trên 2 device cùng offline → cùng tạo phiếu → cùng sync**. Expectation: 2 phiếu local có thể trùng mã hiển thị (vì sinh client-side); sau sync server cấp mã chính thức khác. Spec gap: flow nói "phiếu #IN-2026-0043" như thể có sẵn nhưng không nói mã sinh ở đâu, offline thì gọi gì. Fix: chốt convention "mã tạm dạng `IN-DRAFT-{uuid8}` khi offline, server cấp mã chính thức khi flush"; UI hiển thị cả 2 sau sync để user không hoang mang.

- **EC-06. Background sync khi tab inactive / PWA bị OS kill**. Expectation: queue vẫn flush được qua Background Sync API; nếu browser không support (Safari iOS) → fallback và báo rõ "Bạn cần mở app để đồng bộ". Spec gap: PWA spec liệt kê "Background sync" như feature nhưng không nói platform constraint. Fix: thêm dòng "Safari iOS không hỗ trợ Background Sync — app phải mở foreground để flush queue" vào PWA section + push notification nhắc user mở app nếu queue > 6h chưa flush.

### Category: Concurrency

- **EC-07. Race xuất kho cùng lúc 2 thủ kho, tồn 8, mỗi người xuất 5**. Expectation: server phải atomic check-and-decrement (transaction); phiếu thứ 2 fail với lỗi "Tồn đã thay đổi, còn 3 Bộ — vui lòng nhập lại số lượng". Spec gap: chính sách xuất quá tồn nói về **cảnh báo/chặn lúc nhập** chứ không nói về **race lúc commit**. Fix: thêm state "Conflict tồn" vào State Patterns: dialog "Trong lúc anh tạo phiếu, kho đã xuất bớt. Tồn còn 3 (trước đó 8). Chỉnh lại hay huỷ?".

- **EC-08. Phiếu chuyển kho A→B đang in-flight, kho B cũng tạo phiếu xuất từ chính lô đó**. Expectation: phải định nghĩa khi nào tồn ở B tăng — lúc chuyển được tạo, lúc B "nhận xác nhận", hay lúc sync xong? Spec gap: flow 4 nói "tồn BN cập nhật từ 5 → 25" như thể atomic, nhưng không nói có cần B xác nhận nhận hay không, và nếu phiếu chuyển bị xoá sau đó thì xuất ở B đã commit sẽ ra sao. Fix: chốt model 1-step (tự động commit cả 2 đầu khi tạo) vs 2-step (B confirm) — đề xuất 2-step có "phiếu chuyển ở trạng thái Đang đi" để tránh ghost stock.

- **EC-09. Last-write-wins với phiếu nhiều line items**. Expectation: nếu User A sửa line 3, User B sửa line 5 và lưu sau → LWW sẽ xoá thay đổi của A dù không xung đột line. Spec gap: section Offline nói "last-write-wins ở v1" nhưng không nói granularity (cả phiếu hay từng line). Fix: ít nhất chốt granularity = cả phiếu + version number → khi server detect version cũ → reject + UI hiển thị diff "Phiếu đã thay đổi từ thiết bị khác. Xem khác biệt".

### Category: Data integrity

- **EC-10. Backdate phiếu xuất khiến tồn ở thời điểm đó âm**. Expectation: cho phép sửa ngày cũ nhưng phải tính lại tồn theo timeline; nếu khiến tồn âm tại một thời điểm trong quá khứ → cảnh báo rõ "Nếu backdate phiếu này về 12/05, tồn ngày 13/05 sẽ âm 4 Bộ". Spec gap: header form chỉ nói "ngày tương lai cảnh báo" — không đề cập backdate. Fix: validation đặc biệt cho ngày trong quá khứ + simulation tồn timeline + chỉ admin mới được vượt cảnh báo.

- **EC-11. Xoá phiếu nhập cũ → tồn recompute → các phiếu xuất sau đó từ lô đó trở thành "xuất ảo"**. Expectation: phải block xoá (chỉ cho "huỷ/đảo phiếu" tạo phiếu nghịch) hoặc cảnh báo cascade. Spec gap: microcopy "Tồn kho sẽ được điều chỉnh tự động" che mất hậu quả cascade. Fix: dialog xoá phiếu nhập phải hiện "Phiếu này đã được dùng cho N phiếu xuất sau đó. Xoá sẽ làm tồn ở các phiếu kia bất hợp lệ" + ưu tiên flow "tạo phiếu điều chỉnh" thay vì xoá hard.

- **EC-12. Quy đổi ĐVT Bộ ↔ Chiếc**. Expectation: 1 Bộ = mấy Chiếc? Phải khai báo ở catalog hay không? Nếu nhập theo Bộ và xuất theo Chiếc, tồn tính theo đơn vị gốc nào? Spec gap: line item nói "ĐVT default 'Bộ' (lấy default từ catalog)" — không nói có quy đổi multi-ĐVT hay không. Fix: chốt MVP = 1 SKU chỉ 1 ĐVT cơ sở, không quy đổi (đơn giản), hoặc thêm bảng quy đổi vào danh mục SP + UI conversion hiển thị.

- **EC-13. Số âm / số 0 / decimal trong qty**. Expectation: qty phải > 0, integer (lốp không bán nửa cái), max sane (chống gõ nhầm 30000 thay 30). Spec gap: validation chỉ nhắc trường trống. Fix: thêm rule rõ vào Form pattern: `qty: integer > 0, ≤ 9999, cảnh báo nếu >500 "Số lượng bất thường, xác nhận?"`.

### Category: Multi-warehouse

- **EC-14. Phiếu chuyển kho khi user chỉ có quyền 1 trong 2 kho**. Expectation: spec đã ghi `[ASSUMPTION]` "user phải có quyền cả 2 kho" — cần UI cụ thể: dropdown "Đến kho" chỉ list kho user có quyền; nếu cần chuyển ra kho không có quyền → có flow "request admin tạo giúp"? Spec gap: chưa định nghĩa UI block. Fix: dropdown disable + tooltip "Anh chưa có quyền kho này. Liên hệ admin để được cấp."; hoặc cho phép chọn nhưng phiếu ở state "Chờ duyệt" do admin/owner kho đích duyệt.

- **EC-15. User bị remove khỏi kho đang có draft phiếu trong đó**. Expectation: draft cần được archive cho admin xem, hoặc cho user export trước khi mất. Spec gap: không nhắc draft khi quyền thay đổi. Fix: khi user mở draft thuộc kho đã mất quyền → readonly banner "Anh không còn quyền kho này. Liên hệ admin để khôi phục hoặc xoá nháp."

- **EC-16. "Tất cả các kho" + tạo phiếu mới**. Expectation: spec đã nói "trường Kho bắt buộc chọn (không default)" cho mode "Tất cả" — tốt, nhưng FAB "Tạo nhanh" trên mobile khi đang ở mode "Tất cả" phải làm gì? Spec gap: bottom sheet FAB không xử lý trường hợp này. Fix: sheet hiện 1 step trước "Chọn kho để tạo phiếu" → rồi mới mở form, hoặc nút tạo disable kèm hint "Chọn 1 kho cụ thể để tạo phiếu".

### Category: Import / Migration

- **EC-17. File Excel 2117 dòng với 12 dòng lỗi**. Expectation: wizard phải (a) hiển thị danh sách lỗi cụ thể với row index + cell + lý do, (b) cho phép tải về file lỗi để sửa, (c) hỏi user "Bỏ qua 12 dòng lỗi và import 2105 dòng còn lại?" vs "Huỷ toàn bộ". Spec gap: microcopy chỉ "12/2117 dòng có lỗi (xem chi tiết)" — không nói partial-import policy, không nói có rollback hay không. Fix: thêm flow Import có 3 step: Preview → Validate → Confirm (chọn partial vs all-or-nothing) + download "loi-import.xlsx" + import idempotent (re-import cùng file không tạo duplicate, dựa trên row-hash hoặc business key như mã SKU + ngày + ref).

- **EC-18. Import 2 lần — duplicate SKU hay update SKU**. Expectation: import danh mục SP — SKU đã tồn tại thì skip / update / báo lỗi? Import lịch sử phiếu — có dedupe theo mã phiếu không? Spec gap: hoàn toàn không nhắc. Fix: wizard step "Phát hiện X dòng trùng — chọn: Bỏ qua / Cập nhật / Báo lỗi"; với phiếu lịch sử bắt buộc dedupe theo `mã phiếu + ngày + kho` và refuse duplicate.

### Category: Auth

- **EC-19. Token expire khi đang điền form 30 phút**. Expectation: form không được tự discard data khi token hết; phải có silent refresh hoặc khi Save → detect 401 → mở modal "Phiên hết hạn, đăng nhập lại để lưu" — sau khi re-login, form data còn nguyên. Spec gap: không nhắc. Fix: kết hợp autosave draft (đã có `[ASSUMPTION]` mỗi 10s) + re-login modal preserve form state + token refresh proactive 5 phút trước expire.

### Category: Empty / Error

- **EC-20. Xoá warehouse khi còn tồn > 0 hoặc còn phiếu lịch sử**. Expectation: block xoá hard (vì sẽ làm mất audit) → chỉ cho "Vô hiệu hoá kho" (archive). Spec gap: `/quan-tri/kho` chỉ nói "CRUD" — không định nghĩa rule. Fix: thêm rule "Không xoá kho có movement; chỉ vô hiệu hoá" + dialog confirm "Kho này còn 142 SKU tồn + 3.450 phiếu lịch sử. Không thể xoá. Có thể Vô hiệu hoá để ẩn khỏi danh sách." Cùng logic cho user duy nhất xoá tài khoản admin chính mình → block với "Phải có ít nhất 1 admin khác trước khi tự xoá".

### Category: PDF / Print

- **EC-21. Phiếu in PDF 200 dòng line + tiếng Việt có dấu**. Expectation: phải định nghĩa (a) số dòng max/trang A4 + header lặp lại mỗi trang + page footer "Trang X/Y", (b) font tiếng Việt embed (không dùng Helvetica vì mất dấu), (c) page break không gãy giữa 1 dòng SKU. Spec gap: spec chỉ nói "In PDF" như feature, không có spec print layout. Fix: thêm subsection "Print PDF" với: A4 portrait, font Be Vietnam Pro embed, max 25 dòng/trang, header lặp (mã phiếu + kho + ngày), footer (trang + chữ ký), CSS `page-break-inside: avoid` cho row.

## Đã handle (skip)

(Không liệt kê — bao gồm: a11y floor, microcopy lỗi cụ thể, sync badge top bar, empty state có CTA, dark mode, breakpoints, density modes, anti-pattern modal lồng modal, IA closure check.)
