# Chi tiêu Dashboard – Tóm tắt chức năng

## Nguồn dữ liệu
- Đọc Google Spreadsheet (public) bằng cách tải file `xlsx` từ link export.
- Tự động đọc **tất cả các sheet bắt đầu bằng “sao kê”** để lấy giao dịch.
- Đọc sheet **`Trạng thái đặt hộ`** để lấy tài khoản đăng nhập:
  - `username` = cột **F**
  - `password` = cột **G**
  - Tên người đặt (để lọc cho guest) = cột **C**
- Đọc sheet **`Danh mục`** (cột **A**) để lấy danh mục/keyword (text trong ngoặc `(...)`) dùng cho thống kê theo “Nội dung chi tiêu”.

## Đăng nhập (Admin / Guest)
- Trang đăng nhập dùng username/password từ sheet `Trạng thái đặt hộ`.
- Quyền **admin** được xác định bằng biến môi trường `ADMIN_USERNAMES` (danh sách username, cách nhau bởi dấu phẩy).
  - Ví dụ: `ADMIN_USERNAMES=B2B,admin`
- Mặc định, username **`Admin`** luôn được coi là admin.
- Các user còn lại được xem là **guest**.
  - Guest sẽ được lọc giao dịch theo `Người đặt hộ` khớp với **tên (cột C)** hoặc **username** (phòng trường hợp dữ liệu ghi theo username).

## Màn hình Admin
- Xem **tất cả** giao dịch (tất cả sheet “sao kê…” và tất cả thẻ/ngân hàng).
- Có filter theo **tháng (sheet sao kê)** và **loại thẻ trong tháng**.
- Có filter theo **Người đặt hộ**.
- Khi vừa đăng nhập hoặc F5, mặc định tự chọn **sheet mới nhất** theo MMYYYY. User vẫn có thể chọn `Tất cả` để xem toàn bộ dữ liệu.
- Thống kê:
  - Tổng chi tiêu
  - Tổng nợ (các dòng “Chưa trả” có “Người đặt hộ”)
  - Tổng theo **ngân hàng/thẻ**
  - Tổng theo **người đặt** (tổng/đã trả/chưa trả)
  - Tổng theo **danh mục** (dựa theo keyword trong “Nội dung chi tiêu”)
- Bảng giao dịch có lọc theo: từ khóa, thẻ, trạng thái.
- Nút **Refresh sheet** để buộc tải lại dữ liệu từ Google Sheet (xóa cache).
- Nút **Xuất Excel** để xuất file Excel chi tiết theo bộ lọc hiện tại + các chỉ số: `Tổng nợ (Chưa trả)`, `Đã trả`, `Chưa trả`.

## Màn hình Guest
- Chỉ xem các dòng mà guest đó đã đặt (lọc theo `Người đặt hộ` khớp với tên ở cột C của sheet `Trạng thái đặt hộ`).
- Có filter theo **tháng (sheet sao kê)**.
- Khi vừa đăng nhập hoặc F5, mặc định tự chọn **sheet mới nhất** theo MMYYYY. User vẫn có thể chọn `Tất cả` để xem toàn bộ dữ liệu.
- Hiển thị tổng **Đã trả / Chưa trả** theo trạng thái.
- Bảng giao dịch có lọc/tìm kiếm tương tự.
### Thanh toán (Guest)
- Hiển thị khối “Thông tin thanh toán” gồm: **QR**, ngân hàng `TP Bank`, số tài khoản `06314677501`, **Số tiền = Chưa trả**, và **Nội dung chuyển khoản** theo mẫu: `{username} thanh toán tiền đặt hộ tháng {MMYYYY}`.
- QR được lấy từ **hình ảnh** trong sheet `Danh mục` (ưu tiên hình gắn trong sheet; nếu không có sẽ fallback theo URL/công thức nếu có).
- Mỗi trường có nút **Copy** để sao chép nhanh.
- QR được hiển thị kích thước lớn và có nút **Ẩn/Hiện chi tiết** để dễ quét bằng app ngân hàng.
- Bố cục Guest: QR ở bên trái, thông tin ngân hàng ở bên phải (trên màn hình rộng).
### Lưu ý quyền Guest
- Guest **không** có filter theo thẻ.
- Guest **không** hiển thị: `Tổng tiền theo ngân hàng/thẻ`, `Tổng tiền theo người đặt`, và chỉ số `Thẻ (ngân hàng)`.
- Guest **không** hiển thị: `Tổng tiền theo danh mục (keyword)`.
- Trong “Danh sách giao dịch”, Guest **không** hiển thị cột `Thẻ`.
- Trong “Danh sách giao dịch”, có cột `STT` tăng dần theo danh sách đang lọc.
- Nút **Xuất Excel** trong “Danh sách giao dịch” sẽ xuất đúng dữ liệu đang hiển thị theo filter/tìm kiếm/trạng thái.

## Xuất Excel
- File Excel xuất đầy đủ cột như bảng “Danh sách giao dịch” (tùy quyền có/không có cột `Thẻ`).
- Cột `Tháng` được xuất theo định dạng `MMYYYY`.
- Cột `Số tiền` là kiểu số và hiển thị dạng `#,##0` (comma style, 0 chữ số thập phân), có set độ rộng cột cố định để dễ đọc.

## Công nghệ
- Frontend: React + Tailwind CSS (Vite).
- Backend: Node.js (Express) + JWT cookie session.

## Chạy dự án (local)
1) Tạo file `C:\\Chi_Tieu_Dashboard\\server\\.env` dựa trên `C:\\Chi_Tieu_Dashboard\\server\\.env.example` và chỉnh `JWT_SECRET`.
2) Chạy dev:
   - `npm run dev`
3) Truy cập:
   - Frontend: `http://localhost:5173`
   - Backend: `http://localhost:3001`
