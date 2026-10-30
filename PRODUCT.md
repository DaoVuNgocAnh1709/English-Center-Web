# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Học viên từ mầm non đến THPT tại Hà Nội và Hưng Yên cần xem khóa học, luyện đề, nhận tài liệu và theo dõi tiến độ.
- Phụ huynh cần hiểu chương trình, đăng ký tư vấn và theo dõi hành trình học.
- Giáo viên cần nhập đề từ PDF, hiệu chỉnh câu hỏi, đăng học liệu và chấm bài.
- Chủ trung tâm/quản trị viên cần quản lý nội dung, ứng viên giáo viên, đăng ký tư vấn và hoạt động học tập.

## Product Purpose

Bright Path English là website thương hiệu kết hợp cổng học tập cho một trung tâm tiếng Anh quy mô vừa, hiện khoảng 100 học viên và có định hướng mở rộng. Sản phẩm giúp người dùng tìm hiểu trung tâm, luyện đề trực tuyến, tải học liệu, ứng tuyển giáo viên và vận hành nội dung theo vai trò.

## Positioning

Một trải nghiệm thống nhất giữa website thương hiệu địa phương và các công cụ vận hành học tập thực tế: PDF có thể trở thành đề web, bài làm được lưu/chấm, học liệu được phân loại và các vai trò dùng chung một hệ thống.

## Operating Context

- Học viên có thể làm đề khi đăng nhập hoặc bằng tên khách; tài khoản đăng nhập lưu lịch sử.
- Đề có thể được nhập từ PDF, chỉnh thủ công, có hoặc không có đáp án tự động.
- Giáo viên/admin vận hành qua dashboard riêng; học viên dùng website công khai và hồ sơ cá nhân.
- Hệ thống triển khai bằng Docker trên Ubuntu server, Nginx đứng trước frontend/backend, PostgreSQL lưu dữ liệu và Google Drive giữ tài liệu được liên kết.

## Capabilities and Constraints

- Frontend Next.js, backend NestJS, Prisma ORM, PostgreSQL, JWT cookie, Nginx và Docker Compose.
- Ba role: ADMIN, TEACHER, STUDENT; khách vẫn có thể xem tài liệu và làm đề công khai trong giai đoạn MVP.
- Không triển khai luyện nói AI ở giai đoạn hiện tại để kiểm soát chi phí.
- Nội dung thương hiệu, địa chỉ, số điện thoại, hồ sơ giáo viên và phản hồi khách hàng hiện có phần dữ liệu mẫu; không được biến dữ liệu mẫu thành tuyên bố thật.
- Tên Bright Path English hiện là tên làm việc và cần được chủ trung tâm xác nhận trước production.

## Brand Commitments

- Giao diện tiếng Việt, thân thiện với học viên và phụ huynh, chuyên nghiệp nhưng không mang cảm giác phần mềm doanh nghiệp lạnh lẽo.
- Hệ màu xanh navy và đỏ là nhận diện hiện tại; ưu tiên sự rõ ràng, tin cậy và dễ sử dụng.
- Website thương hiệu cần có sức thuyết phục như landing page, trong khi màn làm bài và dashboard phải tiết chế, tập trung vào tác vụ.

## Evidence on Hand

- Hai ảnh lớp học minh họa tại `frontend/public/images/`.
- Dữ liệu khóa học, đề, học liệu và tài khoản demo trong database/seed.
- Các PDF bài tập lớp 9 đã được dùng để kiểm chứng luồng nhập đề.
- Chưa có logo chính thức, ảnh cơ sở, ảnh giáo viên, chứng chỉ, testimonial hoặc thông tin liên hệ đã xác nhận; không được tự dựng bằng chứng này.

## Product Principles

1. Người dùng phải hiểu bước tiếp theo trong vài giây.
2. Nội dung học tập và trạng thái bài làm quan trọng hơn trang trí.
3. Khách có thể bắt đầu dễ dàng; đăng nhập bổ sung lịch sử và quản lý cá nhân.
4. Giáo viên nhập dữ liệu nhanh nhưng luôn có điểm rà soát trước khi xuất bản.
5. Tính đúng, bảo mật và khả năng vận hành bền bỉ quan trọng hơn tính năng phô diễn.

## Accessibility & Inclusion

Thiết kế phải hoạt động bằng bàn phím, có nhãn rõ ràng, tương phản đạt WCAG AA, touch target phù hợp mobile và tôn trọng `prefers-reduced-motion`.
