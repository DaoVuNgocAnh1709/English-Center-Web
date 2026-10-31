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

