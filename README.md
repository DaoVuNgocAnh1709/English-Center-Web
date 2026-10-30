# English Center Web

## Bản duyệt luồng luyện đề, học liệu và tuyển giáo viên

- Admin và giáo viên dùng sidebar riêng tại `/admin` và `/giao-vien/dashboard`.
- Giáo viên tải PDF nguồn một lần, chọn khoảng trang và hệ thống tự đọc lớp chữ để tạo câu hỏi web. Màn hình duyệt cho phép sửa phần hướng dẫn, nội dung, lựa chọn, loại câu, điểm và đáp án; vẫn hỗ trợ nhập đáp án hàng loạt (`1:A, 2:C`) hoặc thêm/xóa câu thủ công. Giáo viên gửi duyệt; chỉ admin xuất bản.
- Khách nhập tên nhanh rồi làm câu hỏi trực tiếp tại `/luyen-de`; bài được tự lưu bằng mã phiên khách. Học viên đăng nhập được tự động khôi phục bài nháp và xem trạng thái/kết quả/nhận xét trong lịch sử cá nhân.
- Đề có thể xuất bản khi đã có câu hỏi dù chưa nhập đáp án. Câu có đáp án được chấm ngay; câu tự luận hoặc chưa có đáp án chuyển sang `chờ chấm`. Giáo viên/admin theo dõi tiến độ bài nháp, xem bài đã nộp, nhập điểm từng câu và gửi nhận xét trong tab **Bài làm học viên**.
- Bộ lọc cấp học của luyện đề và thư viện hỗ trợ `Mầm non`, `Tiểu học`, `THCS`, `THPT`.
- Các luồng nhập tên, rà soát trước khi nộp, duyệt câu hỏi và xem/chấm bài dùng modal có giới hạn chiều cao, không đẩy danh sách quản trị xuống. Trước khi nộp, học viên thấy đầy đủ câu đã làm và câu còn bỏ trống, có thể quay lại câu cụ thể hoặc xác nhận nộp thiếu.
- Khi chọn một đề ở danh sách, hệ thống mở modal thông tin đề và lịch sử gần nhất của tài khoản trước khi bắt đầu. Sau khi nộp, màn làm bài được thay bằng màn hoàn thành riêng với các lựa chọn xem chi tiết, làm lại hoặc quay về danh sách. Đáp án trắc nghiệm được chuẩn hóa theo chữ cái để `A`, `A.` và `A. nội dung` được chấm nhất quán.
- Màn chấm của giáo viên hiển thị đầy đủ nội dung câu, các phương án, phương án học viên chọn, đáp án chuẩn và trang PDF nguồn; không chỉ hiển thị mỗi chữ cái lựa chọn.
- Trang chi tiết tài liệu dùng khung xem PDF vừa viewport và cột gợi ý tối đa 4 tài liệu liên quan theo danh mục, lớp, cấp học và loại nội dung.
- Giáo viên tải PDF/DOCX cho thư viện; admin duyệt trước khi công khai. Trang `/thu-vien` có bộ lọc cố định bên trái theo từ khóa, cấp học, lớp, danh mục và loại tài liệu; phần kết quả ở bên phải.
- Trang `/dao-tao-giao-vien` có form ứng tuyển; admin xem và đổi trạng thái hồ sơ. Form không tự tạo tài khoản giáo viên.
- Tệp demo lưu ở Docker volume `uploads_data`, không tự đẩy lên Google Drive. Khi triển khai thật cần chọn nơi lưu, quyền chia sẻ, lịch sao lưu và chính sách lưu giữ dữ liệu.
- Đã nhập PDF đề mẫu 103 trang vào môi trường local và cắt Unit 1 (trang 1–5) thành bản nháp. Bộ trích xuất hiện nhận diện được **48 câu web** từ khoảng trang này. PDF bài tập Anh 9 cũng đã nhập vào thư viện dưới dạng bản nháp. Chưa công khai hai tài liệu người dùng cung cấp vì cần xác nhận đáp án/quyền sử dụng. Đề 2 câu công khai đã được ghi rõ là bản demo kỹ thuật, không phải nội dung chính thức.
- Trích xuất tự động hiện hỗ trợ PDF có lớp chữ như file mẫu. Với PDF scan chỉ có ảnh, hệ thống cảnh báo để giáo viên dùng OCR hoặc thêm câu thủ công. Bố cục PDF phức tạp vẫn cần giáo viên rà soát trước khi xuất bản.

Sau khi cập nhật schema, chạy `docker compose exec backend npx prisma migrate deploy` trước khi thử luồng mới. Dữ liệu upload nằm trong volume riêng, cần sao lưu cùng PostgreSQL.

Website và cổng học tập cho trung tâm tiếng Anh, tách riêng Next.js frontend và NestJS backend.

## Tính năng đã hoàn thành

### Giai đoạn 1 — Website thương hiệu

- Landing page responsive theo phong cách website giáo dục hiện đại.
- Form đăng ký học thử lưu PostgreSQL.
- SEO cơ bản, sitemap, robots và metadata.

### Giai đoạn 2 — Nội dung và học liệu

- Trang giới thiệu, khóa học, chi tiết khóa học, tin tức và liên hệ.
- Thư viện tài liệu, bài tập, đề thi và video.
- Cấu trúc bài học theo từng khóa.
- Sẵn sàng lưu liên kết chia sẻ Google Drive và YouTube.
- Trang chương trình đào tạo giáo viên.

### Giai đoạn 3 — Cổng vận hành

- JWT access/refresh token bằng HttpOnly cookie, mật khẩu Argon2id.
- Phân quyền `ADMIN`, `TEACHER`, `STUDENT`.
- Học viên xem khóa đã ghi danh, tiến độ và danh sách bài học.
- Giáo viên thêm học liệu Google Drive/YouTube.
- Quản trị xem thống kê, danh sách đăng ký và cập nhật trạng thái lead.
- Docker Compose, Nginx, PostgreSQL, migration và dữ liệu mẫu.

Phần luyện nói bằng AI không nằm trong phạm vi hiện tại.

## Chạy local

```bash
cp .env.example .env
# Điền mật khẩu và secret riêng trong .env trước khi chạy.
docker compose up --build -d
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run prisma:seed
```

Mở `http://localhost:8080`.

## Tài khoản phát triển

Email và mật khẩu của học viên, giáo viên và quản trị viên được đọc từ `.env` khi chạy seed. Không ghi thông tin đăng nhập thật trong mã nguồn, README hoặc giao diện đăng nhập. File `.env` đã được Git bỏ qua; `.env.example` chỉ chứa placeholder.

## Kiểm tra

```bash
cd frontend
npm run typecheck
npm run lint
npm run build
npm run test:e2e

cd ../backend
npm run typecheck
npm test
npm run build
```

## Thông tin cần trung tâm cung cấp

- Tên thương hiệu, logo, màu sắc và slogan chính thức.
- Hotline, email, địa chỉ, Google Maps và giờ làm việc.
- Danh sách khóa học, học phí, lịch học và quy mô lớp.
- Hồ sơ, ảnh và chứng chỉ của giáo viên.
- Ảnh thật của lớp học, học viên và cơ sở.
- Phản hồi học viên/phụ huynh đã được phép công bố.
- Google Drive folder, quyền chia sẻ và kênh YouTube chính thức.
- Danh sách tài khoản học viên, giáo viên và phân lớp.
- Tên miền, máy chủ Ubuntu và email quản trị.

Dữ liệu hiện tại là dữ liệu minh họa, không được coi là thông tin chính thức của trung tâm.
