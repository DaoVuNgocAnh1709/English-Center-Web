const { CourseStatus, MaterialType, PrismaClient, Role } = require("@prisma/client");
const argon2 = require("argon2");

const prisma = new PrismaClient();

async function upsertUser(email, password, fullName, role) {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  return prisma.user.upsert({
    where: { email },
    update: { fullName, role, passwordHash },
    create: { email, passwordHash, fullName, role },
  });
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function main() {
  const demoPassword = required("DEMO_PASSWORD");
  const adminPassword = process.env.ADMIN_PASSWORD?.trim() || demoPassword;
  const adminEmail = required("ADMIN_EMAIL");
  const teacherEmail = required("TEACHER_EMAIL");
  const studentEmail = required("STUDENT_EMAIL");

  console.log(`[Seed] Seeding default users (Admin: ${adminEmail})...`);
  await upsertUser(adminEmail, adminPassword, "Quản trị viên Demo", Role.ADMIN);
  await upsertUser(teacherEmail, demoPassword, "Giáo viên Demo", Role.TEACHER);
  const student = await upsertUser(studentEmail, demoPassword, "Học viên Demo", Role.STUDENT);

  const courses = [
    {
      slug: "english-starters",
      title: "English Starters",
      ageRange: "6–8 tuổi",
      level: "Nền tảng",
      duration: "36 buổi",
      summary: "Làm quen tiếng Anh tự nhiên qua âm thanh, hình ảnh và hoạt động tương tác.",
      description: "Khóa học xây dựng phát âm, vốn từ và phản xạ giao tiếp đầu tiên cho học viên nhỏ tuổi.",
      sortOrder: 1,
    },
    {
      slug: "primary-english",
      title: "Primary English",
      ageRange: "9–11 tuổi",
      level: "Tiểu học",
      duration: "48 buổi",
      summary: "Củng cố nền tảng, phản xạ giao tiếp và bám sát nội dung học ở trường.",
      description: "Chương trình cân bằng kiến thức học đường với hoạt động giao tiếp và dự án theo chủ đề.",
      sortOrder: 2,
    },
    {
      slug: "secondary-boost",
      title: "Secondary Boost",
      ageRange: "12–15 tuổi",
      level: "THCS",
      duration: "48 buổi",
      summary: "Hệ thống ngữ pháp, phát triển bốn kỹ năng và luyện thi học kỳ.",
      description: "Lộ trình củng cố kiến thức, luyện dạng bài học thuật và chuẩn bị cho các kỳ kiểm tra.",
      sortOrder: 3,
    },
  ];

  for (const data of courses) {
    const course = await prisma.course.upsert({
      where: { slug: data.slug },
      update: data,
      create: { ...data, status: CourseStatus.PUBLISHED },
    });
    const lessons = [
      { title: "Bài học mở đầu", summary: "Làm quen mục tiêu và phương pháp học.", sortOrder: 1, isPreview: true },
      { title: "Luyện tập theo chủ đề", summary: "Bài giảng và tài liệu được lưu trên Google Drive.", sortOrder: 2, isPreview: false },
      { title: "Ôn tập và đánh giá", summary: "Bài tập tổng hợp cuối chặng.", sortOrder: 3, isPreview: false },
    ];
    await prisma.lesson.deleteMany({ where: { courseId: course.id } });
    await prisma.lesson.createMany({ data: lessons.map((lesson) => ({ ...lesson, courseId: course.id })) });
    if (data.slug === "primary-english") {
      await prisma.enrollment.upsert({
        where: { userId_courseId: { userId: student.id, courseId: course.id } },
        update: { progress: 35 },
        create: { userId: student.id, courseId: course.id, progress: 35 },
      });
    }
  }

  const materials = [
    {
      slug: "phat-am-co-ban",
      title: "Bộ thẻ luyện phát âm cơ bản",
      summary: "Tài liệu mẫu giúp học viên nhận biết âm và luyện đọc tại nhà.",
      category: "Phát âm",
      level: "Nền tảng",
      type: MaterialType.DOCUMENT,
      sortOrder: 1,
    },
    {
      slug: "tu-vung-tieu-hoc",
      title: "Từ vựng tiếng Anh tiểu học theo chủ đề",
      summary: "Phiếu học từ vựng có hình ảnh và bài tập ngắn.",
      category: "Từ vựng",
      level: "Tiểu học",
      type: MaterialType.WORKSHEET,
      sortOrder: 2,
    },
    {
      slug: "de-on-tap-hoc-ky",
      title: "Đề ôn tập tiếng Anh học kỳ",
      summary: "Cấu trúc đề mẫu để học viên THCS làm quen dạng bài.",
      category: "Luyện thi",
      level: "THCS",
      type: MaterialType.EXAM,
      sortOrder: 3,
    },
    {
      slug: "video-giao-tiep",
      title: "Video giao tiếp theo tình huống",
      summary: "Video mẫu kết hợp kênh YouTube của trung tâm.",
      category: "Giao tiếp",
      level: "Mọi cấp độ",
      type: MaterialType.VIDEO,
      sortOrder: 4,
    },
  ];

  for (const material of materials) {
    await prisma.material.upsert({
      where: { slug: material.slug },
      update: material,
      create: { ...material, isPublic: true, publishedAt: new Date() },
    });
  }

  console.log("[Seed] Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("[Seed] Error during seeding:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
