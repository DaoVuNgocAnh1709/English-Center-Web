import { LoginForm } from "@/components/login-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Đăng nhập" };

export default function LoginPage() {
  return (
    <section className="min-h-screen bg-white lg:grid lg:grid-cols-[.8fr_1.2fr]">
        <div className="flex flex-col bg-[#082f55] p-8 text-white md:p-14 lg:min-h-screen lg:p-16">
          <Link href="/" className="mb-16 inline-flex items-center gap-2 text-sm font-bold text-white/70 transition hover:text-white"><ArrowLeft size={17} /> Về trang chủ</Link>
          <div className="my-auto max-w-xl">
          <h1 className="text-4xl font-extrabold leading-tight tracking-[-.04em]">
            Chào mừng bạn quay lại Bright Path.
          </h1>
          <p className="mt-5 leading-8 text-white/80">
            Đăng nhập cổng học tập để truy cập khóa học, học liệu và thông tin quản lý theo tài khoản được
            trung tâm cấp.
          </p>
          <div className="mt-10 border-t border-white/20 pt-5 text-xs leading-6 text-white/75">
            <strong className="block text-white">Đăng nhập an toàn</strong>
            Thông tin truy cập do trung tâm cấp riêng theo vai trò. Không chia sẻ mật khẩu hoặc mã phiên đăng nhập cho người khác.
          </div>
          </div>
        </div>
        <div className="flex items-center p-8 md:p-14 lg:p-16">
          <div className="mx-auto w-full max-w-xl">
          <h2 className="text-2xl font-extrabold text-[#092b4c]">
            Đăng nhập hệ thống
          </h2>
          <p className="mb-8 mt-2 text-sm text-slate-500">
            Sử dụng email và mật khẩu do trung tâm cung cấp.
          </p>
          <LoginForm />
          <p className="mt-8 text-xs leading-5 text-slate-500">Tài khoản được trung tâm cấp theo đúng vai trò học viên, giáo viên hoặc quản trị viên.</p>
          </div>
        </div>
    </section>
  );
}
