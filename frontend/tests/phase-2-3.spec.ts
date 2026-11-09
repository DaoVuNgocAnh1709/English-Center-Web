import { expect, test } from "@playwright/test";

const studentEmail = process.env.STUDENT_EMAIL!;
const teacherEmail = process.env.TEACHER_EMAIL!;
const adminEmail = process.env.ADMIN_EMAIL!;
const demoPassword = process.env.DEMO_PASSWORD!;
const adminPassword = process.env.ADMIN_PASSWORD!;

test("trang đăng nhập tập trung và các trang nội dung có hiệu ứng dùng chung", async ({ page }) => {
  await page.goto("/gioi-thieu");
  await page.locator(".route-motion").evaluate((element) => {
    element.setAttribute("data-test-instance", "old-route");
  });
  await page.evaluate(() => {
    (document.querySelector('a[href="/dang-nhap"]') as HTMLElement)?.click();
  });
  await expect(page).toHaveURL(/\/dang-nhap$/);
  await expect(page.locator(".route-motion")).not.toHaveAttribute("data-test-instance", "old-route");
  await expect(page.locator("header")).toHaveCount(0);
  await expect(page.locator("footer")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Đăng nhập hệ thống" })).toBeVisible();
  await page.goto("/gioi-thieu");
  await expect(page.locator(".route-motion")).toBeVisible();
  await expect(page.locator("main .site-reveal").first()).toHaveClass(/is-visible/);
});

test.describe("giai đoạn 2 - website nhiều trang", () => {
  for (const [path, heading] of [
    ["/gioi-thieu", "Một môi trường"],
    ["/khoa-hoc", "Lộ trình phù hợp"],
    ["/thu-vien", "Thư viện tài liệu"],
    ["/dao-tao-giao-vien", "Cùng xây dựng đội ngũ"],
    ["/lien-he", "Bắt đầu bằng"],
  ] as const) {
    test(`${path} hiển thị đúng`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        heading,
      );
    });
  }
});

