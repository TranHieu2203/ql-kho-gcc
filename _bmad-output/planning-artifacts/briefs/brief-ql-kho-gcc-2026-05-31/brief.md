---
title: "Product Brief — Phần mềm Quản lý Kho Lốp xe (ql-kho-gcc)"
status: approved
created: 2026-05-31
updated: 2026-05-31
owner: HieuTV-QL-Kho
language: vi
---

# Product Brief: Phần mềm Quản lý Kho Lốp xe (ql-kho-gcc)

## Tóm tắt điều hành

**ql-kho-gcc** là một web app quản lý kho lốp xe tải, thiết kế để thay thế file Excel `THEO DÕI TỒN KHO LỐP MD-Final.xlsx` hiện được dùng để theo dõi nhập – xuất – tồn. Phần mềm giữ nguyên ngôn ngữ nghiệp vụ mà người dùng đã quen (Danh mục, Phiếu Nhập, Phiếu Xuất, NXT, ĐVT Bộ/Chiếc, mã hàng theo Thương hiệu + Size + Pattern), nhưng giải quyết những điểm Excel không làm được: tồn kho cập nhật thời gian thực cho nhiều người dùng cùng lúc, ràng buộc bắt buộc khi nhập liệu (không cho thiếu ngày / thiếu số lượng / hỏng lookup), và quản lý đồng thời nhiều kho với nghiệp vụ chuyển hàng giữa các kho.

Sản phẩm chạy dưới dạng web app responsive (dùng tốt trên điện thoại/tablet tại kho), tự host trên hạ tầng của người dùng, và có khả năng hoạt động khi mất internet — đồng bộ lại khi có mạng. MVP tập trung vào lõi nghiệp vụ và độ tin cậy của tồn kho, chưa quản lý tiền (giá, công nợ).

## Vấn đề

Hiện tại nghiệp vụ kho lốp chạy trên một file Excel 4 sheet (Danh mục, Nhập kho, Xuất kho, NXT). Chính file Excel này — khi đọc dữ liệu thực tế — đã phơi bày những vấn đề mà người dùng sẽ tiếp tục gặp nếu giữ nguyên cách làm (chi tiết cấu trúc và số liệu sheet xem ở `addendum.md`):

- **Dữ liệu không đáng tin.** Nhiều dòng XUẤT KHO bị thiếu ngày, thiếu số lượng. Sheet NXT có dòng `#N/A` do công thức lookup không tìm thấy mã hàng. Hệ quả: con số tồn cuối kỳ có thể sai mà không ai phát hiện.
- **Không thể dùng đồng thời.** Excel khoá file khi 1 người mở để sửa — nhiều người dùng không thể cùng nhập phiếu, không có khái niệm "tồn realtime".
- **Không có khái niệm nhiều kho.** Toàn bộ giao dịch trong file là *chung một kho* — khi mở rộng sang 2+ kho phải tách file, mỗi lần đối chiếu phải copy-paste thủ công.
- **Khách hàng ghi tự do trong cột "Ghi chú"** — "Hải – Nghệ An", "Hồng Anh- Bắc Ninh", "a đạt đã trả lại madin"... — khiến việc tra cứu lịch sử theo khách trở nên bất khả thi (mỗi người gõ một kiểu).
- **Không có audit trail.** Sửa một con số trong Excel không để lại dấu vết — không biết ai sửa, sửa khi nào, sửa gì.

Người chịu hậu quả trực tiếp là chủ kho và thủ kho: tốn nhiều thời gian đối soát cuối kỳ, tranh cãi khi tồn lệch không có cơ sở giải quyết, và khi quy mô tăng (thêm kho, thêm người) thì Excel không còn khả năng mở rộng.

## Giải pháp

Một web app gọn nhẹ, giữ đúng mô hình tư duy mà người dùng đang có với Excel — không bắt họ học lại nghiệp vụ — nhưng đặt tồn kho lên một CSDL trung tâm để mọi thao tác Nhập/Xuất/Chuyển kho đều cập nhật tức thì cho mọi người dùng.

