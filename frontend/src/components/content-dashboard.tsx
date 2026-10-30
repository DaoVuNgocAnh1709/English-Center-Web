"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  FileSearch,
  LayoutDashboard,
  LogOut,
  UserRoundCheck,
  Users,
} from "lucide-react";
import {
  gradeLabel,
  gradesForLevel,
  materialCategories,
  schoolLevels,
} from "@/lib/content-options";
import { Modal } from "@/components/modal";

type Role = "ADMIN" | "TEACHER";
type User = { fullName: string; email: string; role: Role | "STUDENT" };
type Source = {
  id: string;
  fileName: string;
  pageCount: number;
  mimeType: string;
  importWarnings: unknown;
  status: "QUEUED" | "SCANNING" | "PROCESSING" | "READY" | "FAILED" | "QUARANTINED";
  progress: number;
  statusMessage: string | null;
  lastError: string | null;
  sizeBytes: number;
  _count: { exams: number };
};
type StorageStats = { usedBytes: number; quotaBytes: number; sources: number; materials: number };
type RecognitionLearningStats = {
  corrections: number;
  updated: number;
  deleted: number;
  sourceFiles: number;
  reviewedQuestions: number;
  totalQuestions: number;
  lastCorrectionAt: string | null;
};
type Question = {
  position: number;
  answer: string | null;
  kind: string;
  points: number;
  sourceLabel: string | null;
  section: string | null;
  content: string | null;
  options: unknown;
  sourcePage: number | null;
  recognitionConfidence: number;
  reviewFlags: unknown;
  sourceBounds: unknown;
  reviewedAt: string | null;
};
type Exam = {
  id: string;
  slug: string;
  title: string;
  schoolLevel: string;
  grade: number;
  status: string;
  startPage: number;
  endPage: number;
  extractedAt: string | null;
  extractionWarnings: unknown;
  extractionStatus: "QUEUED" | "PROCESSING" | "READY" | "FAILED";
  extractionProgress: number;
  extractionError: string | null;
  questions: Question[];
  source: { fileName: string; mimeType: string };
};
type Material = {
  id: string;
  title: string;
  category: string;
  grade: number | null;
  status: string;
  fileName: string | null;
  driveUrl: string | null;
};
type Application = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  area: string;
  experience: string;
  message: string | null;
  status: string;
  createdAt: string;
};
type Lead = {
  id: string;
  parentName: string;
  studentName: string;
  phone: string;
  interestedCourse: string;
  status: string;
};
type AttemptQuestion = {
  position: number;
  content: string | null;
  options: unknown;
  kind: string;
  answer: string | null;
  points: number;
  sourcePage: number | null;
  section: string | null;
};
type StaffAttempt = {
  id: string;
  participantName: string | null;
  status: "DRAFT" | "SUBMITTED" | "GRADED";
  answers: unknown;
  earned: number;
  possible: number;
  manualEarned: number;
  manualPossible: number;
  manualScores: unknown;
  pending: number;
  teacherFeedback: string | null;
  submittedAt: string | null;
  updatedAt: string;
  user: { fullName: string; email: string } | null;
  exam: { id: string; title: string; questions: AttemptQuestion[] };
};
const api = process.env.NEXT_PUBLIC_API_URL || "/api";
const statusLabels: Record<string, string> = {
  DRAFT: "Bản nháp",
  REVIEW: "Chờ duyệt",
  PUBLISHED: "Đã xuất bản",
  NEW: "Mới",
  CONTACTED: "Đã liên hệ",
  INTERVIEW: "Phỏng vấn",
  HIRED: "Đã nhận",
  REJECTED: "Từ chối",
  SUBMITTED: "Chờ chấm",
  GRADED: "Đã chấm",
};
const sourceStatusLabels: Record<Source["status"], string> = {
  QUEUED: "Đang chờ",
  SCANNING: "Đang quét an toàn",
  PROCESSING: "Đang nhận dạng",
  READY: "Sẵn sàng",
  FAILED: "Xử lý lỗi",
  QUARANTINED: "Đã cách ly",
};

class RequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  const returnTo = `${window.location.pathname}${window.location.search}`;
  const loginUrl = `/dang-nhap?returnTo=${encodeURIComponent(returnTo)}`;
  if (`${window.location.pathname}${window.location.search}` !== loginUrl)
    window.location.assign(loginUrl);
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${api}${path}`, {
    credentials: "include",
    ...init,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    if (response.status === 401) {
      redirectToLogin();
      throw new RequestError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401);
    }
    if (response.status === 429 || response.status === 503)
      throw new RequestError("Bạn thao tác quá nhanh. Vui lòng đợi vài giây rồi thử lại.", response.status);
    throw new RequestError(body?.message || `Lỗi ${response.status}`, response.status);
  }
  return response.json();
}

export function ContentDashboard({ role }: { role: Role }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState("overview");
  const [sources, setSources] = useState<Source[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [attempts, setAttempts] = useState<StaffAttempt[]>([]);
  const [storage, setStorage] = useState<StorageStats | null>(null);
  const [recognitionLearning, setRecognitionLearning] = useState<RecognitionLearningStats | null>(null);
  const [sourceFileNames, setSourceFileNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [selectedExam, setSelectedExam] = useState<string | null>(null);
  const [selectedAttempt, setSelectedAttempt] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const uploadLock = useRef(false);
  const selectedSource = sources.find((source) => source.id === selectedSourceId);

  const reload = useCallback(async () => {
    const [sourceList, examList, materialList, attemptList, storageInfo, learningInfo] = await Promise.all(
      [
        request("/staff/content/sources"),
        request("/staff/content/exams"),
        request("/staff/content/materials"),
        request("/staff/content/attempts"),
        request("/staff/content/storage"),
        request("/staff/content/recognition-learning"),
      ],
    );
    setSources(sourceList);
    setExams(examList);
    setMaterials(materialList);
    setAttempts(attemptList);
    setStorage(storageInfo);
    setRecognitionLearning(learningInfo);
    if (role === "ADMIN") {
      const [applicationList, leadList] = await Promise.all([
        request("/admin/content/applications"),
        request("/admin/leads"),
      ]);
      setApplications(applicationList);
      setLeads(leadList);
    }
  }, [role]);

  useEffect(() => {
    request("/portal/overview")
      .then(async (data) => {
        if (data.user.role !== role) {
          router.replace(
            data.user.role === "STUDENT"
              ? "/hoc-vien"
              : data.user.role === "ADMIN"
                ? "/admin"
                : "/giao-vien/dashboard",
          );
          return;
        }
        setUser(data.user);
        await reload();
      })
      .catch(() => router.replace("/dang-nhap"));
  }, [role, router, reload]);

  useEffect(() => {
    if (
      !sources.some((source) => ["QUEUED", "SCANNING", "PROCESSING"].includes(source.status)) &&
      !exams.some((exam) => ["QUEUED", "PROCESSING"].includes(exam.extractionStatus))
    ) return;
    const timer = window.setTimeout(() => void reload(), 2000);
    return () => window.clearTimeout(timer);
  }, [sources, exams, reload]);

  async function action(task: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
      await reload();
      setNotice(success);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Có lỗi xảy ra.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function sourceUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploadLock.current) return;
    uploadLock.current = true;
    const form = event.currentTarget;
    const body = new FormData(form);
    try {
      if (
        await action(
          () => request("/staff/content/sources", { method: "POST", body }),
          "Đã đưa tệp vào hàng đợi an toàn. Bạn có thể tiếp tục công việc khác trong lúc hệ thống xử lý.",
        )
      ) {
          form.reset();
          setSourceFileNames([]);
        }
    } finally {
      uploadLock.current = false;
    }
  }
  async function createExam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = {
      ...Object.fromEntries(data.entries()),
      extractQuestions: data.get("extractQuestions") === "on",
    };
    if (
      await action(
        () =>
          request("/staff/content/exams", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
        "Đã tạo bản nháp. Hệ thống đang chuyển nội dung thành câu hỏi web trong nền.",
      )
    )
      form.reset();
  }
  async function createMaterial(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (
      await action(
        () =>
          request("/staff/content/materials", {
            method: "POST",
            body: new FormData(form),
          }),
        "Đã tải tài liệu. Gửi duyệt để admin xuất bản.",
      )
    )
      form.reset();
  }
  async function createDriveLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const body = { ...values, type: "DOCUMENT" };
    if (
      await action(
        () =>
          request("/staff/materials", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
        "Đã lưu liên kết Drive ở bản nháp.",
      )
    )
      form.reset();
  }
  async function patch(path: string, data: object, message: string) {
    await action(
      () =>
        request(path, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
      message,
    );
  }
  async function remove(path: string) {
    await action(
      () => request(path, { method: "DELETE" }),
      "Đã xóa câu khỏi phiếu trả lời.",
    );
  }
  const nav = [
    ["overview", "Tổng quan", LayoutDashboard],
    ["exams", "Luyện đề", ClipboardList],
    ["attempts", "Bài làm học viên", FileCheck2],
    ["materials", "Thư viện tài liệu", BookOpen],
    ...(role === "ADMIN"
      ? ([
          ["applications", "Ứng tuyển giáo viên", UserRoundCheck],
          ["leads", "Đăng ký tư vấn", Users],
        ] as const)
      : []),
  ] as const;
  if (!user)
    return (
      <div className="container-shell py-20">Đang tải khu quản trị...</div>
    );
  const userInitials = user.fullName.trim().split(/\s+/).slice(-2).map((part) => part[0]?.toUpperCase()).join("");
  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar relative shrink-0 px-5 py-6 lg:pb-24">
        <Link href="/" className="flex items-center gap-3" aria-label="Về trang chủ Bright Path">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#d91f2a] text-sm font-black italic">BP</span>
          <span><strong className="block text-sm tracking-[.04em]">BRIGHT PATH</strong><small className="text-[11px] font-semibold tracking-[.08em] text-white/55">WORKSPACE</small></span>
        </Link>
        <div className="mt-7 flex items-center gap-3 border-y border-white/10 py-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-xs font-extrabold text-[#082c50]">{userInitials}</span>
          <div className="min-w-0"><p className="truncate text-sm font-bold">{user.fullName}</p><p className="mt-0.5 truncate text-[11px] text-white/55">{role === "ADMIN" ? "Quản trị trung tâm" : "Giáo viên"}</p></div>
        </div>
        <nav
          className="mt-5 grid grid-cols-2 gap-2 lg:block"
          aria-label="Chức năng quản trị"
        >
          {nav.map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => {
                setTab(key);
                setNotice("");
                setError("");
              }}
              className={`mb-1 flex min-w-0 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold transition-colors lg:w-full ${tab === key ? "bg-white text-[#0b3157] shadow-[0_8px_22px_rgba(0,0,0,.12)]" : "text-white/70 hover:bg-white/[.07] hover:text-white"}`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <button
          onClick={async () => {
            await fetch(`${api}/auth/logout`, {
              method: "POST",
              credentials: "include",
            });
            router.replace("/dang-nhap");
          }}
          className="mt-6 flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white/65 hover:bg-white/[.06] hover:text-white lg:absolute lg:bottom-5 lg:left-5 lg:right-5"
        >
          <LogOut size={17} />
          Đăng xuất
        </button>
      </aside>
      <div className="workspace-main px-5 py-7 md:px-10 md:py-9">
        <div className="mx-auto max-w-6xl">
          <div className="workspace-topbar mb-7">
            <div><h1 className="workspace-title">{nav.find((item) => item[0] === tab)?.[1]}</h1><p className="workspace-subtitle">{tab === "overview" ? "Theo dõi nội dung, học viên và các việc cần xử lý trong một nơi." : tab === "exams" ? "Tạo đề từ PDF, rà soát câu hỏi và quản lý trạng thái xuất bản." : tab === "attempts" ? "Theo dõi tiến độ, kết quả tự động và các câu đang chờ chấm tay." : tab === "materials" ? "Tổ chức học liệu theo cấp học, danh mục và trạng thái duyệt." : "Xử lý thông tin mới và cập nhật trạng thái liên hệ."}</p></div>
            <span className="status-dot shrink-0 rounded-full bg-white px-4 py-2 text-xs font-bold text-emerald-700 shadow-sm">Hệ thống hoạt động</span>
          </div>
          {notice && (
            <p
              role="status"
              className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"
            >
              {notice}
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="mb-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800"
            >
              {error}
            </p>
          )}
          {tab === "overview" && (
            <div>
              <div className="metric-strip">
              <Summary value={exams.length} label="Đề luyện tập" />
              <Summary value={materials.length} label="Tài liệu" />
              <Summary
                value={
                  role === "ADMIN"
                    ? applications.filter((item) => item.status === "NEW")
                        .length
                    : sources.length
                }
                label={role === "ADMIN" ? "Hồ sơ mới" : "PDF nguồn"}
              />
              </div>
              <div className="workspace-panel mt-6 grid gap-7 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
                <div><h2 className="text-xl font-bold text-[#092b4c]">Bắt đầu công việc</h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                  Giáo viên tải PDF, chọn trang, nhập đáp án và gửi duyệt. Admin
                  kiểm tra lại PDF, đáp án rồi xuất bản. Tài liệu cũng cần duyệt
                  trước khi hiển thị công khai.
                </p></div>
                <div className="flex flex-wrap gap-3 md:justify-end">
                  <button
                    className="btn-primary"
                    onClick={() => setTab("exams")}
                  >
                    Tạo đề luyện tập
                  </button>
                  <button
                    className="btn-outline"
                    onClick={() => setTab("materials")}
                  >
                    Đăng tài liệu
                  </button>
                </div>
              </div>
              {role === "ADMIN" && recognitionLearning && (
                <section className="workspace-panel mt-6 p-6 md:p-8" aria-labelledby="recognition-learning-title">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <h2 id="recognition-learning-title" className="text-lg font-bold text-[#092b4c]">
                        Dữ liệu cải thiện nhận diện đề
                      </h2>
                      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                        Mỗi câu giáo viên sửa hoặc xóa được lưu làm mẫu có kiểm soát. Hệ thống chỉ tự áp dụng lại khi nhận đúng tệp và đúng nội dung gốc.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                      <span className="text-slate-500">
                        {recognitionLearning.lastCorrectionAt
                          ? `Cập nhật gần nhất ${new Date(recognitionLearning.lastCorrectionAt).toLocaleDateString("vi-VN")}`
                          : "Chưa có bản sửa được ghi nhận"}
                      </span>
                      <a
                        href={`${api}/staff/content/recognition-learning/export`}
                        className="text-[#123d68] underline underline-offset-4"
                      >
                        Tải bộ mẫu JSONL
                      </a>
                    </div>
                  </div>
                  <dl className="mt-5 grid gap-px overflow-hidden rounded-xl bg-slate-200 sm:grid-cols-4">
                    <div className="bg-white px-4 py-4">
                      <dt className="text-xs font-semibold text-slate-500">Mẫu đã tích lũy</dt>
                      <dd className="mt-1 text-xl font-extrabold tabular-nums text-[#092b4c]">{recognitionLearning.corrections}</dd>
                    </div>
                    <div className="bg-white px-4 py-4">
                      <dt className="text-xs font-semibold text-slate-500">Câu đã sửa</dt>
                      <dd className="mt-1 text-xl font-extrabold tabular-nums text-[#092b4c]">{recognitionLearning.updated}</dd>
                    </div>
                    <div className="bg-white px-4 py-4">
                      <dt className="text-xs font-semibold text-slate-500">Nhận diện nhầm đã loại</dt>
                      <dd className="mt-1 text-xl font-extrabold tabular-nums text-[#092b4c]">{recognitionLearning.deleted}</dd>
                    </div>
                    <div className="bg-white px-4 py-4">
                      <dt className="text-xs font-semibold text-slate-500">Tệp có phản hồi</dt>
                      <dd className="mt-1 text-xl font-extrabold tabular-nums text-[#092b4c]">{recognitionLearning.sourceFiles}</dd>
                    </div>
                  </dl>
                </section>
              )}
            </div>
          )}
          {tab === "exams" && (
            <div className="space-y-6">
              <div className="soft-card p-6">
                <h2 className="text-lg font-bold text-[#092b4c]">
                  1. Tải tệp đề nguồn một lần
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Nhận PDF, DOCX, Excel mẫu, JPG và PNG. Có thể chọn nhiều ảnh để ghép thành một đề. Tệp được quét mã độc và xử lý nền; tối đa 15 MB/tệp, 50 MB/lượt ảnh.
                </p>
                {storage && (
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600" aria-label="Dung lượng kho tệp">
                    <strong className="text-[#092b4c]">Kho tệp</strong>
                    <span>{(storage.usedBytes / 1024 / 1024).toFixed(1)} MB / {(storage.quotaBytes / 1024 / 1024 / 1024).toFixed(1)} GB</span>
                    <span>{storage.sources} đề nguồn · {storage.materials} tài liệu</span>
                  </div>
                )}
                <form
                  onSubmit={sourceUpload}
                  className="mt-5 flex flex-wrap items-end gap-3"
                >
                  <label className="min-w-72 text-sm font-semibold">
                    <span className="block">Chọn tệp đề</span>
                    <span className="field-control mt-2 flex min-h-12 items-center gap-3 p-2">
                      <span className="rounded-lg bg-[#123d68] px-3 py-2 text-xs font-bold text-white">Chọn tệp</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-normal text-slate-600">
                        {sourceFileNames.length === 0
                          ? "Chưa chọn tệp"
                          : sourceFileNames.length === 1
                            ? sourceFileNames[0]
                            : `${sourceFileNames.length} ảnh đã chọn`}
                      </span>
                    </span>
                    <input
                      type="file"
                      name="file"
                      accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      multiple
                      required
                      className="sr-only"
                      onChange={(event) => setSourceFileNames(Array.from(event.target.files || []).map((file) => file.name))}
                    />
                  </label>
                  <button disabled={busy} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">
                    {busy ? "Đang tải lên..." : "Tải lên"}
                  </button>
                </form>
                {sources.length > 0 && (
                  <div className="mt-5 text-sm text-slate-600">
                    {sources.map((source) => (
                      <div
                        key={source.id}
                        className="border-t border-slate-100 py-3"
                      >
                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                          <span className="min-w-0 break-words font-semibold text-[#092b4c]">{source.fileName}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${source.status === "READY" ? "bg-emerald-50 text-emerald-700" : source.status === "FAILED" || source.status === "QUARANTINED" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>
                            {source.statusMessage || sourceStatusLabels[source.status]}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                          <span>{source.mimeType === "application/pdf" ? `${source.pageCount} trang` : "Nhập toàn bộ tệp"}</span>
                          <span>{(source.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>
                        </div>
                        {source.status !== "READY" && source.status !== "FAILED" && source.status !== "QUARANTINED" && (
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={source.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Tiến độ xử lý ${source.fileName}`}>
                            <div className="h-full rounded-full bg-[#123d68] transition-[width] duration-500" style={{ width: `${source.progress}%` }} />
                          </div>
                        )}
                        {source.lastError && <p className="mt-2 text-xs leading-5 text-red-700">{source.lastError}</p>}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(source.status === "FAILED" || source.status === "QUARANTINED") && (
                            <button type="button" disabled={busy} className="text-xs font-bold text-[#123d68] underline underline-offset-4" onClick={() => action(() => request(`/staff/content/sources/${source.id}/retry`, { method: "POST" }), "Đã đưa tệp vào hàng đợi xử lý lại.")}>Thử lại</button>
                          )}
                          {source._count.exams === 0 ? (
                            <button type="button" disabled={busy} className="text-xs font-bold text-red-700 underline underline-offset-4" onClick={() => { if (window.confirm(`Xóa tệp “${source.fileName}”? Thao tác này không thể hoàn tác.`)) void action(() => request(`/staff/content/sources/${source.id}`, { method: "DELETE" }), "Đã xóa tệp nguồn không còn sử dụng."); }}>Xóa tệp</button>
                          ) : (
                            <span className="text-xs text-slate-500">Đang dùng cho {source._count.exams} đề</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="soft-card p-6">
                <h2 className="text-lg font-bold text-[#092b4c]">
                  2. Chuyển tệp thành câu hỏi web
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Hệ thống chuẩn hóa câu hỏi từ PDF, Word, Excel hoặc ảnh. Giáo
                  viên vẫn rà soát nội dung và đáp án trước khi gửi duyệt.
                </p>
                <form
                  onSubmit={createExam}
                  className="mt-5 grid gap-4 md:grid-cols-2"
                >
                  <label className="text-sm font-semibold md:col-span-2">
                    Tệp nguồn
                    <select
                      name="sourceId"
                      required
                      value={selectedSourceId}
                      onChange={(event) => setSelectedSourceId(event.target.value)}
                      className="field-control mt-2 p-3"
                    >
                      <option value="">Chọn file</option>
                      {sources.filter((source) => source.status === "READY").map((source) => (
                        <option key={source.id} value={source.id}>
                          {source.fileName} ({source.mimeType === "application/pdf" ? `${source.pageCount} trang` : "toàn bộ tệp"})
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field name="title" label="Tên đề" required />
                  <Field name="summary" label="Mô tả" />
                  <LevelFields />
                  {selectedSource?.mimeType === "application/pdf" ? (
                    <>
                      <Field name="startPage" label="Từ trang" type="number" min="1" required />
                      <Field name="endPage" label="Đến trang" type="number" min="1" required />
                    </>
                  ) : (
                    <>
                      <input type="hidden" name="startPage" value="1" />
                      <input type="hidden" name="endPage" value="1" />
                      <div className="surface-inset p-4 text-sm leading-6 text-slate-600 md:col-span-2">
                        DOCX, Excel và ảnh được nhập toàn bộ. Với Excel, bạn có thể{" "}
                        <a href={`${api}/staff/content/exam-template`} className="font-bold text-[#123d68] underline underline-offset-4">
                          tải file mẫu tại đây
                        </a>.
                      </div>
                    </>
                  )}
                  <label className="text-sm font-semibold">
                    Thời gian làm bài
                    <select
                      name="durationMinutes"
                      defaultValue="45"
                      className="field-control mt-2 p-3"
                    >
                      {[15, 30, 45, 60, 90, 120].map((minutes) => (
                        <option key={minutes} value={minutes}>
                          {minutes} phút
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-semibold md:col-span-2">
                    Đáp án hàng loạt (không bắt buộc)
                    <textarea
                      name="answerText"
                      className="field-control mt-2 min-h-24 p-3"
                      placeholder="1:D, 2:A, 3:C"
                    />
                  </label>
                  <label className="flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm md:col-span-2">
                    <input
                      type="checkbox"
                      name="extractQuestions"
                      defaultChecked
                      className="mt-1 size-4 accent-[#0b3157]"
                    />
                    <span>
                      <strong className="block text-[#092b4c]">
                        Tự động chuyển tệp thành câu hỏi web
                      </strong>
                      <span className="mt-1 block leading-6 text-slate-600">
                        PDF có lớp chữ và Excel mẫu cho kết quả tốt nhất. OCR từ
                        ảnh hoặc PDF scan có thể cần sửa lại nhiều hơn.
                      </span>
                    </span>
                  </label>
                  <button
                    disabled={busy || !sources.some((source) => source.status === "READY")}
                    className="btn-primary w-fit md:col-span-2"
                  >
                    Tạo bản nháp
                  </button>
                </form>
              </div>
              <div className="soft-card p-6">
                <h2 className="text-lg font-bold text-[#092b4c]">
                  3. Kiểm tra và gửi duyệt
                </h2>
                {!exams.length && (
                  <p className="mt-4 text-sm text-slate-500">Chưa có đề.</p>
                )}
                <div className="mt-4 space-y-3">
                  {exams.map((exam) => (
                    <article
                      key={exam.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-[#092b4c]">
                            {exam.title}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {gradeLabel(exam.grade)} · {exam.source.mimeType === "application/pdf" ? `Trang ${exam.startPage}–${exam.endPage}` : exam.source.fileName} · {exam.questions.length} câu web ·{" "}
                            {statusLabels[exam.status]}
                          </p>
                          {exam.extractionStatus !== "READY" && (
                            <p className={`mt-2 text-xs font-bold ${exam.extractionStatus === "FAILED" ? "text-red-700" : "text-blue-700"}`}>
                              {exam.extractionStatus === "FAILED"
                                ? "Trích xuất lỗi — có thể thử lại hoặc nhập câu thủ công"
                                : `Đang xử lý câu hỏi · ${exam.extractionProgress}%`}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={`${api}/staff/content/exams/${exam.id}/file`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-outline min-h-9 px-3"
                          >
                            {exam.source.mimeType === "application/pdf" ? "Xem PDF" : "Mở tệp nguồn"}
                          </a>
                          <button
                            disabled={busy || exam.extractionStatus === "QUEUED" || exam.extractionStatus === "PROCESSING"}
                            onClick={() => setSelectedExam(exam.id)}
                            className="btn-outline min-h-9 px-3"
                          >
                            Duyệt câu hỏi
                          </button>
                          {exam.status !== "PUBLISHED" && (
                            <button
                              disabled={busy || exam.extractionStatus === "QUEUED" || exam.extractionStatus === "PROCESSING"}
                              onClick={() =>
                                action(
                                  () =>
                                    request(
                                      `/staff/content/exams/${exam.id}/extract`,
                                      { method: "POST" },
                                    ),
                                  "Đã đưa yêu cầu trích xuất lại vào hàng đợi nền.",
                                )
                              }
                              className="btn-outline min-h-9 px-3"
                            >
                              Trích xuất lại
                            </button>
                          )}
                          {exam.status !== "PUBLISHED" && (
                            <button
                              disabled={busy || exam.extractionStatus !== "READY"}
                              onClick={() =>
                                patch(
                                  `/staff/content/exams/${exam.id}/status`,
                                  {
                                    status:
                                      role === "ADMIN" ? "PUBLISHED" : "REVIEW",
                                  },
                                  role === "ADMIN"
                                    ? "Đã xuất bản đề."
                                    : "Đã gửi đề chờ admin duyệt.",
                                )
                              }
                              className="btn-primary min-h-9 px-3"
                            >
                              {role === "ADMIN" ? "Xuất bản" : "Gửi duyệt"}
                            </button>
                          )}
                          {role === "ADMIN" && exam.status === "PUBLISHED" && (
                            <button
                              onClick={() =>
                                patch(
                                  `/staff/content/exams/${exam.id}/status`,
                                  { status: "DRAFT" },
                                  "Đã gỡ đề về bản nháp.",
                                )
                              }
                              className="btn-outline min-h-9 px-3"
                            >
                              Gỡ đề
                            </button>
                          )}
                        </div>
                      </div>
                      {(exam.extractionStatus === "QUEUED" || exam.extractionStatus === "PROCESSING") && (
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`Tiến độ trích xuất ${exam.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={exam.extractionProgress}>
                          <div className="h-full rounded-full bg-[#123d68] transition-[width] duration-500" style={{ width: `${exam.extractionProgress}%` }} />
                        </div>
                      )}
                      {exam.extractionError && (
                        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                          {exam.extractionError}
                        </p>
                      )}
                      {Array.isArray(exam.extractionWarnings) &&
                        exam.extractionWarnings.length > 0 && (
                          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                            Lưu ý trích xuất:{" "}
                            {exam.extractionWarnings.join(" · ")}
                          </p>
                        )}
                    </article>
                  ))}
                </div>
                {selectedExam &&
                  (() => {
                    const exam = exams.find((item) => item.id === selectedExam);
                    return exam ? (
                      <Modal
                        open
                        size="xl"
                        title={`Duyệt câu hỏi · ${exam.title}`}
                        description={`${gradeLabel(exam.grade)} · ${exam.questions.length} câu web · ${statusLabels[exam.status]}`}
                        onClose={() => setSelectedExam(null)}
                      >
                        <AnswerEditor
                          exam={exam}
                          busy={busy}
                          role={role}
                          onConfirmTrusted={() =>
                            action(
                              () =>
                                request(
                                  `/staff/content/exams/${exam.id}/questions/confirm-trusted`,
                                  { method: "POST" },
                                ),
                              "Đã xác nhận các câu hệ thống nhận diện rõ ràng.",
                            )
                          }
                          onBulk={(answerText) =>
                            patch(
                              `/staff/content/exams/${exam.id}/keys`,
                              { answerText },
                              "Đã lưu đáp án.",
                            )
                          }
                          onQuestion={(body) =>
                            patch(
                              `/staff/content/exams/${exam.id}/questions`,
                              body,
                              "Đã lưu câu.",
                            )
                          }
                          onDelete={(position) =>
                            remove(
                              `/staff/content/exams/${exam.id}/questions/${position}`,
                            )
                          }
                        />
                      </Modal>
                    ) : null;
                  })()}
              </div>
            </div>
          )}
          {tab === "attempts" && (
            <div className="space-y-4">
              <div className="soft-card p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-[#092b4c]">
                      Theo dõi và chấm bài
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Bài nháp cho biết tiến độ đang làm; bài đã nộp nhưng chưa
                      có đáp án tự động sẽ chờ giáo viên nhập điểm.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    {attempts.length} bài làm
                  </span>
                </div>
              </div>
              {attempts.map((attemptItem) => (
                <article key={attemptItem.id} className="soft-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-extrabold text-[#092b4c]">
                          {attemptItem.user?.fullName ||
                            attemptItem.participantName ||
                            "Khách"}
                        </h3>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase ${attemptItem.status === "GRADED" ? "bg-emerald-50 text-emerald-700" : attemptItem.status === "SUBMITTED" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}
                        >
                          {attemptItem.status === "DRAFT"
                            ? "Đang làm"
                            : statusLabels[attemptItem.status]}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {attemptItem.exam.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {answeredCount(attemptItem.answers)}/
                        {attemptItem.exam.questions.length} câu đã trả lời · Cập
                        nhật {formatDate(attemptItem.updatedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {attemptItem.status !== "DRAFT" && (
                        <strong className="text-sm text-[#092b4c]">
                          {attemptItem.earned + attemptItem.manualEarned}/
                          {attemptItem.possible + attemptItem.manualPossible}{" "}
                          điểm
                        </strong>
                      )}
                      <button
                        className="btn-outline min-h-10 px-4"
                        onClick={() => setSelectedAttempt(attemptItem.id)}
                      >
                        {attemptItem.status === "DRAFT"
                          ? "Xem tiến độ"
                          : "Xem / chấm bài"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              {selectedAttempt &&
                (() => {
                  const attemptItem = attempts.find(
                    (item) => item.id === selectedAttempt,
                  );
                  return attemptItem ? (
                    <Modal
                      open
                      size="xl"
                      title={
                        attemptItem.user?.fullName ||
                        attemptItem.participantName ||
                        "Bài làm của khách"
                      }
                      description={`${attemptItem.exam.title} · ${answeredCount(attemptItem.answers)}/${attemptItem.exam.questions.length} câu đã trả lời`}
                      onClose={() => setSelectedAttempt(null)}
                    >
                      <AttemptReview
                        attempt={attemptItem}
                        busy={busy}
                        onGrade={(scores, feedback) =>
                          patch(
                            `/staff/content/attempts/${attemptItem.id}/grade`,
                            { scores, feedback },
                            "Đã lưu điểm chấm tay và nhận xét.",
                          )
                        }
                      />
                    </Modal>
                  ) : null;
                })()}
              {!attempts.length && (
                <div className="soft-card p-8 text-center text-sm text-slate-500">
                  Chưa có học viên hoặc khách bắt đầu làm đề.
                </div>
              )}
            </div>
          )}
          {tab === "materials" && (
            <div className="space-y-6">
              <div className="soft-card p-6">
                <h2 className="text-lg font-bold text-[#092b4c]">
                  Đăng tài liệu PDF/DOCX
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Tệp được lưu trên máy chủ demo; tài liệu sẽ chỉ công khai sau
                  khi admin duyệt.
                </p>
                <form
                  onSubmit={createMaterial}
                  className="mt-5 grid gap-4 md:grid-cols-2"
                >
                  <Field name="title" label="Tên tài liệu" required />
                  <CategoryField />
                  <LevelFields />
                  <label className="text-sm font-semibold md:col-span-2">
                    Mô tả
                    <textarea
                      name="summary"
                      className="field-control mt-2 min-h-20 p-3"
                    />
                  </label>
                  <label className="text-sm font-semibold md:col-span-2">
                    Tệp PDF/DOCX
                    <input
                      name="file"
                      type="file"
                      accept=".pdf,.docx,application/pdf"
                      required
                      className="field-control mt-2 p-2"
                    />
                  </label>
                  <button
                    disabled={busy}
                    className="btn-primary w-fit md:col-span-2"
                  >
                    Tải tài liệu
                  </button>
                </form>
              </div>
              <div className="soft-card p-6">
                <h2 className="text-lg font-bold text-[#092b4c]">
                  Hoặc dùng liên kết Google Drive
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Dùng khi tài liệu đã có trên Drive của trung tâm. Kiểm tra
                  quyền chia sẻ trước khi gửi duyệt.
                </p>
                <form
                  onSubmit={createDriveLink}
                  className="mt-5 grid gap-4 md:grid-cols-2"
                >
                  <Field name="title" label="Tên tài liệu" required />
                  <CategoryField />
                  <DriveLevelField />
                  <Field
                    name="driveUrl"
                    label="Liên kết Drive"
                    type="url"
                    required
                  />
                  <label className="text-sm font-semibold md:col-span-2">
                    Mô tả
                    <textarea
                      name="summary"
                      required
                      className="field-control mt-2 min-h-20 p-3"
                    />
                  </label>
                  <button
                    disabled={busy}
                    className="btn-outline w-fit md:col-span-2"
                  >
                    Lưu liên kết
                  </button>
                </form>
              </div>
              <div className="soft-card p-6">
                <h2 className="text-lg font-bold text-[#092b4c]">
                  Tài liệu đã đăng
                </h2>
                <div className="mt-4 space-y-3">
                  {materials.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"
                    >
                      <div>
                        <strong className="text-[#092b4c]">{item.title}</strong>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.fileName || "Liên kết"} ·{" "}
                          {item.grade !== null
                            ? gradeLabel(item.grade)
                            : item.category}{" "}
                          · {statusLabels[item.status] || item.status}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {item.status !== "PUBLISHED" && (
                          <button
                            disabled={busy}
                            className="btn-primary min-h-9 px-3"
                            onClick={() =>
                              patch(
                                `/staff/content/materials/${item.id}/status`,
                                {
                                  status:
                                    role === "ADMIN" ? "PUBLISHED" : "REVIEW",
                                },
                                role === "ADMIN"
                                  ? "Đã xuất bản tài liệu."
                                  : "Đã gửi tài liệu chờ duyệt.",
                              )
                            }
                          >
                            {role === "ADMIN" ? "Xuất bản" : "Gửi duyệt"}
                          </button>
                        )}
                        {role === "ADMIN" && item.status === "PUBLISHED" && (
                          <button
                            className="btn-outline min-h-9 px-3"
                            onClick={() =>
                              patch(
                                `/staff/content/materials/${item.id}/status`,
                                { status: "DRAFT" },
                                "Đã gỡ tài liệu.",
                              )
                            }
                          >
                            Gỡ
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {!materials.length && (
                    <p className="text-sm text-slate-500">Chưa có tài liệu.</p>
                  )}
                </div>
              </div>
            </div>
          )}
          {tab === "materials" &&
            materials.some((item) => item.fileName || item.driveUrl) && (
              <div className="soft-card mt-6 p-6">
                <h2 className="text-lg font-bold text-[#092b4c]">
                  Kiểm tra tệp / liên kết trước khi duyệt
                </h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {materials
                    .filter((item) => item.fileName || item.driveUrl)
                    .map((item) => (
                      <a
                        key={item.id}
                        href={
                          item.fileName
                            ? `${api}/staff/content/materials/${item.id}/file`
                            : item.driveUrl || "#"
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-[#123d68] hover:border-[#123d68]"
                      >
                        {item.title} ↗
                      </a>
                    ))}
                </div>
              </div>
            )}
          {tab === "applications" && role === "ADMIN" && (
            <div className="soft-card overflow-x-auto p-6">
              <h2 className="text-lg font-bold text-[#092b4c]">
                Hồ sơ ứng tuyển
              </h2>
              <div className="mt-4 space-y-3">
                {applications.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap justify-between gap-4">
                      <div>
                        <strong className="text-[#092b4c]">
                          {item.fullName}
                        </strong>
                        <p className="mt-1 text-sm">
                          {item.phone} · {item.email}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.area} · {item.experience}
                        </p>
                        {item.message && (
                          <p className="mt-3 text-sm text-slate-600">
                            {item.message}
                          </p>
                        )}
                      </div>
                      <label className="text-xs font-semibold">
                        Trạng thái
                        <select
                          value={item.status}
                          onChange={(event) =>
                            patch(
                              `/admin/content/applications/${item.id}/status`,
                              { status: event.target.value },
                              "Đã cập nhật hồ sơ.",
                            )
                          }
                          className="field-control mt-2 p-2"
                        >
                          {[
                            "NEW",
                            "CONTACTED",
                            "INTERVIEW",
                            "HIRED",
                            "REJECTED",
                          ].map((status) => (
                            <option key={status} value={status}>
                              {statusLabels[status]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </article>
                ))}
                {!applications.length && (
                  <p className="text-sm text-slate-500">
                    Chưa có hồ sơ ứng tuyển.
                  </p>
                )}
              </div>
            </div>
          )}
          {tab === "leads" && role === "ADMIN" && (
            <div className="soft-card p-6">
              <h2 className="text-lg font-bold text-[#092b4c]">
                Đăng ký tư vấn
              </h2>
              <div className="mt-4 space-y-3">
                {leads.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 p-4 text-sm"
                  >
                    <strong>{item.parentName}</strong> · {item.phone}
                    <p className="mt-1 text-slate-500">
                      Học viên: {item.studentName} · {item.interestedCourse} ·{" "}
                      {item.status}
                    </p>
                  </div>
                ))}
                {!leads.length && (
                  <p className="text-sm text-slate-500">Chưa có đăng ký.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function answeredCount(value: unknown) {
  return Object.values(objectRecord(value)).filter(
    (answer) => typeof answer === "string" && answer.trim(),
  ).length;
}

function comparableAnswer(value: string, kind: string) {
  const normalized = value.trim();
  if (kind === "SINGLE_CHOICE") {
    const letter = normalized.match(/^([A-H])(?:[.)]|\s|$)/i)?.[1];
    if (letter) return letter.toUpperCase();
  }
  return normalized.toLocaleLowerCase("vi");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function AttemptReview({
  attempt,
  busy,
  onGrade,
}: {
  attempt: StaffAttempt;
  busy: boolean;
  onGrade: (scores: Record<string, number>, feedback: string) => void;
}) {
  const answers = objectRecord(attempt.answers);
  const manualScores = objectRecord(attempt.manualScores);
  const pendingQuestions = attempt.exam.questions.filter(
    (question) => question.kind === "ESSAY" || !question.answer,
  );
  return (
    <div>
      {attempt.user?.email && (
        <p className="mb-3 text-xs text-slate-500">
          Tài khoản: {attempt.user.email}
        </p>
      )}
      <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-2">
        {attempt.exam.questions.map((question) => {
          const response = String(answers[String(question.position)] || "");
          const options = questionOptions(question.options);
          const selectedOption = options.find(
            (option) =>
              option.match(/^([A-H])[.)]/i)?.[1]?.toUpperCase() ===
              response.trim().toUpperCase(),
          );
          const automatic = question.kind !== "ESSAY" && !!question.answer;
          const correct =
            automatic &&
            comparableAnswer(response, question.kind) ===
              comparableAnswer(question.answer || "", question.kind);
          return (
            <div
              key={question.position}
              className="rounded-xl border border-slate-200 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <strong className="text-sm text-[#092b4c]">
                    Câu {question.position}
                  </strong>
                  {question.section && (
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-[#d91f2a]">
                      {question.section}
                    </p>
                  )}
                  <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-[#172b3e]">
                    {question.content || "Không có nội dung chữ"}
                  </p>
                  {question.sourcePage && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Trang PDF {question.sourcePage}
                    </p>
                  )}
                  {options.length > 0 && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {options.map((option) => {
                        const letter =
                          option.match(/^([A-H])[.)]/i)?.[1]?.toUpperCase() ||
                          option;
                        const chosen =
                          response.trim().toUpperCase() ===
                          letter.toUpperCase();
                        const answer =
                          question.answer?.trim().toUpperCase() ===
                          letter.toUpperCase();
                        return (
                          <div
                            key={option}
                            className={`rounded-lg border px-3 py-2 text-xs leading-5 ${chosen ? "border-[#123d68] bg-[#edf3f8] font-bold text-[#092b4c]" : answer ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600"}`}
                          >
                            {option}
                            {chosen && (
                              <span className="ml-2 text-[11px] uppercase text-[#123d68]">
                                Học viên chọn
                              </span>
                            )}
                            {answer && (
                              <span className="ml-2 text-[11px] uppercase text-emerald-700">
                                Đáp án
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-semibold">Bài làm:</span>{" "}
                    {selectedOption || response || "Chưa trả lời"}
                  </p>
                </div>
                {attempt.status !== "DRAFT" && (
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-extrabold ${automatic ? (correct ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700") : manualScores[String(question.position)] !== undefined ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                  >
                    {automatic
                      ? correct
                        ? "Đúng tự động"
                        : `Sai · Đáp án ${question.answer}`
                      : manualScores[String(question.position)] !== undefined
                        ? `${manualScores[String(question.position)]}/${question.points} điểm`
                        : "Chờ chấm tay"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {attempt.status === "DRAFT" && (
        <p className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
          Học viên đang làm bài. Câu trả lời sẽ tiếp tục được tự động lưu, chưa
          thể chấm cho đến khi bài được nộp.
        </p>
      )}
      {attempt.status !== "DRAFT" && pendingQuestions.length > 0 && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const values = new FormData(event.currentTarget);
            const scores: Record<string, number> = {};
            for (const question of pendingQuestions) {
              const raw = String(
                values.get(`score-${question.position}`) || "",
              );
              if (raw !== "") scores[String(question.position)] = Number(raw);
            }
            onGrade(scores, String(values.get("feedback") || ""));
          }}
          className="mt-5 rounded-xl bg-[#f7f9fb] p-4"
        >
          <h4 className="font-bold text-[#092b4c]">Chấm các câu còn lại</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pendingQuestions.map((question) => (
              <label key={question.position} className="text-xs font-semibold">
                Câu {question.position} · tối đa {question.points} điểm
                <input
                  name={`score-${question.position}`}
                  type="number"
                  min="0"
                  max={question.points}
                  step="0.1"
                  defaultValue={
                    manualScores[String(question.position)] === undefined
                      ? ""
                      : String(manualScores[String(question.position)])
                  }
                  className="field-control mt-1 p-2"
                  placeholder="Chưa chấm"
                />
              </label>
            ))}
          </div>
          <label className="mt-4 block text-xs font-semibold">
            Nhận xét cho học viên
            <textarea
              name="feedback"
              defaultValue={attempt.teacherFeedback || ""}
              className="field-control mt-1 min-h-20 p-3 text-sm"
              placeholder="Điểm mạnh, nội dung cần ôn lại..."
            />
          </label>
          <button disabled={busy} className="btn-primary mt-4">
            Lưu điểm và nhận xét
          </button>
        </form>
      )}
    </div>
  );
}

function Summary({ value, label }: { value: number; label: string }) {
  return (
    <div className="metric-cell">
      <strong>{value}</strong>
      <p className="mt-3 text-sm font-semibold text-slate-500">{label}</p>
    </div>
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
  min?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <input name={name} className="field-control mt-2 p-3" {...props} />
    </label>
  );
}
function LevelFields() {
  const [level, setLevel] = useState("PRIMARY");
  const grades = gradesForLevel(level);
  return (
    <>
      <label className="text-sm font-semibold">
        Cấp học
        <select
          name="schoolLevel"
          required
          value={level}
          onChange={(event) => setLevel(event.target.value)}
          className="field-control mt-2 p-3"
        >
          {schoolLevels.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-semibold">
        Lớp
        <select name="grade" required className="field-control mt-2 p-3">
          {grades.map((grade) => (
            <option key={grade} value={grade}>
              {gradeLabel(grade)}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

function CategoryField() {
  return (
    <label className="text-sm font-semibold">
      Danh mục
      <select name="category" required className="field-control mt-2 p-3">
        <option value="">Chọn danh mục</option>
        {materialCategories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
    </label>
  );
}

function DriveLevelField() {
  return (
    <label className="text-sm font-semibold">
      Cấp học / lớp
      <select name="level" required className="field-control mt-2 p-3">
        <option value="">Chọn lớp</option>
        {schoolLevels.flatMap((level) =>
          level.grades.map((grade) => (
            <option key={`${level.value}-${grade}`} value={gradeLabel(grade)}>
              {level.label} · {gradeLabel(grade)}
            </option>
          )),
        )}
      </select>
    </label>
  );
}

function questionOptions(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function questionReviewFlags(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function reviewFlagLabel(flag: string) {
  const labels: Record<string, string> = {
    LOW_CONFIDENCE: "Độ tin cậy thấp",
    AMBIGUOUS_NUMBERING: "Đánh số chưa rõ",
    NO_OPTIONS: "Không có lựa chọn",
    POSSIBLE_VOCABULARY: "Có thể là từ vựng",
    OCR_REVIEW: "Nội dung OCR",
    LEGACY_IMPORT: "Cần nhận dạng lại",
    POSSIBLE_THEORY: "Có thể là phần lý thuyết",
    MATCHING_CONVERTED: "Đã chuyển từ nối cột",
    COMPLEX_LAYOUT: "Bố cục phức tạp",
    LEARNED_CORRECTION: "Đã áp dụng bản sửa trước",
  };
  return labels[flag] || "Cần rà soát";
}

function AnswerEditor({
  exam,
  busy,
  role,
  onBulk,
  onQuestion,
  onDelete,
  onConfirmTrusted,
}: {
  exam: Exam;
  busy: boolean;
  role: Role;
  onBulk: (value: string) => void;
  onQuestion: (body: object) => void;
  onDelete: (position: number) => void;
  onConfirmTrusted: () => void;
}) {
  const [bulk, setBulk] = useState("");
  const [filter, setFilter] = useState<"ALL" | "REVIEW" | "CONFIRMED">("ALL");
  const [showManual, setShowManual] = useState(false);
  const [activePosition, setActivePosition] = useState(exam.questions[0]?.position ?? 1);
  const unreviewed = exam.questions.filter((question) => !question.reviewedAt);
  const needsReview = unreviewed.filter(
    (question) =>
      question.recognitionConfidence < 0.68 ||
      questionReviewFlags(question.reviewFlags).some((flag) =>
        ["POSSIBLE_VOCABULARY", "POSSIBLE_THEORY", "COMPLEX_LAYOUT", "OCR_REVIEW"].includes(flag),
      ),
  );
  const confirmed = exam.questions.filter((question) => Boolean(question.reviewedAt));
  const trustedUnreviewed = unreviewed.filter((question) => !needsReview.includes(question));
  const visibleQuestions =
    filter === "REVIEW" ? needsReview : filter === "CONFIRMED" ? confirmed : exam.questions;
  const activeQuestion =
    exam.questions.find((question) => question.position === activePosition) ||
    visibleQuestions[0] ||
    exam.questions[0];
  const relativePage = activeQuestion?.sourcePage
    ? Math.max(1, activeQuestion.sourcePage - exam.startPage + 1)
    : 1;

  return (
    <div>
      <div className="grid gap-px overflow-hidden rounded-xl bg-slate-200 sm:grid-cols-3">
        <div className="bg-white px-4 py-3">
          <span className="block text-xs font-semibold text-slate-500">Tổng số câu</span>
          <strong className="mt-1 block text-lg text-[#092b4c]">{exam.questions.length} câu</strong>
        </div>
        <div className="bg-white px-4 py-3">
          <span className="block text-xs font-semibold text-slate-500">Cần giáo viên xem</span>
          <strong className={`mt-1 block text-lg ${needsReview.length ? "text-amber-700" : "text-emerald-700"}`}>
            {needsReview.length} câu
          </strong>
        </div>
        <div className="bg-white px-4 py-3">
          <span className="block text-xs font-semibold text-slate-500">Đã kiểm tra</span>
          <strong className="mt-1 block text-lg text-emerald-700">{confirmed.length} câu</strong>
        </div>
      </div>

      {trustedUnreviewed.length > 0 && exam.status !== "PUBLISHED" && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-blue-50 px-4 py-3 text-sm text-[#123d68]">
          <p className="leading-6">
            <strong>{trustedUnreviewed.length} câu</strong> được nhận diện rõ ràng và có thể xác nhận nhanh.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirmTrusted}
            className="btn-outline min-h-10 bg-white px-4"
          >
            Xác nhận các câu rõ ràng
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Lọc câu hỏi">
        {(["ALL", "REVIEW", "CONFIRMED"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`min-h-10 rounded-lg px-3 text-sm font-bold transition-colors ${filter === value ? "bg-[#123d68] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {value === "ALL"
              ? `Tất cả (${exam.questions.length})`
              : value === "REVIEW"
                ? `Cần kiểm tra (${needsReview.length})`
                : `Đã kiểm tra (${confirmed.length})`}
          </button>
        ))}
      </div>

      <details className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
        <summary className="cursor-pointer text-sm font-bold text-[#123d68]">
          Nhập nhanh đáp án nếu đã có bảng đáp án
        </summary>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={bulk}
            onChange={(event) => setBulk(event.target.value)}
            className="field-control min-w-64 flex-1 p-2 text-sm"
            placeholder="Ví dụ: 1:D, 2:A, 3:C"
          />
          <button
            type="button"
            disabled={busy || exam.status === "PUBLISHED" || !bulk.trim()}
            onClick={() => onBulk(bulk)}
            className="btn-outline min-h-10 px-3"
          >
            Lưu bảng đáp án
          </button>
        </div>
      </details>

      <div className="mt-5 grid min-h-0 gap-4 lg:grid-cols-[minmax(300px,.82fr)_minmax(0,1.18fr)]">
        <section className="review-source-preview min-w-0 overflow-hidden rounded-xl bg-slate-100 h-[45vh] lg:sticky lg:top-0 lg:h-[65vh]" aria-label="Tệp đề gốc">
          <div className="flex min-h-12 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4">
            <div className="min-w-0">
              <strong className="block truncate text-sm text-[#092b4c]">Đề gốc để đối chiếu</strong>
              <span className="block text-xs text-slate-500">
                {activeQuestion?.sourcePage ? `Đang xem trang ${activeQuestion.sourcePage}` : "Chọn một câu để đối chiếu"}
              </span>
            </div>
            <a className="shrink-0 text-xs font-bold text-[#123d68] underline underline-offset-4" href={`${api}/staff/content/exams/${exam.id}/file`} target="_blank" rel="noreferrer">
              Mở riêng
            </a>
          </div>
          {exam.source.mimeType === "application/pdf" ? (
            <iframe
              key={relativePage}
              title={`Đề gốc ${exam.title}, trang ${relativePage}`}
              src={`${api}/staff/content/exams/${exam.id}/file#page=${relativePage}&view=FitH`}
              className="h-[calc(45vh-3rem)] w-full bg-slate-200 lg:h-[calc(65vh-3rem)]"
            />
          ) : (
            <div className="grid h-[calc(45vh-3rem)] place-items-center p-6 text-center lg:h-[calc(65vh-3rem)]">
              <div>
                <FileSearch className="mx-auto text-[#123d68]" aria-hidden="true" />
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Định dạng này cần mở trong cửa sổ riêng để đối chiếu.
                </p>
              </div>
            </div>
          )}
        </section>

        <div className="review-question-list min-w-0 space-y-3 lg:max-h-[65vh] lg:overflow-y-auto lg:pr-2">
          {visibleQuestions.map((question) => (
            <QuestionReviewCard
              key={question.position}
              question={question}
              active={question.position === activeQuestion?.position}
              disabled={busy || exam.status === "PUBLISHED"}
              showTechnical={role === "ADMIN"}
              onActivate={() => setActivePosition(question.position)}
              onSave={onQuestion}
              onDelete={() => onDelete(question.position)}
            />
          ))}
          {!visibleQuestions.length && exam.questions.length > 0 && (
            <div className="rounded-xl bg-emerald-50 p-5 text-sm leading-6 text-emerald-800">
              Không còn câu nào trong nhóm này.
            </div>
          )}
          {!exam.questions.length && (
            <p className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">
              Chưa nhận diện được câu hỏi. Hãy kiểm tra tệp nguồn hoặc thêm câu bị thiếu.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-5">
        <button type="button" onClick={() => setShowManual((value) => !value)} className="btn-outline min-h-10 px-4">
          {showManual ? "Đóng phần thêm câu" : "Thêm câu bị thiếu"}
        </button>
        {showManual && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const values = Object.fromEntries(new FormData(event.currentTarget));
              onQuestion({
                position: Number(values.position),
                answer: values.answer,
                kind: values.kind,
                points: Number(values.points),
                content: values.content,
                section: values.section,
                options: String(values.options || "").split("\n").map((option) => option.trim()).filter(Boolean),
              });
              event.currentTarget.reset();
              setShowManual(false);
            }}
            className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"
          >
            <Field name="position" label="Vị trí câu" type="number" min="1" required />
            <label className="text-sm font-semibold">
              Loại câu hỏi
              <select name="kind" className="field-control mt-2 p-3">
                <option value="SINGLE_CHOICE">Trắc nghiệm</option>
                <option value="SHORT_TEXT">Điền ngắn</option>
                <option value="ESSAY">Tự luận</option>
              </select>
            </label>
            <Field name="section" label="Tên phần" placeholder="Ví dụ: I. Pronunciation" />
            <Field name="answer" label="Đáp án" placeholder="A hoặc nội dung đáp án" />
            <label className="text-sm font-semibold sm:col-span-2">
              Nội dung câu hỏi
              <textarea name="content" required className="field-control mt-2 min-h-24 p-3" />
            </label>
            <label className="text-sm font-semibold sm:col-span-2">
              Các lựa chọn (mỗi dòng một lựa chọn)
              <textarea name="options" className="field-control mt-2 min-h-28 p-3" placeholder={"A. Lựa chọn thứ nhất\nB. Lựa chọn thứ hai"} />
            </label>
            <label className="text-sm font-semibold">
              Điểm
              <input name="points" type="number" min="0.1" step="0.1" defaultValue="1" className="field-control mt-2 p-3" />
            </label>
            <button disabled={busy || exam.status === "PUBLISHED"} className="btn-primary mt-auto min-h-12 px-3">
              Thêm câu
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function QuestionReviewCard({
  question,
  active,
  disabled,
  showTechnical,
  onActivate,
  onSave,
  onDelete,
}: {
  question: Question;
  active: boolean;
  disabled: boolean;
  showTechnical: boolean;
  onActivate: () => void;
  onSave: (body: object) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const options = questionOptions(question.options);
  const flags = questionReviewFlags(question.reviewFlags);
  const confidence = Math.round((question.recognitionConfidence ?? 1) * 100);
  const reviewed = Boolean(question.reviewedAt);
  const importantFlags = flags.filter((flag) =>
    ["NO_OPTIONS", "POSSIBLE_VOCABULARY", "POSSIBLE_THEORY", "OCR_REVIEW", "COMPLEX_LAYOUT", "LEARNED_CORRECTION"].includes(flag),
  );
  const currentBody = {
    position: question.position,
    answer: question.answer || "",
    kind: question.kind,
    points: question.points,
    content: question.content || "",
    section: question.section || "",
    options,
  };
  const statusLabel = reviewed ? "Đã kiểm tra" : confidence >= 68 ? "Sẵn sàng xác nhận" : "Cần kiểm tra";
  const statusClass = reviewed
    ? "bg-emerald-50 text-emerald-700"
    : confidence >= 68
      ? "bg-blue-50 text-blue-700"
      : "bg-amber-50 text-amber-800";

  return (
    <article
      onClick={onActivate}
      className={`rounded-xl bg-white p-4 transition-[box-shadow,border-color] ${active ? "border border-[#123d68] shadow-[0_10px_28px_rgba(18,61,104,.1)]" : "border border-slate-200"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <strong className="text-sm text-[#092b4c]">
            Câu {question.position}
            {question.sourceLabel && question.sourceLabel !== String(question.position)
              ? ` (gốc: ${question.sourceLabel})`
              : ""}
          </strong>
          {question.sourcePage && <span className="ml-2 text-xs text-slate-400">Trang {question.sourcePage}</span>}
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${statusClass}`}>
          {reviewed || confidence >= 68 ? <CheckCircle2 size={12} aria-hidden="true" /> : <AlertTriangle size={12} aria-hidden="true" />}
          {statusLabel}{showTechnical ? ` · ${confidence}%` : ""}
        </span>
      </div>

      {!editing ? (
        <>
          {question.section && <p className="mt-3 text-xs font-semibold text-slate-500">{question.section}</p>}
          <p className="mt-2 text-sm font-semibold leading-6 text-[#092b4c]">{question.content || `Câu ${question.position}`}</p>
          {options.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {options.map((option) => (
                <span key={option} className="rounded-lg bg-slate-50 px-3 py-2 text-sm leading-5 text-slate-700">
                  {option}
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-500">
              Đáp án: <strong className="text-[#092b4c]">{question.answer || "Chưa nhập"}</strong>
            </span>
            {(showTechnical ? flags : importantFlags).map((flag) => (
              <span key={flag} className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                {reviewFlagLabel(flag)}
              </span>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            {!reviewed ? (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSave(currentBody)}
                className="min-h-10 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-40"
              >
                Câu này đúng
              </button>
            ) : (
              <span className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-50 px-3 text-sm font-bold text-emerald-700">
                <CheckCircle2 size={16} aria-hidden="true" /> Đã xác nhận
              </span>
            )}
            <button type="button" disabled={disabled} onClick={() => setEditing(true)} className="btn-outline min-h-10 px-4">
              Sửa nội dung
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (window.confirm(`Xác nhận “Câu ${question.position}” không phải là câu hỏi?`)) onDelete();
              }}
              className="min-h-10 px-3 text-sm font-semibold text-red-700 disabled:opacity-40"
            >
              Đây không phải câu hỏi
            </button>
          </div>
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const values = Object.fromEntries(new FormData(event.currentTarget));
            onSave({
              position: question.position,
              answer: values.answer,
              kind: values.kind,
              points: Number(values.points),
              content: values.content,
              section: values.section,
              options: String(values.options || "").split("\n").map((option) => option.trim()).filter(Boolean),
            });
            setEditing(false);
          }}
          className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-3"
        >
          <label className="text-xs font-semibold md:col-span-2">
            Phần / hướng dẫn
            <input name="section" defaultValue={question.section || ""} className="field-control mt-1 p-2 text-sm" />
          </label>
          <label className="text-xs font-semibold">
            Loại câu
            <select name="kind" defaultValue={question.kind} className="field-control mt-1 p-2 text-sm">
              <option value="SINGLE_CHOICE">Trắc nghiệm</option>
              <option value="SHORT_TEXT">Điền ngắn</option>
              <option value="ESSAY">Tự luận</option>
            </select>
          </label>
          <label className="text-xs font-semibold md:col-span-3">
            Nội dung câu hỏi
            <textarea name="content" defaultValue={question.content || ""} required className="field-control mt-1 min-h-20 p-2 text-sm" />
          </label>
          <label className="text-xs font-semibold md:col-span-3">
            Các lựa chọn (mỗi dòng một lựa chọn)
            <textarea name="options" defaultValue={options.join("\n")} className="field-control mt-1 min-h-24 p-2 text-sm" />
          </label>
          <label className="text-xs font-semibold">
            Đáp án
            <input name="answer" defaultValue={question.answer || ""} placeholder="A / nội dung đáp án" className="field-control mt-1 p-2 text-sm" />
          </label>
          <label className="text-xs font-semibold">
            Điểm
            <input name="points" type="number" min="0.1" step="0.1" defaultValue={question.points} className="field-control mt-1 p-2 text-sm" />
          </label>
          <div className="flex items-end gap-2">
            <button disabled={disabled} className="btn-primary min-h-10 flex-1 px-3">Lưu thay đổi</button>
            <button type="button" onClick={() => setEditing(false)} className="btn-outline min-h-10 px-3">Hủy</button>
          </div>
        </form>
      )}
    </article>
  );
}
