"use client";

import { useState } from "react";

export function TeacherApplicationForm() {
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    try {
      const body = Object.fromEntries(new FormData(form));
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "/api"}/public-content/teacher-applications`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok)
        throw new Error("Thông tin chưa hợp lệ, vui lòng kiểm tra lại.");
      form.reset();
      setSuccess(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không gửi được hồ sơ.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="soft-card grid gap-4 p-6 md:grid-cols-2 md:p-8"
    >
      <h2 className="text-xl font-extrabold text-[#092b4c] md:col-span-2">
        Đăng ký ứng tuyển giáo viên
      </h2>
      <p className="text-sm text-slate-500 md:col-span-2">
        Chị chủ trung tâm sẽ xem thông tin và liên hệ trực tiếp. Form này không
        tạo tài khoản giáo viên.
      </p>
      <Field name="fullName" label="Họ và tên" required />
      <Field name="phone" label="Số điện thoại" type="tel" required />
      <Field name="email" label="Email" type="email" required />
      <Field
        name="area"
        label="Khu vực dạy"
        placeholder="Hà Nội / Hưng Yên"
        required
      />
      <Field
        name="experience"
        label="Kinh nghiệm giảng dạy"
        placeholder="Ví dụ: 2 năm dạy THCS"
        required
      />
      <label className="text-sm font-semibold md:col-span-2">
        Giới thiệu thêm
        <textarea
          name="message"
          maxLength={1500}
          className="field-control mt-2 min-h-28 p-3"
        />
      </label>
      <label className="flex items-start gap-3 text-xs leading-5 text-slate-600 md:col-span-2">
        <input type="checkbox" required className="mt-1" />
        Tôi đồng ý để trung tâm lưu thông tin ứng tuyển và liên hệ với tôi về cơ
        hội giảng dạy.
      </label>
      {success && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800 md:col-span-2"
        >
          Đã nhận thông tin. Trung tâm sẽ liên hệ với bạn.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700 md:col-span-2">
          {error}
        </p>
      )}
      <button disabled={busy} className="btn-primary w-fit">
        {busy ? "Đang gửi..." : "Gửi thông tin ứng tuyển"}
      </button>
    </form>
  );
}
function Field({
  name,
  label,
  ...props
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <input name={name} className="field-control mt-2 p-3" {...props} />
    </label>
  );
}