**Trải nghiệm cốt lõi (MVP)**:
- Đăng nhập, chọn kho mình đang đứng → thấy ngay bảng "Tồn kho hiện tại" của kho đó.
- Tạo Phiếu Nhập / Phiếu Xuất bằng form có validate: ngày bắt buộc, số lượng > 0 bắt buộc, mã hàng chọn từ Danh mục (không được gõ tay sai chính tả như sheet hiện tại).
- Tạo Phiếu Chuyển kho: 1 thao tác → giảm kho nguồn + tăng kho đích trọn vẹn (không thể chỉ giảm mà không tăng).
- Xem báo cáo "Nhập – Xuất – Tồn" giống sheet NXT, lọc được theo kỳ / kho / sản phẩm.
- In phiếu PDF khổ A4 (Nhập, Xuất, Chuyển) để ký đóng dấu.
- Xuất báo cáo ra Excel để gửi cấp trên / lưu trữ.
- One-shot import: nạp ~2.000 dòng lịch sử Nhập/Xuất hiện có vào hệ thống lần đầu — để không mất dữ liệu cũ và có thể nhìn lại lịch sử.

**Trên thiết bị**: giao diện responsive — thủ kho dùng điện thoại quét nhanh tồn kho hoặc nhập phiếu ngay khi nhận hàng. Khi mất sóng tại kho, vẫn nhập được; có mạng thì đồng bộ.

## Điểm khác biệt

So với các phần mềm kho phổ thông trên thị trường (KiotViet, Sapo, Misa...), điểm khác biệt thực tế của ql-kho-gcc:

- **Sát nghiệp vụ Excel hiện hành.** Phần mềm phổ thông buộc người dùng tuân theo data model của họ và thường quá nặng tính năng (CRM, POS, kế toán) so với nhu cầu chỉ quản lý tồn kho. ql-kho-gcc giữ đúng cột, đúng tên, đúng ĐVT, đúng khái niệm "Khách đặt" — không có chi phí đào tạo lại.
- **Vừa đủ.** Không gánh tính năng không cần ở giai đoạn này — đẩy ưu tiên về độ tin cậy của con số tồn và tốc độ nhập liệu, không phải số lượng module.

## Đối tượng phục vụ

**Người dùng chính**:
- **Chủ kho / quản lý** — cần nhìn nhanh tồn kho tổng quát của tất cả các kho, xuất báo cáo cuối kỳ, kiểm soát ai đã làm gì.
- **Thủ kho** — người trực tiếp nhập phiếu Nhập/Xuất hàng ngày, thường dùng điện thoại/tablet tại kho khi nhận/giao hàng. Đây là người dùng *thường xuyên nhất*, UX nhập liệu phải tối ưu cho họ.

**Quy mô đầu**: 1–2 kho, 1–3 người dùng đồng thời, dưới 100 SKU sản phẩm, ước tính vài chục giao dịch/ngày khi cao điểm.

**Phạm vi giai đoạn này KHÔNG phục vụ**: kế toán, sales/CRM, khách hàng cuối, đối tác/NCC truy cập từ ngoài.

## Tiêu chí thành công

MVP coi là thành công khi:

1. **Thay thế hoàn toàn Excel** trong vòng [ASSUMPTION: 1 tháng] kể từ go-live — không còn phải mở `THEO DÕI TỒN KHO LỐP MD-Final.xlsx` để tra cứu hay nhập phiếu mới.
2. **Tồn kho thực tế khớp với hệ thống** sau khi kiểm kho cuối kỳ đầu tiên (sai số 0 đơn vị trên SKU đã có giao dịch).
3. **Nhập một phiếu Xuất hoàn chỉnh trong ≤ 30 giây** trên điện thoại.
4. **Không có dòng dữ liệu lỗi** kiểu `#N/A`, ngày trống, hoặc số lượng trống được lưu vào hệ thống — validate bắt buộc trước khi save.
5. **Nhiều người dùng cùng lúc không xung đột** — 2 thủ kho cùng tạo phiếu tại cùng một thời điểm, tồn kho cập nhật chính xác cho cả hai.

