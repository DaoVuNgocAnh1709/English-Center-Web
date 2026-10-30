"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Clock3, FileCheck2, History, LogIn, Play } from "lucide-react";
import { Modal } from "@/components/modal";
import { PageHero } from "@/components/page-hero";
import {
  gradeLabel,
  gradesForLevel,
  schoolLevels,
} from "@/lib/content-options";

type Exam = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  schoolLevel: string;
  grade: number;
  durationMinutes: number;
  questions: { position: number }[];
};

type AttemptHistory = {
  id: string;
  status: "DRAFT" | "SUBMITTED" | "GRADED";
  earned: number;
  possible: number;
  manualEarned: number;
  manualPossible: number;
  pending: number;
  updatedAt: string;
  exam: { title: string; slug: string };
};

const api = process.env.NEXT_PUBLIC_API_URL || "/api";
const levels = [{ value: "", label: "Tất cả" }, ...schoolLevels];

export default function ExamListPage() {
  const router = useRouter();
  const [level, setLevel] = useState("");
  const [grade, setGrade] = useState("");
  const [items, setItems] = useState<Exam[]>([]);
  const [selected, setSelected] = useState<Exam | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [history, setHistory] = useState<AttemptHistory[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const query = new URLSearchParams();
    if (level) query.set("level", level);
    if (grade) query.set("grade", grade);
    fetch(`${api}/public-content/exams?${query}`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const nextItems = (await response.json()) as Exam[];
        setItems(nextItems);
        const requestedExam = new URLSearchParams(window.location.search).get("exam");
        const matchingExam = nextItems.find((item) => item.slug === requestedExam);
        if (matchingExam) setSelected(matchingExam);
      })
      .catch(() => setError("Chưa tải được danh sách đề."));
  }, [level, grade]);

  useEffect(() => {
    fetch(`${api}/auth/me`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) return;
        setAuthenticated(true);
        const historyResponse = await fetch(`${api}/student/content/history`, {
          credentials: "include",
        });
        if (historyResponse.ok) setHistory(await historyResponse.json());
      })
      .catch(() => {});
  }, []);

  const selectedHistory = selected
    ? history
        .filter((attempt) => attempt.exam.slug === selected.slug)
        .slice(0, 3)
    : [];

  return (
    <>
      <PageHero
        kicker="Luyện đề online"
        title="Chọn đề phù hợp và luyện tập ngay"
        description="Xem thông tin đề, lịch sử làm gần nhất và bắt đầu khi bạn đã sẵn sàng. Khách chưa đăng nhập vẫn có thể làm đề."
      />
      <section className="bg-[#f3f6fa] py-14 md:py-18">
        <div className="container-shell">
          <div className="surface-panel flex flex-wrap items-end gap-4 p-4 md:p-5">
            <label className="text-sm font-bold">
              Cấp học
              <select
                value={level}
                onChange={(event) => {
                  setLevel(event.target.value);
                  setGrade("");
                }}
                className="field-control mt-2 min-w-44 p-3"
              >
                {levels.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold">
              Lớp
              <select
                value={grade}
                onChange={(event) => setGrade(event.target.value)}
                className="field-control mt-2 min-w-32 p-3"
              >
                <option value="">Tất cả</option>
                {(level
                  ? gradesForLevel(level)
                  : Array.from({ length: 13 }, (_, i) => i)
                ).map((number) => (
                  <option key={number} value={number}>
                    {gradeLabel(number)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error && <p className="mt-6 text-red-700">{error}</p>}
          <div className="mb-5 mt-9 flex items-end justify-between gap-4"><div><h2 className="text-2xl font-extrabold text-[#092b4c]">Đề đang mở</h2><p className="mt-1 text-sm text-slate-500">Chọn một đề để xem yêu cầu và lịch sử làm bài.</p></div><strong className="shrink-0 text-sm text-[#123d68]">{items.length} đề</strong></div>
          <div className="grid gap-4">
            {items.map((item) => (
              <article key={item.id} className="surface-panel grid gap-5 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-7">
                <div><span className="text-xs font-bold uppercase tracking-wider text-[#d91f2a]">
                  {
                    levels.find(
                      (levelItem) => levelItem.value === item.schoolLevel,
                    )?.label
                  }{" "}
                  · {gradeLabel(item.grade)}
                </span>
                <h2 className="mt-3 text-xl font-extrabold text-[#092b4c]">
                  {item.title}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  {item.summary ||
                    "Luyện tập với đề PDF và phiếu trả lời online."}
                </p>
                <p className="mt-5 text-xs font-semibold text-slate-500">
                  {item.durationMinutes} phút · {item.questions.length} câu hỏi
                </p></div>
                <button
                  type="button"
                  onClick={() => setSelected(item)}
                  className="btn-primary w-full md:w-auto"
                >
                  Xem thông tin đề
                </button>
              </article>
            ))}
          </div>
          {!items.length && !error && (
            <p className="mt-8 rounded-xl bg-white p-8 text-sm text-slate-600">
              Chưa có đề công khai ở bộ lọc này. Giáo viên và admin có thể thêm
              đề trong khu quản trị.
            </p>
          )}
        </div>
      </section>

      {selected && (
        <Modal
          open
          title={selected.title}
          description={`${gradeLabel(selected.grade)} · ${selected.questions.length} câu · ${selected.durationMinutes} phút`}
          onClose={() => setSelected(null)}
          size="md"
        >
          <p className="text-sm leading-7 text-slate-600">
            {selected.summary ||
              "Luyện tập trực tiếp trên web, tự động lưu tiến độ và chấm các câu đã có đáp án."}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-[#edf3f8] p-4">
              <Clock3 size={19} className="text-[#123d68]" />
              <strong className="mt-2 block text-sm text-[#092b4c]">
                {selected.durationMinutes} phút làm bài
              </strong>
            </div>
            <div className="rounded-xl bg-[#edf3f8] p-4">
              <FileCheck2 size={19} className="text-[#123d68]" />
              <strong className="mt-2 block text-sm text-[#092b4c]">
                {selected.questions.length} câu hỏi
              </strong>
            </div>
          </div>

          {authenticated ? (
            <div className="mt-6">
              <h3 className="flex items-center gap-2 font-extrabold text-[#092b4c]">
                <History size={18} /> Lịch sử gần nhất của bạn
              </h3>
              <div className="mt-3 space-y-2">
                {selectedHistory.map((attempt) => (
                  <div
                    key={attempt.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  >
                    <div>
                      <strong className="text-[#092b4c]">
                        {attempt.status === "DRAFT"
                          ? "Đang làm"
                          : attempt.status === "SUBMITTED"
                            ? "Chờ giáo viên chấm"
                            : "Đã chấm"}
                      </strong>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(attempt.updatedAt).toLocaleString("vi-VN")}
                      </p>
                    </div>
                    {attempt.status !== "DRAFT" && (
                      <span className="font-bold text-[#123d68]">
                        {attempt.pending > 0
                          ? `${attempt.pending} câu chờ chấm`
                          : `${attempt.earned + attempt.manualEarned}/${attempt.possible + attempt.manualPossible} điểm`}
                      </span>
                    )}
                  </div>
                ))}
                {!selectedHistory.length && (
                  <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                    Bạn chưa làm đề này lần nào.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <strong>Đăng nhập để lưu lịch sử làm bài.</strong>
              <p>
                Bạn vẫn có thể làm với tên khách, nhưng lịch sử sẽ không được
                lưu vào hồ sơ học viên.
              </p>
              <Link
                href={{
                  pathname: "/dang-nhap",
                  query: { returnTo: `/luyen-de?exam=${selected.slug}` },
                }}
                className="mt-3 inline-flex items-center gap-2 font-bold text-[#123d68]"
              >
                <LogIn size={16} /> Đăng nhập tài khoản
              </Link>
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="btn-outline"
            >
              Để sau
            </button>
            <button
              type="button"
              onClick={() => {
                window.localStorage.removeItem(`brightpath-attempt-${selected.id}`);
                router.push(`/luyen-de/${selected.slug}?start=1`);
              }}
              className="btn-primary"
            >
              <Play size={17} /> Bắt đầu làm bài
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
