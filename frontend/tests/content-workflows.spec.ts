import { expect, test } from "@playwright/test";

test("matching and ordering questions support touch-friendly interactions", async ({ page }) => {
  const exam = {
    id: "interactive-exam",
    title: "Đề tương tác",
    summary: "Kiểm thử nối cặp và sắp xếp",
    grade: 9,
    durationMinutes: 20,
    source: { fileName: "interactive.pdf", mimeType: "application/pdf" },
    questions: [
      {
        position: 1, sourceLabel: "1", section: "Matching", content: "Match each word with its meaning.", options: [], sourcePage: 1,
        kind: "SHORT_TEXT", taskType: "MATCHING", points: 1,
        interactionData: { matchingLeft: ["artisan", "pottery"], matchingRight: ["a skilled worker", "objects made from clay"], orderingItems: [] },
      },
      {
        position: 2, sourceLabel: "2", section: "Ordering", content: "Put the steps in order.", options: [], sourcePage: 1,
        kind: "SHORT_TEXT", taskType: "ORDERING", points: 1,
        interactionData: { matchingLeft: [], matchingRight: [], orderingItems: ["Shape the pot", "Mix the clay", "Fire it"] },
      },
    ],
  };
  await page.route("**/api/auth/me", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.route("**/api/public-content/exams/interactive-test", (route) => route.fulfill({ json: exam }));
  await page.route("**/api/public-content/exams/interactive-exam/attempts/start", (route) => route.fulfill({
    json: { attemptId: "attempt-1", guestToken: "guest-1", participantName: "Khách test", status: "DRAFT", answers: {}, savedAt: new Date().toISOString() },
  }));
  await page.route("**/api/public-content/exams/interactive-exam/attempts/attempt-1", (route) => route.fulfill({ json: { ok: true } }));

  await page.goto("/luyen-de/interactive-test");
  await page.getByLabel("Họ và tên").fill("Khách test");
  await page.getByRole("button", { name: "Bắt đầu làm bài" }).click();

  await page.getByRole("button", { name: /a skilled worker/ }).click();
  await page.getByRole("button", { name: "Chọn đáp án cho mục 1" }).click();
  await expect(page.getByRole("button", { name: /Mục 1 đã nối với a skilled worker/ })).toBeVisible();

  await page.getByRole("button", { name: "Đưa mục 2 lên" }).click();
  await expect(page.locator("#question-2 li").first()).toContainText("Mix the clay");
  await expect(page.getByText("Đã trả lời 2/2 câu")).toBeVisible();
});

test("public exam page shows filters and does not expose answer keys", async ({
  page,
  request,
}) => {
  await page.goto("/luyen-de");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Chọn đề phù hợp",
  );
  await expect(page.getByLabel("Cấp học")).toBeVisible();
  await expect(
    page.getByLabel("Cấp học").locator('option[value="PRESCHOOL"]'),
  ).toHaveText("Mầm non");
  const infoButtons = page.getByRole("button", { name: "Xem thông tin đề" });
  if (await infoButtons.count()) {
    await infoButtons.first().click();
    await expect(page.getByRole("dialog")).toContainText(
      "Đăng nhập để lưu lịch sử làm bài",
    );
    await page.getByRole("button", { name: "Đóng cửa sổ" }).click();
  }
  const response = await request.get("/api/public-content/exams");
  expect(response.ok()).toBeTruthy();
  const items = (await response.json()) as { slug: string }[];
  if (!items.length) return;
  const detail = await request.get(
    `/api/public-content/exams/${items[0].slug}`,
  );
  expect(detail.ok()).toBeTruthy();
  expect(await detail.text()).not.toContain("correctAnswer");
  await page.goto(`/luyen-de/${items[0].slug}`);
  await expect(
    page.getByRole("heading", { name: "Ghi nhận người làm bài" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Họ và tên").fill("Khách Playwright");
  await page.getByRole("button", { name: "Bắt đầu làm bài" }).click();
  await expect(
    page.getByRole("heading", { name: "Tiến độ bài làm" }),
  ).toBeVisible();
  const firstChoice = page.locator("#question-1 input[type=radio]").first();
  if (await firstChoice.count()) await firstChoice.check();
  if ((page.viewportSize()?.width || 0) >= 1024) {
    await page.locator("#question-28").scrollIntoViewIfNeeded();
    const progressBox = await page.getByRole("complementary").boundingBox();
    expect(progressBox).not.toBeNull();
    expect(progressBox!.y).toBeGreaterThanOrEqual(90);
    expect(progressBox!.y + progressBox!.height).toBeLessThanOrEqual(
      page.viewportSize()!.height,
    );
  }
  await page.getByRole("button", { name: "Kiểm tra và nộp bài" }).click();
  await expect(
    page.getByRole("heading", { name: "Rà soát trước khi nộp bài" }),
  ).toBeVisible();
  await expect(page.getByText(/câu chưa trả lời/)).toBeVisible();
  await expect(page.getByText(/Đã trả lời:/).first()).toBeVisible();
  await page.getByRole("button", { name: /Hoàn thành và nộp bài/ }).click();
  await expect(
    page.getByRole("heading", { name: "Hoàn thành bài luyện" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Xem chi tiết bài làm" }).click();
  await expect(
    page.getByRole("heading", { name: "Chi tiết bài làm" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Đóng cửa sổ" }).click();
  await page.getByRole("link", { name: "Quay lại các bài luyện" }).click();
  await page.getByRole("button", { name: "Xem thông tin đề" }).first().click();
  await page.getByRole("button", { name: "Bắt đầu làm bài" }).click();
  await expect(
    page.getByRole("heading", { name: "Ghi nhận người làm bài" }),
  ).toBeVisible();
  await expect(page.getByLabel("Họ và tên")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Hoàn thành bài luyện" }),
  ).toHaveCount(0);
});

test("material detail keeps preview compact and suggests related items", async ({
  page,
  request,
}) => {
  const response = await request.get("/api/public-content/materials");
  expect(response.ok()).toBeTruthy();
  const items = (await response.json()) as { slug: string }[];
  if (!items.length) return;
  await page.goto(`/thu-vien/${items[0].slug}`);
  await expect(
    page.getByRole("heading", { name: "Xem tài liệu" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Tài liệu liên quan" }),
  ).toBeVisible();
  const preview = page.locator('iframe[title^="Xem trước"]');
  if (await preview.count()) {
    const box = await preview.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeLessThanOrEqual(560);
  }
});

test("library filters and teacher application form are visible", async ({
  page,
}) => {
  await page.goto("/thu-vien");
  await expect(page.getByRole("heading", { name: /Bộ lọc/ })).toBeVisible();
  await expect(page.getByLabel("Cấp học")).toBeVisible();
  await page.getByLabel("Cấp học").selectOption("MIDDLE");
  await expect(page.getByLabel("Lớp")).toBeVisible();
  await expect(page.getByLabel("Danh mục")).toBeVisible();
  await expect(page.getByLabel("Loại tài liệu")).toBeVisible();
  await page.getByLabel("Cấp học").selectOption("PRESCHOOL");
  await page.getByLabel("Lớp").selectOption("0");
  await expect(page.getByLabel("Lớp")).toHaveValue("0");
  await page.goto("/dao-tao-giao-vien");
  await expect(
    page.getByRole("heading", { name: "Đăng ký ứng tuyển giáo viên" }),
  ).toBeVisible();
  await expect(page.getByLabel("Họ và tên")).toBeVisible();
  await expect(page.getByLabel("Kinh nghiệm giảng dạy")).toBeVisible();
});

test("teacher dashboard analytics, student 360 profile, and attempt filters work across all 3 stages", async ({
  page,
}) => {
  const mockQuestions = [
    {
      position: 1,
      content: "Choose the word with different pronunciation.",
      options: ["A. l__a__yer", "B. pl__a__yer", "C. m__a__yor", "D. st__a__y"],
      interactionData: null,
      kind: "SINGLE_CHOICE",
      taskType: "PRONUNCIATION",
      answer: "C",
      points: 5,
      sourcePage: 1,
      section: "I. Phonetics",
      recognitionProvider: "LOCAL",
      recognitionModel: null,
      extractionBatch: null,
      sourceLabel: "1",
      recognitionConfidence: 0.98,
      reviewFlags: [],
      sourceBounds: null,
      reviewedAt: new Date().toISOString(),
    },
    {
      position: 2,
      content: "She ___ to school every day.",
      options: ["A. go", "B. goes", "C. going", "D. gone"],
      interactionData: null,
      kind: "SINGLE_CHOICE",
      taskType: "GRAMMAR",
      answer: "B",
      points: 5,
      sourcePage: 1,
      section: "II. Grammar",
      recognitionProvider: "LOCAL",
      recognitionModel: null,
      extractionBatch: null,
      sourceLabel: "2",
      recognitionConfidence: 0.98,
      reviewFlags: [],
      sourceBounds: null,
      reviewedAt: new Date().toISOString(),
    },
  ];

  const mockExam = {
    id: "exam-analytics-1",
    slug: "de-kiem-tra-analytics",
    title: "Đề kiểm tra Giữa kỳ Lớp 8",
    schoolLevel: "MIDDLE",
    grade: 8,
    status: "PUBLISHED",
    showAnswers: true,
    startPage: 1,
    endPage: 2,
    extractedAt: new Date().toISOString(),
    extractionWarnings: [],
    extractionStatus: "READY",
    extractionProgress: 100,
    extractionError: null,
    extractionProvider: "LOCAL",
    aiModel: null,
    aiInputTokens: null,
    aiOutputTokens: null,
    aiFallbackReason: null,
    questions: mockQuestions,
    source: { fileName: "de-lop-8.pdf", mimeType: "application/pdf" },
  };

  const mockAttempts = [
    {
      id: "attempt-a1",
      userId: "student-a",
      participantName: "Nguyễn Văn An",
      status: "SUBMITTED",
      answers: { "1": "A", "2": "B" },
      earned: 5,
      possible: 10,
      manualEarned: 0,
      manualPossible: 0,
      manualScores: {},
      pending: 1,
      teacherFeedback: "Cần ôn lại phần phát âm nguyên âm đôi.",
      submittedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      user: { id: "student-a", fullName: "Nguyễn Văn An", email: "an.nguyen@example.com" },
      exam: { id: mockExam.id, title: mockExam.title, schoolLevel: "MIDDLE", grade: 8, questions: mockQuestions },
    },
  ];

  const mockStudents = [
    {
      id: "student-a",
      fullName: "Nguyễn Văn An",
      email: "an.nguyen@example.com",
      isActive: true,
      createdAt: new Date().toISOString(),
      enrollments: [
        {
          id: "enr-1",
          progress: 65,
          status: "ACTIVE",
          course: { id: "c-1", title: "Secondary Boost", slug: "secondary-boost", level: "THCS", ageRange: "12–15 tuổi" },
        },
      ],
      examAttempts: [
        {
          ...mockAttempts[0],
          examId: mockExam.id,
          exam: { ...mockExam },
        },
      ],
    },
  ];

  await page.route("**/api/portal/overview", (route) =>
    route.fulfill({
      json: { user: { fullName: "Giáo viên Demo", email: "teacher@brightpath.edu.vn", role: "TEACHER" } },
    }),
  );
  await page.route("**/api/staff/content/sources", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/staff/content/exams", (route) => route.fulfill({ json: [mockExam] }));
  await page.route("**/api/staff/content/materials", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/staff/content/attempts", (route) => route.fulfill({ json: mockAttempts }));
  await page.route("**/api/staff/content/students", (route) => route.fulfill({ json: mockStudents }));
  await page.route("**/api/staff/content/storage", (route) =>
    route.fulfill({ json: { usedBytes: 1024, quotaBytes: 1024 * 1024 * 100, sources: 1, materials: 0 } }),
  );
  await page.route("**/api/staff/content/recognition-learning", (route) =>
    route.fulfill({
      json: { corrections: 0, updated: 0, deleted: 0, sourceFiles: 0, reviewedQuestions: 2, totalQuestions: 2, lastCorrectionAt: null },
    }),
  );

  await page.goto("/giao-vien/dashboard");

  // Stage 1: Overview Dashboard Analytics
  await expect(page.getByText("Tổng lượt làm đề").first()).toBeVisible();
  await expect(page.getByText("Bài chờ chấm tay").first()).toBeVisible();
  await expect(page.getByText("Điểm TB (Thang 10)").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bài nộp cần chấm điểm ngay" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Thống kê hiệu suất theo Đề thi" })).toBeVisible();
  await expect(page.getByText("Đề kiểm tra Giữa kỳ Lớp 8").first()).toBeVisible();

  // Stage 2: Student Directory & 360 Profile Modal
  await page.getByRole("button", { name: "Học viên & Tiến độ" }).click();
  await expect(page.getByRole("heading", { name: "Danh sách & Thống kê Học viên" })).toBeVisible();
  await expect(page.getByText("Nguyễn Văn An").first()).toBeVisible();
  await expect(page.getByText("Secondary Boost")).toBeVisible();
  await expect(page.getByText("65%")).toBeVisible();

  const profileBtn = page.getByRole("button", { name: "Xem hồ sơ & lịch sử" }).first();
  await profileBtn.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Hồ sơ học tập · Nguyễn Văn An/ })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Phân tích năng lực theo dạng bài (Điểm mạnh & Điểm yếu)" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Phát âm", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Ngữ pháp", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Cần ôn lại phần phát âm nguyên âm đôi.")).toBeVisible();
  await page.getByRole("button", { name: "Đóng cửa sổ" }).click();

  // Stage 3: Attempt Filters & Question Error Rate Analysis
  await page.getByRole("button", { name: "Bài làm học viên" }).click();
  await expect(page.getByRole("heading", { name: "Theo dõi và chấm bài" })).toBeVisible();
  await expect(page.getByText(/Phân tích câu hỏi học viên hay làm sai nhất/)).toBeVisible();
  await page.getByText(/Phân tích câu hỏi học viên hay làm sai nhất/).click();
  await expect(page.getByText(/Hay nhầm sang:/)).toBeVisible();

  // Stage 4: Compact Action Modals & Interactive Spotlight Guided Tour (?)
  await page.getByRole("button", { name: "Luyện đề" }).click();
  await page.getByRole("button", { name: /Kho tệp nguồn/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("Mẫu Excel nhập đề thi chuẩn hóa"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Đóng cửa sổ" }).click();

  await page.getByRole("button", { name: "Tạo đề luyện tập mới" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByLabel("Thời gian làm bài"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Đóng cửa sổ" }).click();

  await page.getByRole("button", { name: "Thư viện tài liệu" }).click();
  await page.getByRole("button", { name: "Đăng tài liệu mới" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Đăng tài liệu PDF/DOCX" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Liên kết Google Drive" }).click();
  await expect(
    page.getByRole("heading", { name: "Hoặc dùng liên kết Google Drive" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Đóng cửa sổ" }).click();

  // Trigger Interactive Spotlight Guided Tour (?) from sidebar button
  await page.getByRole("button", { name: "Hướng dẫn sử dụng" }).click();
  for (let step = 1; step <= 8; step++) {
    await expect(
      page.getByText(new RegExp(`HƯỚNG DẪN · ${step}\\/8`, "i")),
    ).toBeVisible();
    if (step < 8) {
      await page.getByRole("button", { name: "Tiếp" }).click();
    } else {
      await page.getByRole("button", { name: "Hoàn tất" }).click();
    }
  }
  await expect(page.getByText(/HƯỚNG DẪN ·/i)).toHaveCount(0);
});

