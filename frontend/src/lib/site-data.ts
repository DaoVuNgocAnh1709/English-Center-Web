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
  {
    slug: "thoi-quen-hoc-tai-nha",
    category: "Kinh nghiệm học",
    date: "28.10.2026",
    title: "5 cách giúp trẻ duy trì thói quen tiếng Anh tại nhà",
    excerpt: "Những hoạt động ngắn và dễ áp dụng để tiếng Anh trở thành một phần tự nhiên trong ngày.",
    body: [
      "Thói quen quan trọng hơn thời lượng. Mười lăm phút mỗi ngày đều đặn mang lại hiệu quả tốt hơn hai giờ dồn vào cuối tuần, vì trẻ được tiếp xúc lặp lại và ghi nhớ tự nhiên.",
      "1. Gắn tiếng Anh với một khung giờ cố định, ví dụ sau bữa tối hoặc trước giờ đi ngủ. Khi đã thành nếp, trẻ sẽ không còn coi đó là “bài tập”.",
      "2. Dùng những gì trẻ đang thích: bài hát, truyện tranh, phim hoạt hình ngắn có phụ đề tiếng Anh. Nội dung gần gũi giúp trẻ chủ động muốn nghe tiếp.",
      "3. Biến đồ vật trong nhà thành từ vựng: dán nhãn tiếng Anh lên tủ lạnh, cửa, bàn học. Mỗi tuần đổi một nhóm chủ đề mới.",
      "4. Hỏi đáp ngắn bằng tiếng Anh trong sinh hoạt hằng ngày như “What do you want to eat?” hay “What colour is it?”. Không cần câu dài, quan trọng là phản xạ.",
      "5. Ghi nhận tiến bộ nhỏ: khen khi trẻ dùng đúng một từ mới, lưu lại video trẻ đọc truyện để cùng xem lại sau một tháng.",
      "Phụ huynh không cần giỏi tiếng Anh để đồng hành. Sự quan tâm đều đặn và không khí thoải mái mới là yếu tố quyết định.",
    ],
  },
  {
    slug: "hoc-tu-vung-hieu-qua",
    category: "Phương pháp",
    date: "20.10.2026",
    title: "Học từ vựng thế nào để hiểu và nhớ lâu hơn?",
    excerpt: "Tổ chức từ mới theo ngữ cảnh, ôn lặp lại và chủ động sử dụng trong câu.",
    body: [
      "Học thuộc danh sách từ rời rạc thường nhanh quên vì não không có “móc” để gắn thông tin. Cách hiệu quả hơn là học từ trong ngữ cảnh.",
      "Học theo cụm và câu: thay vì chỉ nhớ “decision”, hãy nhớ “make a decision” và đặt một câu về chính bản thân. Câu càng gần với trải nghiệm thật, càng dễ nhớ.",
      "Ôn lặp lại ngắt quãng: xem lại từ mới sau 1 ngày, 3 ngày, 1 tuần và 2 tuần. Mỗi lần ôn chỉ mất vài phút nhưng giúp chuyển từ vựng vào trí nhớ dài hạn.",
      "Chủ động sử dụng: viết nhật ký ngắn, nói lại nội dung bài đọc bằng lời của mình, hoặc dạy lại cho bạn cùng lớp. Dùng từ là cách kiểm tra mình đã thật sự hiểu hay chưa.",
      "Tại Bright Path, mỗi buổi học đều có phần ôn từ vựng của buổi trước qua trò chơi và tình huống giao tiếp, giúp học viên nhớ lâu mà không áp lực.",
    ],
  },
  {
    slug: "buoi-hoc-giao-tiep",
    category: "Hoạt động lớp",
    date: "12.10.2026",
    title: "Một buổi học giao tiếp tại trung tâm diễn ra như thế nào?",
    excerpt: "Khám phá cách giáo viên tạo cơ hội để mọi học viên đều được nói và nhận phản hồi.",
    body: [
      "Một buổi học giao tiếp tại Bright Path kéo dài khoảng 90 phút và được thiết kế để mỗi học viên đều có thời gian nói thực tế, không chỉ ngồi nghe.",
      "Khởi động (10 phút): trò chơi ngắn hoặc câu hỏi mở về chủ đề trong ngày giúp học viên làm quen và mạnh dạn hơn.",
      "Đầu vào ngôn ngữ (20 phút): giáo viên giới thiệu từ vựng, mẫu câu qua video, hình ảnh hoặc đoạn hội thoại mẫu.",
      "Thực hành theo cặp và nhóm (40 phút): học viên đóng vai, phỏng vấn nhau, giải quyết tình huống. Giáo viên đi từng nhóm để lắng nghe và gợi ý.",
      "Phản hồi và tổng kết (20 phút): giáo viên chỉ ra lỗi phổ biến, khen ngợi điểm tốt và giao nhiệm vụ nhỏ để luyện thêm ở nhà.",
      "Sau mỗi buổi, phụ huynh có thể theo dõi nhận xét và tiến độ của con trên hồ sơ học viên.",
    ],
  },
] as const;
