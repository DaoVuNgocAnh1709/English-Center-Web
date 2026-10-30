"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LockKeyhole } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "/api"}/auth/login`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.get("email"), password: data.get("password") }) });
      if (!response.ok) throw new Error("Email hoặc mật khẩu không đúng.");
      const me = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "/api"}/auth/me`, { credentials: "include" }).then(r => r.json());
      const requestedPath = new URLSearchParams(window.location.search).get("returnTo");
      const safeReturnPath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
        ? requestedPath
        : null;
      router.push(
        me.role === "ADMIN"
          ? "/admin"
          : me.role === "TEACHER"
            ? "/giao-vien/dashboard"
            : safeReturnPath || "/hoc-vien",
      );
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể đăng nhập."); setLoading(false); }
  }
  return <form onSubmit={submit} className="grid gap-5"><label className="text-sm font-bold">Email<input name="email" type="email" required className="field-control mt-2 h-12 px-4" placeholder="email@example.com"/></label><label className="text-sm font-bold">Mật khẩu<input name="password" type="password" required minLength={8} className="field-control mt-2 h-12 px-4" placeholder="••••••••"/></label>{error&&<p className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}<button disabled={loading} className="btn-primary w-full disabled:opacity-60">{loading?<><Loader2 className="animate-spin" size={18}/>Đang đăng nhập...</>:<><LockKeyhole size={18}/>Đăng nhập</>}</button></form>;
}