## Phạm vi

### Trong MVP

- **Quản trị danh mục sản phẩm** (CRUD): Mã hàng, Thương hiệu, Kích thước (Size), Mã gai (Pattern), ĐVT (Bộ/Chiếc), trạng thái active/inactive.
- **Quản trị kho** (CRUD): Tên kho, địa chỉ, người phụ trách.
- **Quản trị người dùng + phân quyền cơ bản** (Admin / Thủ kho — [ASSUMPTION]): đăng nhập, đổi mật khẩu, gán user vào kho được phép thao tác.
- **Phiếu Nhập kho**: chọn kho đích, chọn sản phẩm từ Danh mục, ngày, số lượng, ĐVT, ghi chú. Validate bắt buộc.
- **Phiếu Xuất kho**: tương tự, có kiểm soát xuất quá tồn ([ASSUMPTION] — có thể cấu hình: cảnh báo hay chặn cứng).
- **Phiếu Chuyển kho** (trọn vẹn giữa 2 kho — không thể chỉ giảm 1 đầu).
- **Báo cáo Nhập – Xuất – Tồn** kiểu sheet NXT: lọc theo kỳ, kho, sản phẩm; xuất Excel.
- **In phiếu PDF A4** (Nhập / Xuất / Chuyển) để ký.
- **Import one-shot lịch sử Excel** (~2.000 dòng) — kèm báo cáo dòng lỗi cần xử lý tay.
- **Audit log** (ai làm gì lúc nào) — tối thiểu trên các phiếu và sản phẩm.
- **Responsive mobile + PWA offline-capable** ([ASSUMPTION] — kỹ thuật chi tiết ở Architecture; offline nghĩa là nhập được khi mất net, đồng bộ khi có lại; xử lý xung đột ở mức simple last-write-wins cho v1).

### KHÔNG trong MVP (dời sang giai đoạn sau, không đào sâu ở brief)

- Quản lý giá (giá nhập, giá xuất, giá vốn), doanh thu, công nợ.
- Customer master + Reservation (cột "Khách đặt"). MVP giữ trường "Ghi chú" tự do giống Excel hiện tại; chuẩn hóa khách hàng sang v2.
- Quản lý nhà cung cấp (Supplier).
- Mã vạch / QR.
- Tích hợp API ra ngoài (kế toán, POS, đối tác).
- Mobile app native.
- Multi-tenant (nhiều công ty trên cùng 1 hệ thống).
- Báo cáo nâng cao (BI, biểu đồ, forecast).

### Giả định kỹ thuật cần PRD/Architecture xác nhận

- **[ASSUMPTION] Stack & deploy**: Web app dạng PWA + backend nhẹ + CSDL phù hợp quy mô nhỏ, deploy trên 1 server tại chỗ. Lựa chọn cụ thể (ngôn ngữ, framework, database) chốt ở phase Architecture.
- **[ASSUMPTION] Cơ chế offline**: cache cục bộ + đồng bộ khi có mạng, xử lý xung đột theo nguyên tắc "ghi sau thắng" (last-write-wins) ở v1 — rà lại nếu thực tế có nhiều xung đột.

## Tầm nhìn

Nếu MVP chạy ổn, ql-kho-gcc có thể tiến hóa thành nền tảng vận hành cho hộ kinh doanh / công ty nhỏ ngành lốp theo hướng: thêm khách hàng & đặt trước, quản lý tiền & công nợ, nhà cung cấp & PO, mã vạch/QR. Roadmap chi tiết theo từng version để ở `addendum.md` và sẽ được làm rõ ở PRD.

Tầm nhìn này không phải cam kết — chỉ là *trục* để các quyết định trong MVP không khoá đường đi sau (ví dụ: data model phải để chỗ cho giá, cho customer FK ngay từ đầu, kể cả khi MVP chưa dùng).
