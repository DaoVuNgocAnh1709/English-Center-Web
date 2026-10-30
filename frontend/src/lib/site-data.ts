export const courses = [
  { slug: "english-starters", title: "English Starters", age: "6–8 tuổi", level: "Nền tảng", duration: "36 buổi", summary: "Làm quen phát âm, từ vựng và phản xạ giao tiếp qua hoạt động phù hợp với lứa tuổi.", description: "Khóa học giúp học viên nhỏ tuổi hình thành cảm giác tích cực với tiếng Anh, làm quen âm thanh, từ vựng và mẫu câu qua trò chơi, hình ảnh và hoạt động tương tác.", outcomes: ["Nhận biết và phát âm các âm cơ bản", "Sử dụng từ vựng theo chủ đề quen thuộc", "Tự tin tham gia hoạt động giao tiếp ngắn"] },
  { slug: "primary-english", title: "Primary English", age: "9–11 tuổi", level: "Tiểu học", duration: "48 buổi", summary: "Củng cố kiến thức học đường, đồng thời phát triển khả năng nghe, nói và sự tự tin.", description: "Chương trình kết hợp kiến thức trên trường với thực hành giao tiếp, dự án nhóm và kỹ năng trình bày phù hợp lứa tuổi.", outcomes: ["Củng cố ngữ pháp và từ vựng tiểu học", "Phát triển cân bằng bốn kỹ năng", "Hình thành thói quen tự học tại nhà"] },
  { slug: "secondary-boost", title: "Secondary Boost", age: "12–15 tuổi", level: "THCS", duration: "48 buổi", summary: "Hệ thống ngữ pháp, bốn kỹ năng và nội dung ôn tập theo mục tiêu học tập.", description: "Lộ trình dành cho học sinh THCS cần củng cố nền tảng, nâng cao kỹ năng học thuật và chuẩn bị cho các bài kiểm tra học kỳ.", outcomes: ["Hệ thống kiến thức ngữ pháp trọng tâm", "Luyện dạng bài kiểm tra học kỳ", "Cải thiện đọc hiểu và viết học thuật"] },
] as const;

export const materials = [
  { type: "Tài liệu", category: "Phát âm", level: "Nền tảng", title: "Bộ thẻ luyện phát âm cơ bản", summary: "Nhận biết âm và luyện đọc tại nhà với hướng dẫn ngắn gọn." },
  { type: "Bài tập", category: "Từ vựng", level: "Tiểu học", title: "Từ vựng theo chủ đề", summary: "Phiếu học có hình ảnh và bài tập củng cố sau mỗi chủ đề." },
  { type: "Đề thi", category: "Luyện thi", level: "THCS", title: "Đề ôn tập tiếng Anh học kỳ", summary: "Làm quen cấu trúc đề và kiểm tra kiến thức theo từng chặng." },
  { type: "Video", category: "Giao tiếp", level: "Mọi cấp độ", title: "Giao tiếp theo tình huống", summary: "Video thực hành mẫu, sẵn sàng kết nối kênh YouTube của trung tâm." },
] as const;

export const news = [
  { slug: "thoi-quen-hoc-tai-nha", category: "Kinh nghiệm học", title: "5 cách giúp trẻ duy trì thói quen tiếng Anh tại nhà", excerpt: "Những hoạt động ngắn và dễ áp dụng để tiếng Anh trở thành một phần tự nhiên trong ngày." },
  { slug: "hoc-tu-vung-hieu-qua", category: "Phương pháp", title: "Học từ vựng thế nào để hiểu và nhớ lâu hơn?", excerpt: "Tổ chức từ mới theo ngữ cảnh, ôn lặp lại và chủ động sử dụng trong câu." },
  { slug: "buoi-hoc-giao-tiep", category: "Hoạt động lớp", title: "Một buổi học giao tiếp tại trung tâm diễn ra như thế nào?", excerpt: "Khám phá cách giáo viên tạo cơ hội để mọi học viên đều được nói và nhận phản hồi." },
] as const;