test.describe("giai đoạn 3 - cổng người dùng", () => {
  test("học viên đăng nhập và xem khóa học", async ({ page }) => {
    await page.goto("/dang-nhap");
    await page.getByLabel("Email").fill(studentEmail);
    await page.getByLabel("Mật khẩu").fill(demoPassword);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page).toHaveURL(/\/hoc-vien$/);
    await expect(page.getByRole("heading", { name: "Học viên Demo" })).toBeVisible();
    await expect(page.getByText("Thông tin tài khoản")).toBeVisible();
    await expect(page.getByText("Primary English")).toBeVisible();
    if ((page.viewportSize()?.width || 0) >= 1280) {
      await page.getByRole("button", { name: "Mở menu tài khoản" }).click();
    } else {
      await page.getByRole("button", { name: "Mở menu" }).click();
    }
    await expect(page.getByRole("link", { name: "Thông tin cá nhân" })).toBeVisible();
    await page.goto("/luyen-de");
    const examInfo = page.getByRole("button", { name: "Xem thông tin đề" });
    if (await examInfo.count()) {
      await examInfo.first().click();
      await expect(page.getByText("Lịch sử gần nhất của bạn")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Bắt đầu làm bài" }),
      ).toBeVisible();
    }
  });

  test("học viên đăng nhập từ modal đề và quay lại đúng đề đã chọn", async ({ page }) => {
    await page.goto("/luyen-de");
    const examInfo = page.getByRole("button", { name: "Xem thông tin đề" });
    if (!(await examInfo.count())) return;
    await examInfo.first().click();
    const examTitle = await page.getByRole("dialog").getByRole("heading").textContent();
    await page.getByRole("link", { name: "Đăng nhập tài khoản" }).click();
    await expect(page).toHaveURL(/\/dang-nhap\?returnTo=/);
    await page.getByLabel("Email").fill(studentEmail);
    await page.getByLabel("Mật khẩu").fill(demoPassword);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page).toHaveURL(/\/luyen-de\?exam=/);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("heading")).toHaveText(examTitle || "");
    await expect(page.getByText("Lịch sử gần nhất của bạn")).toBeVisible();
    if ((page.viewportSize()?.width || 0) >= 1280) {
      await expect(page.getByRole("button", { name: "Mở menu tài khoản" })).toBeVisible();
    } else {
      await page.getByRole("button", { name: "Mở menu" }).click();
      await expect(page.getByRole("link", { name: "Thông tin cá nhân" })).toBeVisible();
    }
  });

  test("quản trị viên xem bảng đăng ký", async ({ page }) => {
    await page.goto("/dang-nhap");
    await page.getByLabel("Email").fill(adminEmail);
    await page.getByLabel("Mật khẩu").fill(adminPassword);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByRole("heading", { name: "Dữ liệu cải thiện nhận diện đề" }),
    ).toBeVisible();
    await expect(page.getByText("Mẫu đã tích lũy")).toBeVisible();
    const correctionExport = await page.request.get(
      "/api/staff/content/recognition-learning/export",
    );
    expect(correctionExport.ok()).toBeTruthy();
    expect(correctionExport.headers()["content-type"]).toContain("application/x-ndjson");
    if (process.env.CAPTURE_RECOGNITION_DASHBOARD)
      await page.screenshot({
        path: process.env.CAPTURE_RECOGNITION_DASHBOARD,
        fullPage: true,
      });
    await page.getByRole("button", { name: "Đăng ký tư vấn" }).click();
    await expect(
      page.getByRole("heading", { name: "Đăng ký tư vấn" }).first(),
    ).toBeVisible();
  });

  test("giáo viên truy cập công cụ học liệu", async ({ page }) => {
    await page.goto("/dang-nhap");
    await page.getByLabel("Email").fill(teacherEmail);
    await page.getByLabel("Mật khẩu").fill(demoPassword);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page).toHaveURL(/\/giao-vien\/dashboard$/);
    await expect(
      page.getByRole("heading", { name: "Dữ liệu cải thiện nhận diện đề" }),
    ).toHaveCount(0);
    await expect(page.getByText("Tổng lượt làm đề")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Thống kê hiệu suất theo Đề thi" }),
    ).toBeVisible();
    const studentsResp = await page.request.get("/api/staff/content/students");
    expect(studentsResp.ok()).toBeTruthy();
    await page.getByRole("button", { name: "Học viên & Tiến độ" }).click();
    await expect(
      page.getByRole("heading", { name: "Danh sách & Thống kê Học viên" }),
    ).toBeVisible();
    const studentProfileBtns = page.getByRole("button", {
      name: "Xem hồ sơ & lịch sử",
    });
    if (await studentProfileBtns.count()) {
      await studentProfileBtns.first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /Hồ sơ học tập/ }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Đóng cửa sổ" }).click();
    }
    await page.getByRole("button", { name: "Luyện đề" }).click();
    await expect(page.getByLabel("Cấp học").first()).toHaveJSProperty(
      "tagName",
      "SELECT",
    );
    await expect(page.getByLabel("Lớp").first()).toHaveJSProperty(
      "tagName",
      "SELECT",
    );
    await expect(page.getByLabel("Thời gian làm bài")).toBeVisible();
    await expect(
      page.getByLabel("Tự động chuyển tệp thành câu hỏi web"),
    ).toBeChecked();
    const fileInput = page.locator('input[name="file"][type="file"]').first();
    await expect(fileInput).toHaveAttribute("accept", /\.docx/);
    await expect(fileInput).toHaveAttribute("accept", /\.xlsx/);
    await expect(fileInput).toHaveAttribute("accept", /\.png/);
    const template = await page.request.get("/api/staff/content/exam-template");
    expect(template.ok()).toBeTruthy();
    expect(template.headers()["content-type"]).toContain("spreadsheetml.sheet");
    const reviewButtons = page.getByRole("button", { name: "Duyệt câu hỏi" });
    if (await reviewButtons.count()) {
      await reviewButtons.first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByRole("button", { name: /Cần kiểm tra/ })).toBeVisible();
      await expect(page.getByRole("region", { name: "Tệp đề gốc" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Câu này đúng" }).first()).toBeVisible();
      const editButton = page.getByRole("button", { name: "Sửa nội dung" }).first();
      await expect(editButton).toBeVisible();
      await expect(page.getByRole("button", { name: "Đây không phải câu hỏi" }).first()).toBeVisible();
      if (await editButton.isEnabled()) {
        await editButton.click();
        await expect(page.getByRole("button", { name: "Lưu thay đổi" }).first()).toBeVisible();
        await page.getByRole("button", { name: "Hủy" }).first().click();
      }
      if (process.env.CAPTURE_SIMPLE_REVIEW)
        await page.screenshot({ path: process.env.CAPTURE_SIMPLE_REVIEW });
      const sourcePreview = page.locator('iframe[title^="Đề gốc"]');
      if (await sourcePreview.count()) await expect(sourcePreview).toBeVisible();
      await page.getByRole("button", { name: "Đóng cửa sổ" }).click();
    }
    await page.getByRole("button", { name: "Bài làm học viên" }).click();
    await expect(
      page.getByRole("heading", { name: "Theo dõi và chấm bài" }),
    ).toBeVisible();
    const attemptButtons = page.getByRole("button", {
      name: /Xem tiến độ|Xem \/ chấm bài/,
    });
    if (await attemptButtons.count()) {
      await attemptButtons.first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByRole("dialog")).toContainText("Bài làm:");
      await expect(page.getByRole("dialog")).toContainText("A. layer");
      await page.getByRole("button", { name: "Đóng cửa sổ" }).click();
    }
    await page.getByRole("button", { name: "Thư viện tài liệu" }).click();
    await expect(
      page.getByRole("heading", { name: "Đăng tài liệu PDF/DOCX" }),
    ).toBeVisible();
    await expect(page.getByLabel("Danh mục").first()).toHaveJSProperty(
      "tagName",
      "SELECT",
    );
  });

  test("phiên giáo viên hết hạn quay về đăng nhập và giữ trang đang mở", async ({ page, context }) => {
    await page.goto("/dang-nhap");
    await page.getByLabel("Email").fill(teacherEmail);
    await page.getByLabel("Mật khẩu").fill(demoPassword);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page).toHaveURL(/\/giao-vien\/dashboard$/);
    await context.clearCookies();
    await page.reload();
    await expect(page).toHaveURL(/\/dang-nhap\?returnTo=%2Fgiao-vien%2Fdashboard$/);
  });
});
