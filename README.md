# VJU2011 Public — campus tri ân 3D

Bản mã nguồn công khai độc lập của dự án campus 3D: dạo sân trường, gửi lời
chúc, trồng hoa, quản lý nội dung, đọc suy ngẫm và tham gia các hoạt động chung.
Đây là bản để học, tự triển khai và phát triển tiếp; không phải bản sao dữ liệu
hay cổng đăng nhập của hệ thống đang vận hành.

**Giấy phép:** [MIT](LICENSE) cho code và nội dung gốc. Texture, bản ghi âm CC0
và font có [thông tin nguồn/giấy phép riêng](THIRD_PARTY_NOTICES.md).

## Khác biệt của bản public

- Lịch sử Git mới; không mang các nhánh/tag, mô hình nhân vật đã rút, dữ liệu,
  ảnh QA hoặc tài liệu vận hành riêng của dự án gốc.
- 11 bài suy ngẫm Việt/Nhật và bài thơ bên hồ được viết mới cho bản public.
  Nội dung có hỗ trợ AI; bản Nhật chưa có nghiệm thu người bản ngữ.
- Logo tổ chức được thay bằng dấu hiệu đồ họa **20.11** của dự án.
- Âm thanh chó/mèo được tổng hợp bằng Web Audio, không kèm bản ghi stock.
- Giữ chức năng kiểm duyệt: chỉ chậu đã duyệt và công khai mới xuất hiện trong
  vườn chung; chủ chậu xem chậu chờ/từ chối trong **Hoa của tôi**.

Tên trường và mô hình campus mô tả bối cảnh dự án; MIT không cấp quyền thương
hiệu hoặc thể hiện sự bảo trợ. Bản public không tự kết nối tài khoản production.

## Chạy local

Cần **Node.js 24**, Git và npm. Trong PowerShell:

```powershell
git clone https://github.com/kienbh/VJU2011-public.git
cd VJU2011-public
npm ci
npm run security:install-hooks
$env:DATA_DIR = Join-Path (Get-Location).Path '.local/demo'
$env:TRIAL_ACCOUNTS = '1'
$env:ALLOW_SUBMISSIONS = '0'
$env:SEED_SAMPLES = '0'
npm run dev:all
```

Mở http://127.0.0.1:5173/ và chọn Khách hoặc Khách ẩn danh. API dùng cổng 8787.
`Ctrl+C` dừng cả hai. Trên shell POSIX, dùng `export NAME=value` cho các biến.
Nếu muốn thử gửi trên DB giả riêng, đặt `ALLOW_SUBMISSIONS=1` rồi khởi động lại.

Server đọc biến môi trường, không tự nạp `.env`. [.env.example](.env.example)
là mẫu, không có khóa thật. Token quản trị được tạo trong `DATA_DIR`; giữ riêng,
không chép vào source, issue hoặc trình duyệt của người khác. SSO chỉ bật khi
người triển khai tự cấu hình đầy đủ nhà cung cấp và khóa server của mình.

## Kiểm thử và release

```powershell
npm run security:setup
npm run security:history
npm run security:test
npm test
npm run build
```

Sau khi commit source sạch, chạy `npm run release:package`. Gói kết quả trong
`.local/releases/` có runtime, source, manifest và checksum. Quy trình từ chối
tệp public chưa được Git theo dõi, quét secret và kiểm archive sau giải nén.

Runtime cần Node 24: giải nén, đặt `DATA_DIR` ở ngoài thư mục release, cấu hình
biến môi trường rồi chạy `node server/start.mjs`. Server chỉ nghe loopback;
triển khai Internet cần reverse proxy HTTPS, `PUBLIC_ORIGIN` đúng domain và
cấu hình SSO riêng nếu dùng. Không đưa token hoặc DB vào thư mục `dist/`.

Kiểm trình duyệt tự động cần Playwright cài riêng. Có thể đặt
`VJU_PLAYWRIGHT_MODULE` trỏ đến module Playwright rồi chạy
`node scripts/qa-moderation-controls.mjs`. Kiểm giả lập không thay nghiệm thu
điện thoại, bàn phím/loa vật lý, SSO thực tế hoặc tải hạ tầng của bạn.

## Cấu trúc và đóng góp

`src/` chứa giao diện/3D, `server/` chứa API/SQLite, `content/` chứa nội dung gốc,
`public/` chứa tài nguyên đã chọn. Muốn sửa playlist, sửa
`content/reflections/original-public.json`, chạy `npm run content:generate`,
rồi kiểm cả hai ngôn ngữ. Không gắn lời mới cho tác giả bên ngoài.

Xem [CONTRIBUTING](CONTRIBUTING.md), [SECURITY](SECURITY.md) và
[phạm vi công khai](docs/public-edition.md). Không chạy thử ghi dữ liệu lên
bất kỳ hệ thống production nào khi chưa được người vận hành cho phép.
