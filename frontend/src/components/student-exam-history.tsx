"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

type Attempt = {
  id: string;
  status: "DRAFT" | "SUBMITTED" | "GRADED";
  earned: number;
  possible: number;
  manualEarned: number;
  manualPossible: number;
  pending: number;
  teacherFeedback: string | null;
  submittedAt: string | null;
  updatedAt: string;
  createdAt: string;
  exam: { title: string; slug: string };
};
export function StudentExamHistory() {
  const [items, setItems] = useState<Attempt[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    apiFetch(`${process.env.NEXT_PUBLIC_API_URL || "/api"}/student/content/history`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);
  if (!loaded) return null;
  return (
    <section id="lich-su" className="scroll-mt-28 bg-[#f3f6fa] pb-16">
      <div className="container-shell surface-panel p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold text-[#092b4c]">
            Lịch sử luyện đề
          </h2>
          <Link href="/luyen-de" className="text-sm font-bold text-[#d91f2a]">
            Làm đề mới →
          </Link>
        </div>
        <div className="mt-5">
          {items.map((item) => {
            const earned = item.earned + item.manualEarned;
            const possible = item.possible + item.manualPossible;
            return (
              <div key={item.id} className="list-row text-sm">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/luyen-de/${item.exam.slug}?attemptId=${encodeURIComponent(item.id)}`}
                        className="font-bold text-[#092b4c]"
                      >
                        {item.exam.title}
                      </Link>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase ${
                          item.status === "GRADED"
                            ? "bg-emerald-50 text-emerald-700"
                            : item.status === "SUBMITTED"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {item.status === "GRADED"
                          ? "Đã chấm"
                          : item.status === "SUBMITTED"
                            ? "Chờ giáo viên chấm"
                            : "Đang làm"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Cập nhật{" "}
                      {new Date(item.updatedAt).toLocaleString("vi-VN")}
                      {item.status === "SUBMITTED" && item.pending
                        ? " · Còn câu chờ chấm tay"
                        : ""}
                    </p>
                  </div>
                  {item.status === "DRAFT" ? (
                    <Link
                      href={`/luyen-de/${item.exam.slug}?attemptId=${encodeURIComponent(item.id)}`}
                      className="font-bold text-[#d91f2a]"
                    >
                      Tiếp tục làm →
                    </Link>
                  ) : (
                    <div className="text-right">
                      <strong className="tabular-nums">
                        {earned}/{possible} điểm
                      </strong>
                      <Link
                        href={`/luyen-de/${item.exam.slug}?attemptId=${encodeURIComponent(item.id)}`}
                        className="mt-1 block text-xs font-bold text-[#d91f2a]"
                      >
                        Xem chi tiết →
                      </Link>
                    </div>
                  )}
                </div>
                {item.teacherFeedback && (
                  <p className="mt-3 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                    <strong>Nhận xét của giáo viên:</strong>{" "}
                    {item.teacherFeedback}
                  </p>
                )}
              </div>
            );
          })}
          {!items.length && (
            <p className="text-sm text-slate-500">
              Bạn chưa nộp bài luyện đề nào khi đăng nhập.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
