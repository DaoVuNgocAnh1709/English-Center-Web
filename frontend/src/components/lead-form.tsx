"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  parentName: z.string().min(2, "Vui lòng nhập họ tên"),
  phone: z
    .string()
    .transform((value) => value.replace(/[\s.()-]/g, ""))
    .refine((value) => /^(0[35789][0-9]{8}|\+84[35789][0-9]{8})$/.test(value), "Số điện thoại chưa đúng"),
  studentName: z.string().min(2, "Vui lòng nhập tên học viên"),
  studentGrade: z.string().min(1, "Vui lòng chọn khối lớp"),
  interestedCourse: z.string().min(1, "Vui lòng chọn chương trình"),
  note: z.string().max(500).optional(),
});
type FormData = z.infer<typeof schema>;

export function LeadForm() {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isSubmitSuccessful }, setError } = useForm<FormData>({ resolver: zodResolver(schema) });
  const onSubmit = async (data: FormData) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "/api"}/leads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!response.ok) throw new Error("Không thể gửi đăng ký");
      reset();
    } catch {
      setError("root", { message: "Chưa gửi được đăng ký. Vui lòng thử lại hoặc gọi hotline mẫu 0900 000 000." });
    }
  };
  const field = "field-control mt-2 h-12 px-4";
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      {isSubmitSuccessful && <div className="flex gap-3 rounded bg-emerald-50 p-4 text-sm font-bold text-emerald-800"><CheckCircle2 className="shrink-0"/>Đã nhận thông tin. Trung tâm sẽ liên hệ lại sớm.</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">Tên phụ huynh<input className={field} placeholder="Nguyễn Văn A" {...register("parentName")}/><small className="mt-1 block text-red-600">{errors.parentName?.message}</small></label>
        <label className="text-sm font-bold">Số điện thoại<input className={field} inputMode="tel" placeholder="09xx xxx xxx" {...register("phone")}/><small className="mt-1 block text-red-600">{errors.phone?.message}</small></label>
        <label className="text-sm font-bold">Tên học viên<input className={field} placeholder="Nguyễn Minh Anh" {...register("studentName")}/><small className="mt-1 block text-red-600">{errors.studentName?.message}</small></label>
        <label className="text-sm font-bold">Khối lớp<select className={field} defaultValue="" {...register("studentGrade")}><option value="" disabled>Chọn khối lớp</option><option>Mầm non</option><option>Lớp 1–2</option><option>Lớp 3–5</option><option>THCS</option><option>THPT</option></select><small className="mt-1 block text-red-600">{errors.studentGrade?.message}</small></label>
      </div>
      <label className="text-sm font-bold">Chương trình quan tâm<select className={field} defaultValue="" {...register("interestedCourse")}><option value="" disabled>Chọn chương trình</option><option>Tiếng Anh trẻ em</option><option>Tiếng Anh tiểu học</option><option>Tiếng Anh THCS</option><option>Luyện thi học kỳ</option><option>Đào tạo giáo viên</option></select><small className="mt-1 block text-red-600">{errors.interestedCourse?.message}</small></label>
      <label className="text-sm font-bold">Ghi chú<textarea className="field-control mt-2 min-h-24 p-4" placeholder="Khung giờ thuận tiện để nhận tư vấn..." {...register("note")}/></label>
      {errors.root && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{errors.root.message}</p>}
      <button className="btn-primary w-full disabled:opacity-60" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="animate-spin"/>Đang gửi...</> : "Nhận tư vấn miễn phí"}</button>
      <p className="text-center text-xs leading-5 text-slate-500">Bằng việc gửi thông tin, bạn đồng ý để trung tâm liên hệ tư vấn. Dữ liệu chỉ dùng cho mục đích tuyển sinh.</p>
    </form>
  );
}

