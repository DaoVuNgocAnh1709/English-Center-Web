"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  FileCheck2,
  FileSearch,
  FileSpreadsheet,
  Globe,
  GraduationCap,
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
import { apiFetch } from "@/lib/api-client";
import { safeExternalUrl } from "@/lib/safe-url";
import {
  cleanQuestionPrompt,
  enrichPronunciationOptions,
  renderFormattedText,
  stripFormattedText,
} from "@/lib/formatted-text";

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
  taskType: string;
  recognitionProvider: "LOCAL" | "GEMINI" | "LOCAL_FALLBACK" | "MANUAL";
  recognitionModel: string | null;
  extractionBatch: number | null;
  points: number;
  sourceLabel: string | null;
  section: string | null;
  content: string | null;
  options: unknown;
  interactionData: unknown;
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
  showAnswers: boolean;
  startPage: number;
  endPage: number;
  extractedAt: string | null;
  extractionWarnings: unknown;
  extractionStatus: "QUEUED" | "PROCESSING" | "READY" | "FAILED";
  extractionProgress: number;
  extractionError: string | null;
  extractionProvider: "LOCAL" | "GEMINI" | "LOCAL_FALLBACK";
  aiModel: string | null;
  aiInputTokens: number | null;
  aiOutputTokens: number | null;
  aiFallbackReason: string | null;
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
  studentGrade?: string | null;
  phone: string;
  interestedCourse: string;
  note?: string | null;
  status: string;
};
type AdminLesson = {
  id: string;
  title: string;
  summary: string;
  sortOrder: number;
};
type AdminCourse = {
  id: string;
  slug: string;
  title: string;
  ageRange: string;
  level: string;
  duration: string;
  summary: string;
  status: "DRAFT" | "REVIEW" | "PUBLISHED";
  lessons: AdminLesson[];
  _count: { enrollments: number; materials: number };
};
type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: "STUDENT" | "TEACHER" | "ADMIN";
  gradeLevel: string | null;
  enrollments: {
    id: string;
    progress: number;
    course: { id: string; title: string };
  }[];
};
type AttemptQuestion = {
  position: number;
  content: string | null;
  options: unknown;
  interactionData: unknown;
  kind: string;
  taskType: string;
  answer: string | null;
  points: number;
  sourcePage: number | null;
  section: string | null;
};
type StaffAttempt = {
  id: string;
  userId?: string | null;
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
  createdAt?: string;
  updatedAt: string;
  user: { id?: string; fullName: string; email: string } | null;
  exam: { id: string; title: string; schoolLevel?: string; grade?: number; questions: AttemptQuestion[] };
};
type StaffStudentAttempt = {
  id: string;
  examId: string;
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
  createdAt: string;
  updatedAt: string;
  exam: {
    id: string;
    title: string;
    slug: string;
    schoolLevel: string;
    grade: number;
    questions: AttemptQuestion[];
  };
};
type StaffStudent = {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  enrollments: {
    id: string;
    progress: number;
    status: string;
    course: { id: string; title: string; slug: string; level: string | null; ageRange: string };
  }[];
  examAttempts: StaffStudentAttempt[];
};
const api = process.env.NEXT_PUBLIC_API_URL || "/api";
const statusLabels: Record<string, string> = {
  DRAFT: "Bản nháp",
  REVIEW: "Chờ duyệt",
  PUBLISHED: "Đã xuất bản",
  NEW: "Mới",
  CONTACTED: "Đã liên hệ",
  ENROLLED: "Đã nhập học",
  CLOSED: "Đã đóng",
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
    window.location.href = loginUrl;
}

async function request(path: string, init?: RequestInit) {
  const response = await apiFetch(`${api}${path}`, init);
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("bp_allow_public_view");
    }
  }, []);

  const goToPublicSite = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("bp_allow_public_view", "true");
    }
    router.push("/");
  };
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState("overview");
  const [sources, setSources] = useState<Source[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [adminCourses, setAdminCourses] = useState<AdminCourse[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [students, setStudents] = useState<StaffStudent[]>([]);
  const [attempts, setAttempts] = useState<StaffAttempt[]>([]);
  const [storage, setStorage] = useState<StorageStats | null>(null);
  const [recognitionLearning, setRecognitionLearning] = useState<RecognitionLearningStats | null>(null);
  const [sourceFileNames, setSourceFileNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [selectedExam, setSelectedExam] = useState<string | null>(null);
  const [selectedAttempt, setSelectedAttempt] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentFilterMode, setStudentFilterMode] = useState<"ALL" | "ACTIVE_ATTEMPTS" | "NEEDS_GRADING" | "ENROLLED">("ALL");
  const [attemptSearch, setAttemptSearch] = useState("");
  const [attemptExamFilter, setAttemptExamFilter] = useState("ALL");
  const [attemptStatusFilter, setAttemptStatusFilter] = useState<"ALL" | "SUBMITTED" | "GRADED" | "DRAFT">("ALL");
  const [analyticsExamId, setAnalyticsExamId] = useState<string>("ALL");
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const uploadLock = useRef(false);
  const selectedSource = sources.find((source) => source.id === selectedSourceId);

  const reload = useCallback(async () => {
    const [sourceList, examList, materialList, attemptList, studentList, storageInfo, learningInfo] = await Promise.all(
      [
        request("/staff/content/sources"),
        request("/staff/content/exams"),
        request("/staff/content/materials"),
        request("/staff/content/attempts"),
        request("/staff/content/students").catch(() => []),
        request("/staff/content/storage"),
        request("/staff/content/recognition-learning"),
      ],
    );
    setSources(sourceList);
    setExams(examList);
    setMaterials(materialList);
    setAttempts(attemptList);
    setStudents(Array.isArray(studentList) ? studentList : []);
    setStorage(storageInfo);
    setRecognitionLearning(learningInfo);
    if (role === "ADMIN") {
      const [applicationList, leadList, courseList, userList] = await Promise.all([
        request("/admin/content/applications"),
        request("/admin/leads"),
        request("/admin/courses"),
        request("/admin/users"),
      ]);
      setApplications(applicationList);
      setLeads(leadList);
      setAdminCourses(courseList);
      setAdminUsers(userList);
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

  const reloadProgress = useCallback(async () => {
    const [sourceList, examList] = await Promise.all([
      request("/staff/content/sources"),
      request("/staff/content/exams"),
    ]);
    setSources(sourceList);
    setExams(examList);
  }, []);

  useEffect(() => {
    if (
      !sources.some((source) => ["QUEUED", "SCANNING", "PROCESSING"].includes(source.status)) &&
      !exams.some((exam) => ["QUEUED", "PROCESSING"].includes(exam.extractionStatus))
    ) return;
    const timer = window.setTimeout(() => void reloadProgress(), 2500);
    return () => window.clearTimeout(timer);
  }, [sources, exams, reloadProgress]);

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
      showAnswers: data.get("showAnswers") === "on",
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
  async function createAdminCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    if (
      await action(
        () =>
          request("/admin/courses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values),
          }),
        "Đã tạo khóa học mới.",
      )
    )
      form.reset();
  }
  async function addCourseLesson(
    courseId: string,
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    if (
      await action(
        () =>
          request(`/admin/courses/${courseId}/lessons`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values),
          }),
        "Đã thêm bài học vào khóa học.",
      )
    )
      form.reset();
  }
  async function createAdminUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    if (
      await action(
        () =>
          request("/admin/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values),
          }),
        "Đã tạo tài khoản thành công.",
      )
    )
      form.reset();
  }
  async function enrollStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    if (
      await action(
        () =>
          request("/admin/enrollments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values),
          }),
        "Đã ghi danh/cập nhật tiến độ học viên.",
      )
    )
      form.reset();
  }
  const nav = [
    ["overview", "Tổng quan", LayoutDashboard],
    ["students", "Học viên & Tiến độ", Users],
    ["exams", "Luyện đề", ClipboardList],
    ["attempts", "Bài làm học viên", FileCheck2],
    ["materials", "Thư viện tài liệu", BookOpen],
    ...(role === "ADMIN"
      ? ([
          ["courses", "Khóa học & Học viên", GraduationCap],
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
  const submittedOrGradedAttempts = attempts.filter((item) => item.status !== "DRAFT");
  const pendingGradingAttempts = attempts.filter((item) => item.status === "SUBMITTED");
  const draftAttempts = attempts.filter((item) => item.status === "DRAFT");
  const scoredScale10List = submittedOrGradedAttempts
    .map((item) => {
      const totalPossible = item.possible + item.manualPossible;
      const totalEarned = item.earned + item.manualEarned;
      return totalPossible > 0 ? (totalEarned / totalPossible) * 10 : null;
    })
    .filter((val): val is number => val !== null);
  const avgScoreScale10 =
    scoredScale10List.length > 0
      ? (scoredScale10List.reduce((sum, val) => sum + val, 0) / scoredScale10List.length).toFixed(1)
      : "—";
  const activeStudentCount = students.filter((student) => student.examAttempts.length > 0).length;

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar relative shrink-0 px-5 py-6 lg:pb-24">
        <button
          type="button"
          onClick={goToPublicSite}
          className="flex items-center gap-3 text-left transition hover:opacity-90"
          aria-label="Về trang chủ Bright Path"
        >
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#d91f2a] text-sm font-black italic text-white">BP</span>
          <span><strong className="block text-sm tracking-[.04em] text-white">BRIGHT PATH</strong><small className="text-[11px] font-semibold tracking-[.08em] text-white/55">WORKSPACE</small></span>
        </button>
        <div className="mt-7 flex items-center gap-3 border-y border-white/10 py-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-xs font-extrabold text-[#082c50]">{userInitials}</span>
          <div className="min-w-0"><p className="truncate text-sm font-bold text-white">{user.fullName}</p><p className="mt-0.5 truncate text-[11px] text-white/55">{role === "ADMIN" ? "Quản trị trung tâm" : "Giáo viên"}</p></div>
        </div>
        <button
          type="button"
          onClick={goToPublicSite}
          className="mt-3.5 mb-2 flex w-full items-center justify-between gap-2 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-white/20 hover:border-white/25"
        >
          <span className="flex items-center gap-2">
            <Globe size={15} className="text-white/80" />
            <span>Xem website công khai</span>
          </span>
          <ExternalLink size={13} className="text-white/60" />
        </button>
        <nav
          className="mt-4 grid grid-cols-2 gap-2 lg:block"
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
            if (typeof window !== "undefined") {
              window.sessionStorage.removeItem("bp_allow_public_view");
            }
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
            <div><h1 className="workspace-title">{nav.find((item) => item[0] === tab)?.[1]}</h1><p className="workspace-subtitle">{tab === "overview" ? "Theo dõi nội dung, học viên và các việc cần xử lý trong một nơi." : tab === "students" ? "Tra cứu từng học viên, số đề đã luyện, phân tích điểm mạnh yếu và lịch sử làm bài." : tab === "exams" ? "Tạo đề từ PDF, rà soát câu hỏi và quản lý trạng thái xuất bản." : tab === "attempts" ? "Theo dõi tiến độ, kết quả tự động và các câu đang chờ chấm tay." : tab === "materials" ? "Tổ chức học liệu theo cấp học, danh mục và trạng thái duyệt." : "Xử lý thông tin mới và cập nhật trạng thái liên hệ."}</p></div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={goToPublicSite}
                className="btn-outline hidden sm:inline-flex min-h-9 items-center gap-1.5 px-3 text-xs font-bold"
              >
                <Globe size={14} />
                <span>Xem trang chủ</span>
              </button>
              <span className="status-dot rounded-full bg-white px-4 py-2 text-xs font-bold text-emerald-700 shadow-sm">Hệ thống hoạt động</span>
            </div>
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
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Summary
                  value={exams.length}
                  label="Đề luyện tập"
                  subtext={`${exams.filter((e) => e.status === "PUBLISHED").length} xuất bản · ${exams.filter((e) => e.status !== "PUBLISHED").length} nháp/chờ duyệt`}
                />
                <Summary
                  value={attempts.length}
                  label="Tổng lượt làm đề"
                  subtext={`${submittedOrGradedAttempts.length} đã nộp · ${draftAttempts.length} đang làm`}
                />
                <Summary
                  value={pendingGradingAttempts.length}
                  label="Bài chờ chấm tay"
                  subtext={pendingGradingAttempts.length > 0 ? "Cần giáo viên chấm điểm tự luận" : "Đã chấm hết bài nộp"}
                  highlight={pendingGradingAttempts.length > 0 ? "warning" : "normal"}
                />
                <Summary
                  value={avgScoreScale10}
                  label="Điểm TB (Thang 10)"
                  subtext={scoredScale10List.length > 0 ? `Tính trên ${scoredScale10List.length} bài đã nộp` : "Chưa có bài hoàn thành"}
                />
                <Summary
                  value={`${activeStudentCount}/${students.length}`}
                  label="Học viên luyện đề"
                  subtext={`${students.length} tài khoản học viên trong hệ thống`}
                />
                <Summary
                  value={
                    role === "ADMIN"
                      ? applications.filter((item) => item.status === "NEW").length
                      : sources.length
                  }
                  label={role === "ADMIN" ? "Hồ sơ mới" : "PDF nguồn"}
                  subtext={`${materials.length} tài liệu học tập`}
                />
              </div>

              <div className="workspace-panel grid gap-7 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
                <div>
                  <h2 className="text-xl font-bold text-[#092b4c]">Bắt đầu công việc</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                    Giáo viên tải PDF, chọn trang, nhập đáp án và gửi duyệt. Admin
                    kiểm tra lại PDF, đáp án rồi xuất bản. Tài liệu cũng cần duyệt
                    trước khi hiển thị công khai.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 md:justify-end">
                  <button
                    className="btn-primary"
                    onClick={() => setTab("exams")}
                  >
                    Tạo đề luyện tập
                  </button>
                  <button
                    className="btn-outline"
                    onClick={() => setTab("students")}
                  >
                    Xem tiến độ học viên
                  </button>
                  <button
                    className="btn-outline"
                    onClick={() => setTab("materials")}
                  >
                    Đăng tài liệu
                  </button>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <section className="soft-card p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-[#092b4c]">
                        Bài nộp cần chấm điểm ngay
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Các bài có câu tự luận hoặc viết lại câu đang chờ giáo viên chấm tay.
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${pendingGradingAttempts.length > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>
                      {pendingGradingAttempts.length} bài chờ
                    </span>
                  </div>
                  <div className="mt-4 space-y-2.5">
                    {pendingGradingAttempts.slice(0, 5).map((item) => (
                      <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-amber-50/40 p-3.5 text-sm">
                        <div className="min-w-0">
                          <strong className="block truncate text-[#092b4c]">
                            {item.user?.fullName || item.participantName || "Khách"}
                          </strong>
                          <span className="block truncate text-xs text-slate-600">
                            {item.exam.title} · Còn {item.pending} câu chờ chấm
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedAttempt(item.id)}
                          className="btn-primary min-h-9 shrink-0 px-3 text-xs"
                        >
                          Chấm ngay
                        </button>
                      </div>
                    ))}
                    {pendingGradingAttempts.length === 0 && (
                      <div className="rounded-xl bg-emerald-50/70 p-4 text-sm text-emerald-800">
                        Tất cả các bài đã nộp đều được chấm điểm đầy đủ.
                      </div>
                    )}
                  </div>
                </section>

                <section className="soft-card p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-[#092b4c]">
                        Hoạt động học viên gần đây
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Các lượt làm đề mới nhất của học viên và khách trên hệ thống.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTab("attempts")}
                      className="text-xs font-bold text-[#123d68] underline underline-offset-4"
                    >
                      Xem tất cả ({attempts.length})
                    </button>
                  </div>
                  <div className="mt-4 space-y-2.5">
                    {attempts.slice(0, 5).map((item) => {
                      const totalEarned = item.earned + item.manualEarned;
                      const totalPossible = item.possible + item.manualPossible;
                      const scale10 = totalPossible > 0 ? ((totalEarned / totalPossible) * 10).toFixed(1) : null;
                      const matchedStudent = students.find(
                        (s) => (item.user?.email && s.email === item.user.email) || (item.userId && s.id === item.userId),
                      );
                      return (
                        <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3.5 text-sm">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {matchedStudent ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedStudentId(matchedStudent.id)}
                                  className="font-bold text-[#092b4c] hover:text-[#d91f2a] hover:underline"
                                >
                                  {item.user?.fullName || matchedStudent.fullName}
                                </button>
                              ) : (
                                <strong className="text-[#092b4c]">
                                  {item.user?.fullName || item.participantName || "Khách"}
                                </strong>
                              )}
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${item.status === "GRADED" ? "bg-emerald-50 text-emerald-700" : item.status === "SUBMITTED" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                                {item.status === "DRAFT" ? "Đang làm" : statusLabels[item.status]}
                              </span>
                            </div>
                            <span className="mt-0.5 block truncate text-xs text-slate-500">
                              {item.exam.title} · {formatDate(item.updatedAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            {item.status !== "DRAFT" && scale10 && (
                              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-[#092b4c]">
                                {scale10}/10
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedAttempt(item.id)}
                              className="btn-outline min-h-8 px-2.5 text-xs"
                            >
                              Chi tiết
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {attempts.length === 0 && (
                      <p className="text-sm text-slate-500">Chưa có lượt làm đề nào được ghi nhận.</p>
                    )}
                  </div>
                </section>
              </div>

              <section className="soft-card p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-[#092b4c]">
                      Thống kê hiệu suất theo Đề thi
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Theo dõi số lượng học sinh tham gia, điểm trung bình (quy đổi thang 10) và tỷ lệ hoàn thành của từng đề.
                    </p>
                  </div>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                        <th className="py-3 pr-4 font-bold">Tên đề thi</th>
                        <th className="px-3 py-3 font-bold">Trạng thái</th>
                        <th className="px-3 py-3 font-bold text-center">Số câu</th>
                        <th className="px-3 py-3 font-bold text-center">Lượt làm bài</th>
                        <th className="px-3 py-3 font-bold text-center">Điểm TB (Thang 10)</th>
                        <th className="px-3 py-3 font-bold text-center">Cao / Thấp nhất</th>
                        <th className="py-3 pl-3 font-bold text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {exams.map((exam) => {
                        const examAttempts = attempts.filter((a) => a.exam.id === exam.id);
                        const finished = examAttempts.filter((a) => a.status !== "DRAFT");
                        const pendingCount = examAttempts.filter((a) => a.status === "SUBMITTED").length;
                        const scores10 = finished
                          .map((a) => {
                            const p = a.possible + a.manualPossible;
                            const e = a.earned + a.manualEarned;
                            return p > 0 ? (e / p) * 10 : null;
                          })
                          .filter((v): v is number => v !== null);
                        const avg10 = scores10.length > 0 ? (scores10.reduce((s, v) => s + v, 0) / scores10.length).toFixed(1) : "—";
                        const max10 = scores10.length > 0 ? Math.max(...scores10).toFixed(1) : "—";
                        const min10 = scores10.length > 0 ? Math.min(...scores10).toFixed(1) : "—";

                        return (
                          <tr key={exam.id} className="hover:bg-slate-50/80">
                            <td className="py-3.5 pr-4">
                              <strong className="block text-[#092b4c]">{exam.title}</strong>
                              <span className="text-xs text-slate-500">{gradeLabel(exam.grade)}</span>
                            </td>
                            <td className="px-3 py-3.5">
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${exam.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-700" : exam.status === "REVIEW" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                                {statusLabels[exam.status] || exam.status}
                              </span>
                            </td>
                            <td className="px-3 py-3.5 text-center font-semibold tabular-nums text-slate-700">
                              {exam.questions.length}
                            </td>
                            <td className="px-3 py-3.5 text-center">
                              <strong className="tabular-nums text-[#092b4c]">{examAttempts.length}</strong>
                              <span className="block text-[11px] text-slate-500">
                                {finished.length} nộp · {examAttempts.length - finished.length} nháp
                                {pendingCount > 0 ? ` · ${pendingCount} chờ chấm` : ""}
                              </span>
                            </td>
                            <td className="px-3 py-3.5 text-center">
                              <span className={`inline-block rounded-lg px-2.5 py-1 text-xs font-extrabold tabular-nums ${scores10.length > 0 ? "bg-blue-50 text-[#123d68]" : "text-slate-400"}`}>
                                {avg10}{scores10.length > 0 ? " / 10" : ""}
                              </span>
                            </td>
                            <td className="px-3 py-3.5 text-center text-xs font-semibold tabular-nums text-slate-600">
                              {scores10.length > 0 ? `${max10} / ${min10}` : "—"}
                            </td>
                            <td className="py-3.5 pl-3 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAttemptExamFilter(exam.id);
                                    setAnalyticsExamId(exam.id);
                                    setTab("attempts");
                                  }}
                                  className="btn-outline min-h-8 px-2.5 text-xs"
                                >
                                  Xem bài làm ({examAttempts.length})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedExam(exam.id)}
                                  className="btn-outline min-h-8 px-2.5 text-xs"
                                >
                                  Câu hỏi
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {exams.length === 0 && (
                    <p className="py-4 text-center text-sm text-slate-500">Chưa có đề luyện tập nào.</p>
                  )}
                </div>
              </section>

              {role === "ADMIN" && recognitionLearning && (
                <section className="workspace-panel p-6 md:p-8" aria-labelledby="recognition-learning-title">
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
          {tab === "students" && (
            <StudentsAnalyticsView
              students={students}
              attempts={attempts}
              search={studentSearch}
              onSearchChange={setStudentSearch}
              filterMode={studentFilterMode}
              onFilterModeChange={setStudentFilterMode}
              onSelectStudent={(id) => setSelectedStudentId(id)}
              onSelectAttempt={(id) => setSelectedAttempt(id)}
            />
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
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/80 to-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#123d68] text-white">
                      <FileSpreadsheet className="size-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#092b4c]">Mẫu Excel nhập đề thi chuẩn hóa</p>
                      <p className="text-xs text-slate-500">Gồm sheet hướng dẫn chi tiết, 5 câu mẫu (ngữ âm, từ vựng, ngữ pháp, viết lại câu, hình ảnh) và khớp đáp án 100%.</p>
                    </div>
                  </div>
                  <a
                    href={`${api}/staff/content/exam-template`}
                    download="mau-nhap-de-thi.xlsx"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-[#123d68] shadow-sm border border-blue-200 transition hover:bg-blue-50 shrink-0"
                  >
                    <Download className="size-4" />
                    Tải file mẫu Excel (.xlsx)
                  </a>
                </div>
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
                  <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm md:col-span-2">
                    <input
                      type="checkbox"
                      name="showAnswers"
                      defaultChecked
                      className="mt-1 size-4 accent-[#0b3157]"
                    />
                    <span>
                      <strong className="block text-[#092b4c]">
                        Công bố đáp án chi tiết ngay sau khi học viên nộp bài
                      </strong>
                      <span className="mt-1 block leading-6 text-slate-600">
                        Bỏ chọn nếu đây là kỳ thi/bài kiểm tra cần bảo mật đáp án. Bạn có thể bật công bố đáp án bất cứ lúc nào sau khi ca thi kết thúc.
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
                          {exam.extractionStatus === "READY" && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                  exam.extractionProvider === "GEMINI"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : exam.extractionProvider === "LOCAL_FALLBACK"
                                      ? "bg-amber-50 text-amber-800"
                                      : "bg-slate-100 text-slate-600"
                                }`}
                                title={
                                  exam.extractionProvider === "GEMINI"
                                    ? `${exam.aiModel || "Gemini"} · ${exam.aiInputTokens || 0} token vào · ${exam.aiOutputTokens || 0} token ra`
                                    : exam.aiFallbackReason || undefined
                                }
                              >
                                {exam.extractionProvider === "GEMINI"
                                  ? "Gemini hỗ trợ"
                                  : exam.extractionProvider === "LOCAL_FALLBACK"
                                    ? "Dự phòng nội bộ"
                                    : "Nhận diện nội bộ"}
                              </span>
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                  exam.showAnswers !== false
                                    ? "bg-blue-50 text-blue-700"
                                    : "bg-amber-50 text-amber-800"
                                }`}
                              >
                                {exam.showAnswers !== false
                                  ? "Hiện đáp án sau nộp"
                                  : "Đang ẩn đáp án"}
                              </span>
                            </div>
                          )}
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
                          <button
                            disabled={busy}
                            onClick={() =>
                              patch(
                                `/staff/content/exams/${exam.id}/answer-visibility`,
                                { showAnswers: exam.showAnswers === false },
                                exam.showAnswers === false
                                  ? "Đã công bố đáp án chi tiết cho học viên."
                                  : "Đã ẩn đáp án chi tiết đối với học viên.",
                              )
                            }
                            className="btn-outline min-h-9 px-3"
                          >
                            {exam.showAnswers === false ? "Công bố đáp án" : "Ẩn đáp án"}
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
                          {exam.status !== "PUBLISHED" && (role === "ADMIN" || exam.status === "DRAFT") && (
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
                          {exam.status === "REVIEW" && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                patch(
                                  `/staff/content/exams/${exam.id}/status`,
                                  { status: "DRAFT" },
                                  role === "ADMIN"
                                    ? "Đã trả đề về bản nháp cho giáo viên chỉnh sửa."
                                    : "Đã rút đề về bản nháp.",
                                )
                              }
                              className="btn-outline min-h-9 px-3"
                            >
                              {role === "ADMIN" ? "Trả về bản nháp" : "Rút về bản nháp"}
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

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="text-xs font-semibold text-slate-600">
                    Tìm theo tên / email học viên
                    <input
                      value={attemptSearch}
                      onChange={(event) => setAttemptSearch(event.target.value)}
                      placeholder="Nhập tên học viên hoặc email..."
                      className="field-control mt-1.5 p-2.5 text-sm"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Lọc theo đề thi
                    <select
                      value={attemptExamFilter}
                      onChange={(event) => {
                        setAttemptExamFilter(event.target.value);
                        setAnalyticsExamId(event.target.value);
                      }}
                      className="field-control mt-1.5 p-2.5 text-sm"
                    >
                      <option value="ALL">Tất cả đề thi ({exams.length})</option>
                      {exams.map((exam) => (
                        <option key={exam.id} value={exam.id}>
                          {exam.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="text-xs font-semibold text-slate-600 sm:col-span-2 lg:col-span-1">
                    <span>Trạng thái bài làm</span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {(
                        [
                          ["ALL", `Tất cả (${attempts.length})`],
                          ["SUBMITTED", `Chờ chấm (${attempts.filter((a) => a.status === "SUBMITTED").length})`],
                          ["GRADED", `Đã chấm (${attempts.filter((a) => a.status === "GRADED").length})`],
                          ["DRAFT", `Đang làm (${attempts.filter((a) => a.status === "DRAFT").length})`],
                        ] as const
                      ).map(([statusKey, label]) => (
                        <button
                          key={statusKey}
                          type="button"
                          onClick={() => setAttemptStatusFilter(statusKey)}
                          className={`rounded-lg px-2.5 py-2 text-xs font-bold transition-colors ${attemptStatusFilter === statusKey ? "bg-[#123d68] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <QuestionErrorAnalyticsPanel
                attempts={attempts}
                exams={exams}
                selectedExamId={analyticsExamId}
                onSelectExamId={(val) => {
                  setAnalyticsExamId(val);
                  setAttemptExamFilter(val);
                }}
              />

              {(() => {
                const q = attemptSearch.trim().toLocaleLowerCase("vi");
                const filteredAttempts = attempts.filter((item) => {
                  if (attemptExamFilter !== "ALL" && item.exam.id !== attemptExamFilter) return false;
                  if (attemptStatusFilter !== "ALL" && item.status !== attemptStatusFilter) return false;
                  if (q) {
                    const name = (item.user?.fullName || item.participantName || "Khách").toLocaleLowerCase("vi");
                    const email = (item.user?.email || "").toLocaleLowerCase("vi");
                    const examTitle = item.exam.title.toLocaleLowerCase("vi");
                    if (!name.includes(q) && !email.includes(q) && !examTitle.includes(q)) return false;
                  }
                  return true;
                });

                return (
                  <>
                    {filteredAttempts.map((attemptItem) => {
                      const totalEarned = attemptItem.earned + attemptItem.manualEarned;
                      const totalPossible = attemptItem.possible + attemptItem.manualPossible;
                      const scale10 = totalPossible > 0 ? ((totalEarned / totalPossible) * 10).toFixed(1) : null;
                      const matchedStudent = students.find(
                        (s) =>
                          (attemptItem.user?.email && s.email === attemptItem.user.email) ||
                          (attemptItem.userId && s.id === attemptItem.userId),
                      );
                      return (
                        <article key={attemptItem.id} className="soft-card p-5">
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-extrabold text-[#092b4c]">
                                  {attemptItem.user?.fullName ||
                                    attemptItem.participantName ||
                                    "Khách"}
                                </h3>
                                {attemptItem.user?.email && (
                                  <span className="text-xs text-slate-400">({attemptItem.user.email})</span>
                                )}
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
                            <div className="flex flex-wrap items-center gap-3">
                              {attemptItem.status !== "DRAFT" && (
                                <div className="text-right">
                                  <strong className="block text-sm text-[#092b4c]">
                                    {totalEarned}/{totalPossible} điểm
                                  </strong>
                                  {scale10 && (
                                    <span className="block text-xs font-bold text-[#123d68]">
                                      Thang 10: {scale10}/10
                                    </span>
                                  )}
                                </div>
                              )}
                              {matchedStudent && (
                                <button
                                  type="button"
                                  className="btn-outline min-h-10 px-3 text-xs"
                                  onClick={() => setSelectedStudentId(matchedStudent.id)}
                                >
                                  Hồ sơ học viên
                                </button>
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
                      );
                    })}
                    {!filteredAttempts.length && attempts.length > 0 && (
                      <div className="soft-card p-8 text-center text-sm text-slate-500">
                        Không tìm thấy bài làm nào khớp với bộ lọc hiện tại.
                      </div>
                    )}
                  </>
                );
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
                        {item.status !== "PUBLISHED" && (role === "ADMIN" || item.status === "DRAFT") && (
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
                        {item.status === "REVIEW" && (
                          <button
                            disabled={busy}
                            className="btn-outline min-h-9 px-3"
                            onClick={() =>
                              patch(
                                `/staff/content/materials/${item.id}/status`,
                                { status: "DRAFT" },
                                role === "ADMIN"
                                  ? "Đã trả tài liệu về bản nháp."
                                  : "Đã rút tài liệu về bản nháp.",
                              )
                            }
                          >
                            {role === "ADMIN" ? "Trả về bản nháp" : "Rút về bản nháp"}
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
                            : safeExternalUrl(item.driveUrl) || "#"
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
          {tab === "courses" && role === "ADMIN" && (
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="soft-card p-6">
                  <h2 className="text-lg font-bold text-[#092b4c]">
                    Tạo khóa học mới
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Khóa học xuất bản sẽ hiển thị trên trang Khóa học công khai và mở ghi danh cho học viên.
                  </p>
                  <form
                    onSubmit={createAdminCourse}
                    className="mt-5 grid gap-4 sm:grid-cols-2"
                  >
                    <Field name="title" label="Tên khóa học" required />
                    <Field
                      name="ageRange"
                      label="Độ tuổi / Nhóm lớp"
                      defaultValue="11–15 tuổi"
                      required
                    />
                    <Field
                      name="level"
                      label="Khối / Cấp độ"
                      defaultValue="Lớp 6 - 9"
                      required
                    />
                    <Field
                      name="duration"
                      label="Thời lượng"
                      defaultValue="24 buổi"
                      required
                    />
                    <label className="text-sm font-semibold sm:col-span-2">
                      Tóm tắt chương trình
                      <textarea
                        name="summary"
                        required
                        className="field-control mt-2 min-h-20 p-3"
                      />
                    </label>
                    <button
                      disabled={busy}
                      className="btn-primary w-fit sm:col-span-2"
                    >
                      Lưu khóa học
                    </button>
                  </form>
                </div>

                <div className="soft-card p-6">
                  <h2 className="text-lg font-bold text-[#092b4c]">
                    Tạo tài khoản & Ghi danh học viên
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Cấp tài khoản mới cho học viên/giáo viên hoặc ghi danh học viên vào khóa học đang mở.
                  </p>
                  <form
                    onSubmit={createAdminUser}
                    className="mt-5 grid gap-4 sm:grid-cols-2"
                  >
                    <Field name="fullName" label="Họ và tên" required />
                    <Field name="email" label="Email đăng nhập" type="email" required />
                    <Field
                      name="password"
                      label="Mật khẩu khởi tạo"
                      type="password"
                      required
                    />
                    <label className="text-sm font-semibold">
                      Vai trò
                      <select
                        name="role"
                        defaultValue="STUDENT"
                        className="field-control mt-2 px-3"
                      >
                        <option value="STUDENT">Học viên</option>
                        <option value="TEACHER">Giáo viên</option>
                        <option value="ADMIN">Quản trị viên</option>
                      </select>
                    </label>
                    <Field name="phone" label="Số điện thoại" />
                    <Field name="gradeLevel" label="Khối lớp (Ví dụ: Lớp 8)" />
                    <button
                      disabled={busy}
                      className="btn-outline w-fit sm:col-span-2"
                    >
                      Tạo tài khoản
                    </button>
                  </form>

                  <form
                    onSubmit={enrollStudent}
                    className="mt-6 grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-3"
                  >
                    <label className="text-sm font-semibold">
                      Học viên
                      <select
                        name="userId"
                        required
                        className="field-control mt-2 px-3"
                      >
                        <option value="">Chọn học viên</option>
                        {adminUsers
                          .filter((item) => item.role === "STUDENT")
                          .map((student) => (
                            <option key={student.id} value={student.id}>
                              {student.fullName} ({student.email})
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="text-sm font-semibold">
                      Khóa học
                      <select
                        name="courseId"
                        required
                        className="field-control mt-2 px-3"
                      >
                        <option value="">Chọn khóa học</option>
                        {adminCourses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Field
                      name="progress"
                      label="Tiến độ (%)"
                      type="number"
                      defaultValue="0"
                      min="0"
                      max="100"
                    />
                    <button
                      disabled={busy}
                      className="btn-primary w-fit sm:col-span-3"
                    >
                      Ghi danh / Cập nhật tiến độ
                    </button>
                  </form>
                </div>
              </div>

              <div className="soft-card p-6">
                <h2 className="text-lg font-bold text-[#092b4c]">
                  Danh sách khóa học ({adminCourses.length})
                </h2>
                <div className="mt-4 divide-y divide-slate-200">
                  {adminCourses.map((course) => (
                    <div key={course.id} className="py-5 first:pt-1 last:pb-1">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <strong className="text-base text-[#092b4c]">
                            {course.title}
                          </strong>
                          <p className="mt-1 text-xs text-slate-500">
                            {[course.ageRange, course.level, course.duration].filter(Boolean).join(" · ")} ·{" "}
                            <span className="tabular-nums">
                              {course._count.enrollments} học viên
                            </span>{" "}
                            ·{" "}
                            <span className="tabular-nums">
                              {course.lessons.length} bài học
                            </span>{" "}
                            · {statusLabels[course.status] || course.status}
                          </p>
                          <p className="mt-2 max-w-2xl text-sm text-slate-600">
                            {course.summary}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            disabled={busy}
                            className="btn-outline min-h-9 px-3 text-xs"
                            onClick={() =>
                              patch(
                                `/admin/courses/${course.id}/status`,
                                {
                                  status:
                                    course.status === "PUBLISHED"
                                      ? "DRAFT"
                                      : "PUBLISHED",
                                },
                                course.status === "PUBLISHED"
                                  ? "Đã chuyển khóa học về bản nháp."
                                  : "Đã xuất bản khóa học.",
                              )
                            }
                          >
                            {course.status === "PUBLISHED" ? "Gỡ xuất bản" : "Xuất bản"}
                          </button>
                        </div>
                      </div>
                      <form
                        onSubmit={(event) => addCourseLesson(course.id, event)}
                        className="mt-4 grid gap-3 sm:grid-cols-2 sm:items-end"
                      >
                        <Field name="title" label="Tên bài học mới" required />
                        <Field name="summary" label="Nội dung trọng tâm" required />
                        <Field
                          name="driveUrl"
                          label="Link tài liệu (tùy chọn)"
                          type="url"
                          placeholder="https://drive.google.com/..."
                        />
                        <Field
                          name="youtubeUrl"
                          label="Link video (tùy chọn)"
                          type="url"
                          placeholder="https://youtube.com/..."
                        />
                        <button
                          disabled={busy}
                          className="btn-outline min-h-11 w-fit px-4 text-xs sm:col-span-2"
                        >
                          + Thêm bài học
                        </button>
                      </form>
                    </div>
                  ))}
                  {!adminCourses.length && (
                    <p className="text-sm text-slate-500">Chưa có khóa học nào.</p>
                  )}
                </div>
              </div>

              <div className="soft-card p-6">
                <h2 className="text-lg font-bold text-[#092b4c]">
                  Tài khoản hệ thống ({adminUsers.length})
                </h2>
                <div className="mt-4 divide-y divide-slate-200">
                  {adminUsers.map((account) => (
                    <div
                      key={account.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3.5 text-sm first:pt-1 last:pb-1"
                    >
                      <div>
                        <strong className="text-[#092b4c]">{account.fullName}</strong>{" "}
                        <span className="text-slate-500">· {account.email}</span>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {account.role === "ADMIN"
                            ? "Quản trị viên"
                            : account.role === "TEACHER"
                              ? "Giáo viên"
                              : "Học viên"}
                          {account.gradeLevel ? ` · ${account.gradeLevel}` : ""}
                          {account.phone ? ` · ${account.phone}` : ""}
                        </p>
                      </div>
                      {account.enrollments.length > 0 && (
                        <p className="text-xs font-semibold text-[#123d68] tabular-nums">
                          {account.enrollments
                            .map((en) => `${en.course.title} (${en.progress ?? 0}%)`)
                            .join(", ")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
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
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 text-sm"
                  >
                    <div>
                      <strong className="text-[#092b4c]">{item.parentName}</strong> ·{" "}
                      <span className="tabular-nums">{item.phone}</span>
                      <p className="mt-1 text-slate-500">
                        Học viên: {item.studentName}
                        {item.studentGrade ? ` (${item.studentGrade})` : ""} ·{" "}
                        {item.interestedCourse}
                      </p>
                      {item.note && (
                        <p className="mt-1.5 text-xs text-slate-600">{item.note}</p>
                      )}
                    </div>
                    <label className="text-xs font-semibold">
                      Trạng thái
                      <select
                        value={item.status}
                        onChange={(event) =>
                          patch(
                            `/admin/leads/${item.id}/${event.target.value}`,
                            {},
                            "Đã cập nhật trạng thái tư vấn.",
                          )
                        }
                        className="field-control mt-2 p-2"
                      >
                        {["NEW", "CONTACTED", "ENROLLED", "CLOSED"].map((status) => (
                          <option key={status} value={status}>
                            {statusLabels[status] || status}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ))}
                {!leads.length && (
                  <p className="text-sm text-slate-500">Chưa có đăng ký.</p>
                )}
              </div>
            </div>
          )}
          {selectedStudentId &&
            (() => {
              const studentItem = students.find((s) => s.id === selectedStudentId);
              return studentItem ? (
                <Modal
                  open
                  size="xl"
                  title={`Hồ sơ học tập · ${studentItem.fullName}`}
                  description={`${studentItem.email} · ${studentItem.examAttempts.length} lượt luyện đề`}
                  onClose={() => setSelectedStudentId(null)}
                >
                  <StudentAnalyticsModal
                    student={studentItem}
                    onSelectAttempt={(attemptId) => {
                      setSelectedStudentId(null);
                      setSelectedAttempt(attemptId);
                    }}
                  />
                </Modal>
              ) : null;
            })()}
          {selectedAttempt &&
            (() => {
              const directAttempt = attempts.find((item) => item.id === selectedAttempt);
              const fallbackStudentAttempt = !directAttempt
                ? students
                    .flatMap((s) =>
                      s.examAttempts.map((a) => ({
                        ...a,
                        participantName: s.fullName,
                        user: { id: s.id, fullName: s.fullName, email: s.email },
                      })),
                    )
                    .find((item) => item.id === selectedAttempt)
                : null;
              const attemptItem: StaffAttempt | undefined = directAttempt || fallbackStudentAttempt || undefined;
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

function normalizeShortTextPhrase(value: string) {
  return value
    .normalize("NFC")
    .replace(/<\/?(?:u|b|strong|i|em)>/gi, "")
    .replace(/__(?![_\s])([^_\n]+?)(?<![_\s])__/g, "$1")
    .replace(/\*\*([^*]+?)\*\*/g, "$1")
    .replace(/[’‘`]/g, "'")
    .toLocaleLowerCase("vi")
    .replace(/\bcannot\b/g, "can not")
    .replace(/\bwon't\b/g, "will not")
    .replace(/\bshan't\b/g, "shall not")
    .replace(/\bcan't\b/g, "can not")
    .replace(/n't\b/g, " not")
    .replace(/\bi'm\b/g, "i am")
    .replace(/\b(you|we|they)'re\b/g, "$1 are")
    .replace(/\b(i|you|we|they)'ve\b/g, "$1 have")
    .replace(/\b(i|you|he|she|it|we|they)'ll\b/g, "$1 will")
    .replace(/\blet's\b/g, "let us")
    .replace(/\s+/g, " ")
    .replace(/\s*([,?:;])\s*/g, "$1 ")
    .replace(/[.!;]+$/g, "")
    .trim();
}

function comparableAnswer(value: string, kind: string, taskType = "GENERAL") {
  const normalized = value.trim();
  if (taskType === "MATCHING" || taskType === "ORDERING") {
    try {
      const parsed = JSON.parse(normalized);
      if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim().toLocaleLowerCase("vi")).join("|");
      if (parsed && typeof parsed === "object")
        return Object.entries(parsed as Record<string, unknown>)
          .sort(([left], [right]) => Number(left) - Number(right))
          .map(([, item]) => String(item).trim().toLocaleLowerCase("vi"))
          .join("|");
    } catch {}
  }
  if (kind === "SINGLE_CHOICE" || kind === "TRUE_FALSE") {
    const letter = normalized.match(/^([A-H])(?:[.)]|\s|$)/i)?.[1];
    if (letter) return letter.toUpperCase();
  }
  if (kind === "MULTIPLE_CHOICE") {
    try {
      const parsed = JSON.parse(normalized);
      if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim().toUpperCase()).sort().join("|");
    } catch {}
    return normalized.split(/[,;|]+/).map((item) => item.trim().toUpperCase()).filter(Boolean).sort().join("|");
  }
  if (kind === "TRUE_FALSE") {
    if (/^(true|t|đúng|dung|yes)$/i.test(normalized)) return "TRUE";
    if (/^(false|f|sai|no)$/i.test(normalized)) return "FALSE";
  }
  if (kind === "SHORT_TEXT") {
    return normalizeShortTextPhrase(normalized);
  }
  return normalized.toLocaleLowerCase("vi");
}

function isAttemptAnswerCorrect(
  response: string,
  expectedAnswer: string,
  kind: string,
  taskType = "GENERAL",
) {
  const normalizedResponse = comparableAnswer(response, kind, taskType);
  if (!normalizedResponse) return false;
  if (normalizedResponse === comparableAnswer(expectedAnswer, kind, taskType))
    return true;
  if (
    kind === "SHORT_TEXT" &&
    taskType !== "MATCHING" &&
    taskType !== "ORDERING" &&
    /[\/|]/.test(expectedAnswer)
  ) {
    return expectedAnswer
      .split(/\s*[\/|]\s*/)
      .map((variant) => normalizeShortTextPhrase(variant))
      .filter(Boolean)
      .includes(normalizedResponse);
  }
  return false;
}

function formatAttemptResponse(question: AttemptQuestion, response: string) {
  if (question.taskType === "MATCHING") {
    try {
      const parsed = JSON.parse(response) as Record<string, unknown>;
      const left = questionInteractionData(question.interactionData).matchingLeft;
      return left.map((item, index) => `${item} → ${String(parsed[String(index)] || "—")}`).join("; ");
    } catch {}
  }
  if (question.taskType === "ORDERING") {
    try {
      const parsed = JSON.parse(response);
      if (Array.isArray(parsed)) return parsed.map(String).join(" → ");
    } catch {}
  }
  return response;
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
        {attempt.exam.questions.map((question, index) => {
          const showSection =
            !!question.section &&
            question.section !== attempt.exam.questions[index - 1]?.section;
          const response = String(answers[String(question.position)] || "");
          const options = enrichPronunciationOptions(
            questionOptions(question.options),
            question.taskType,
          );
          const selectedOption = options.find(
            (option) =>
              option.match(/^([A-H])[.)]/i)?.[1]?.toUpperCase() ===
              response.trim().toUpperCase(),
          );
          const automatic = question.kind !== "ESSAY" && !!question.answer;
          const correct =
            automatic &&
            isAttemptAnswerCorrect(
              response,
              question.answer || "",
              question.kind,
              question.taskType,
            );
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
                  {showSection && question.section && (
                    <p className="mt-2 whitespace-pre-wrap rounded-lg bg-[#f2f6fa] p-3 text-xs font-medium leading-6 text-slate-700">
                      {renderFormattedText(question.section)}
                    </p>
                  )}
                  <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-[#172b3e]">
                    {renderFormattedText(
                      cleanQuestionPrompt(
                        question.content,
                        question.section,
                        question.taskType,
                        question.position,
                      ),
                    )}
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
                            {renderFormattedText(option)}
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
                    {stripFormattedText(selectedOption) || formatAttemptResponse(question, response) || "Chưa trả lời"}
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
      {attempt.status !== "DRAFT" && (
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
          {pendingQuestions.length > 0 && (
            <>
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
            </>
          )}
          <label className="mt-4 block text-xs font-semibold">
            Nhận xét cho học viên
            <textarea
              name="feedback"
              defaultValue={attempt.teacherFeedback || ""}
              maxLength={1000}
              className="field-control mt-1 min-h-20 p-3 text-sm"
              placeholder="Điểm mạnh, nội dung cần ôn lại..."
            />
          </label>
          <button disabled={busy} className="btn-primary mt-4">
            {pendingQuestions.length > 0 ? "Lưu điểm và nhận xét" : "Lưu nhận xét"}
          </button>
        </form>
      )}
    </div>
  );
}

function Summary({
  value,
  label,
  subtext,
  highlight = "normal",
}: {
  value: number | string;
  label: string;
  subtext?: string;
  highlight?: "normal" | "warning";
}) {
  return (
    <div
      className={`metric-cell ${
        highlight === "warning" ? "border-amber-300 bg-amber-50/40" : ""
      }`}
    >
      <strong className={highlight === "warning" ? "text-amber-700" : ""}>
        {value}
      </strong>
      <p className="mt-2 text-sm font-bold text-[#092b4c]">{label}</p>
      {subtext && (
        <p className="mt-1 text-xs leading-5 text-slate-500">{subtext}</p>
      )}
    </div>
  );
}

function StudentsAnalyticsView({
  students,
  attempts,
  search,
  onSearchChange,
  filterMode,
  onFilterModeChange,
  onSelectStudent,
  onSelectAttempt,
}: {
  students: StaffStudent[];
  attempts: StaffAttempt[];
  search: string;
  onSearchChange: (val: string) => void;
  filterMode: "ALL" | "ACTIVE_ATTEMPTS" | "NEEDS_GRADING" | "ENROLLED";
  onFilterModeChange: (val: "ALL" | "ACTIVE_ATTEMPTS" | "NEEDS_GRADING" | "ENROLLED") => void;
  onSelectStudent: (id: string) => void;
  onSelectAttempt: (id: string) => void;
}) {
  const studentsWithAttempts = students.filter((s) => s.examAttempts.length > 0);
  const studentsNeedingGrade = students.filter((s) =>
    s.examAttempts.some((a) => a.status === "SUBMITTED"),
  );
  const studentsEnrolled = students.filter((s) => s.enrollments.length > 0);
  const guestAttempts = attempts.filter((a) => !a.user && !a.userId);

  const query = search.trim().toLocaleLowerCase("vi");
  const filteredStudents = students.filter((s) => {
    if (filterMode === "ACTIVE_ATTEMPTS" && s.examAttempts.length === 0) return false;
    if (filterMode === "NEEDS_GRADING" && !s.examAttempts.some((a) => a.status === "SUBMITTED"))
      return false;
    if (filterMode === "ENROLLED" && s.enrollments.length === 0) return false;
    if (query) {
      const matchName = s.fullName.toLocaleLowerCase("vi").includes(query);
      const matchEmail = s.email.toLocaleLowerCase("vi").includes(query);
      const matchCourse = s.enrollments.some((e) =>
        e.course.title.toLocaleLowerCase("vi").includes(query),
      );
      if (!matchName && !matchEmail && !matchCourse) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Summary
          value={students.length}
          label="Tổng số học viên"
          subtext="Tài khoản học viên đã đăng ký"
        />
        <Summary
          value={studentsWithAttempts.length}
          label="Đã tham gia luyện đề"
          subtext={`${students.reduce((sum, s) => sum + s.examAttempts.length, 0)} lượt làm bài từ học viên`}
        />
        <Summary
          value={studentsNeedingGrade.length}
          label="Học viên có bài chờ chấm"
          subtext={studentsNeedingGrade.length > 0 ? "Cần giáo viên chấm câu tự luận" : "Đã chấm hoàn tất"}
          highlight={studentsNeedingGrade.length > 0 ? "warning" : "normal"}
        />
        <Summary
          value={studentsEnrolled.length}
          label="Đang học khóa chính khóa"
          subtext="Đã được ghi danh vào lớp học"
        />
      </div>

      <div className="soft-card p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#092b4c]">
              Danh sách & Thống kê Học viên
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Xem số lượng đề từng bạn đã làm, điểm trung bình, tiến độ khóa học và phân tích điểm mạnh / điểm yếu.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            Hiển thị {filteredStudents.length}/{students.length} học viên
          </span>
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <label className="min-w-72 flex-1 text-xs font-semibold text-slate-600">
            Tìm kiếm học viên
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Tìm theo họ tên, email hoặc tên khóa học..."
              className="field-control mt-1.5 p-2.5 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["ALL", `Tất cả (${students.length})`],
                ["ACTIVE_ATTEMPTS", `Đã làm đề (${studentsWithAttempts.length})`],
                ["NEEDS_GRADING", `Chờ chấm (${studentsNeedingGrade.length})`],
                ["ENROLLED", `Đang học khóa học (${studentsEnrolled.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => onFilterModeChange(key)}
                className={`min-h-10 rounded-xl px-3.5 text-xs font-bold transition-colors ${
                  filterMode === key
                    ? "bg-[#123d68] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-3 pr-4 font-bold">Học viên</th>
                <th className="px-3 py-3 font-bold">Khóa đang học</th>
                <th className="px-3 py-3 font-bold text-center">Số đề đã làm</th>
                <th className="px-3 py-3 font-bold text-center">Điểm TB (Thang 10)</th>
                <th className="px-3 py-3 font-bold text-center">Cao nhất</th>
                <th className="px-3 py-3 font-bold">Hoạt động gần nhất</th>
                <th className="py-3 pl-3 font-bold text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map((student) => {
                const finished = student.examAttempts.filter((a) => a.status !== "DRAFT");
                const drafts = student.examAttempts.filter((a) => a.status === "DRAFT");
                const pendingCount = student.examAttempts.filter((a) => a.status === "SUBMITTED").length;
                const scores10 = finished
                  .map((a) => {
                    const p = a.possible + a.manualPossible;
                    const e = a.earned + a.manualEarned;
                    return p > 0 ? (e / p) * 10 : null;
                  })
                  .filter((v): v is number => v !== null);
                const avg10 =
                  scores10.length > 0
                    ? (scores10.reduce((sum, v) => sum + v, 0) / scores10.length).toFixed(1)
                    : null;
                const max10 = scores10.length > 0 ? Math.max(...scores10).toFixed(1) : null;
                const latestAttempt = student.examAttempts[0] || null;

                return (
                  <tr key={student.id} className="hover:bg-slate-50/80">
                    <td className="py-4 pr-4">
                      <strong className="block text-[#092b4c]">{student.fullName}</strong>
                      <span className="text-xs text-slate-500">{student.email}</span>
                    </td>
                    <td className="px-3 py-4">
                      {student.enrollments.length > 0 ? (
                        <div className="space-y-1.5">
                          {student.enrollments.map((enr) => (
                            <div key={enr.id} className="text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-slate-700">{enr.course.title}</span>
                                <span className="font-bold text-[#123d68]">{enr.progress}%</span>
                              </div>
                              <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-[#123d68]"
                                  style={{ width: `${enr.progress}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Chưa ghi danh khóa học</span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-center">
                      <strong className="text-base tabular-nums text-[#092b4c]">
                        {student.examAttempts.length}
                      </strong>
                      <span className="block text-[11px] text-slate-500">
                        {finished.length} hoàn thành
                        {drafts.length > 0 ? ` · ${drafts.length} đang làm` : ""}
                      </span>
                      {pendingCount > 0 && (
                        <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
                          {pendingCount} bài chờ chấm
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-center">
                      {avg10 ? (
                        <span
                          className={`inline-block rounded-lg px-2.5 py-1 text-xs font-extrabold tabular-nums ${
                            Number(avg10) >= 8
                              ? "bg-emerald-50 text-emerald-700"
                              : Number(avg10) >= 5
                                ? "bg-blue-50 text-[#123d68]"
                                : "bg-red-50 text-red-700"
                          }`}
                        >
                          {avg10} / 10
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Chưa có điểm</span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-center font-bold tabular-nums text-slate-700">
                      {max10 ? `${max10} / 10` : "—"}
                    </td>
                    <td className="px-3 py-4 text-xs text-slate-600">
                      {latestAttempt ? (
                        <div>
                          <strong className="block truncate max-w-44 text-[#092b4c]">
                            {latestAttempt.exam.title}
                          </strong>
                          <span className="text-slate-400">
                            {formatDate(latestAttempt.updatedAt)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">Chưa làm đề nào</span>
                      )}
                    </td>
                    <td className="py-4 pl-3 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectStudent(student.id)}
                        className="btn-outline min-h-9 px-3 text-xs font-bold"
                      >
                        Xem hồ sơ & lịch sử
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredStudents.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">
              Không tìm thấy học viên nào phù hợp với bộ lọc.
            </p>
          )}
        </div>
      </div>

      {guestAttempts.length > 0 && (
        <div className="soft-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#092b4c]">
                Lượt làm bài của Khách (Chưa đăng nhập tài khoản)
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Các lượt làm bài tự do trên cổng công khai khi học sinh chỉ nhập họ tên tạm thời.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {guestAttempts.length} lượt khách
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {guestAttempts.slice(0, 9).map((guest) => {
              const totalEarned = guest.earned + guest.manualEarned;
              const totalPossible = guest.possible + guest.manualPossible;
              const scale10 = totalPossible > 0 ? ((totalEarned / totalPossible) * 10).toFixed(1) : null;
              return (
                <div key={guest.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <strong className="text-[#092b4c]">{guest.participantName || "Khách"}</strong>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${guest.status === "GRADED" ? "bg-emerald-50 text-emerald-700" : guest.status === "SUBMITTED" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                      {guest.status === "DRAFT" ? "Đang làm" : statusLabels[guest.status]}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-600">{guest.exam.title}</p>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
                    <span className="font-bold text-[#123d68]">
                      {guest.status !== "DRAFT" && scale10 ? `${scale10}/10 điểm` : `${answeredCount(guest.answers)}/${guest.exam.questions.length} câu`}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectAttempt(guest.id)}
                      className="font-bold text-[#d91f2a] hover:underline"
                    >
                      Xem bài →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StudentAnalyticsModal({
  student,
  onSelectAttempt,
}: {
  student: StaffStudent;
  onSelectAttempt: (attemptId: string) => void;
}) {
  const finishedAttempts = student.examAttempts.filter((a) => a.status !== "DRAFT");
  const draftAttempts = student.examAttempts.filter((a) => a.status === "DRAFT");
  const pendingAttempts = student.examAttempts.filter((a) => a.status === "SUBMITTED");

  const scores10 = finishedAttempts
    .map((a) => {
      const p = a.possible + a.manualPossible;
      const e = a.earned + a.manualEarned;
      return p > 0 ? (e / p) * 10 : null;
    })
    .filter((v): v is number => v !== null);

  const avg10 =
    scores10.length > 0
      ? (scores10.reduce((sum, v) => sum + v, 0) / scores10.length).toFixed(1)
      : "—";
  const max10 = scores10.length > 0 ? Math.max(...scores10).toFixed(1) : "—";

  // Calculate skill breakdown by QuestionTaskType across finished attempts
  const skillStatsMap = new Map<
    string,
    { taskType: string; label: string; correct: number; total: number }
  >();
  let totalAutoQuestions = 0;
  let totalAutoCorrect = 0;

  for (const attempt of finishedAttempts) {
    const answers = objectRecord(attempt.answers);
    const manualScores = objectRecord(attempt.manualScores);
    for (const q of attempt.exam.questions) {
      const taskKey = q.taskType || "GENERAL";
      const label = questionTaskLabels[taskKey] || "Câu hỏi chung";
      const entry = skillStatsMap.get(taskKey) || {
        taskType: taskKey,
        label,
        correct: 0,
        total: 0,
      };
      const response = String(answers[String(q.position)] || "");
      const automatic = q.kind !== "ESSAY" && !!q.answer;
      if (automatic) {
        entry.total += 1;
        totalAutoQuestions += 1;
        if (isAttemptAnswerCorrect(response, q.answer || "", q.kind, q.taskType)) {
          entry.correct += 1;
          totalAutoCorrect += 1;
        }
        skillStatsMap.set(taskKey, entry);
      } else if (manualScores[String(q.position)] !== undefined && q.points > 0) {
        entry.total += 1;
        totalAutoQuestions += 1;
        if (Number(manualScores[String(q.position)]) >= q.points * 0.7) {
          entry.correct += 1;
          totalAutoCorrect += 1;
        }
        skillStatsMap.set(taskKey, entry);
      }
    }
  }

  const skillStats = Array.from(skillStatsMap.values())
    .filter((s) => s.total > 0)
    .map((s) => ({
      ...s,
      accuracy: Math.round((s.correct / s.total) * 100),
    }))
    .sort((a, b) => a.accuracy - b.accuracy); // Weakest skills first so teachers see what needs attention

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <span className="text-xs font-semibold text-slate-500">Tổng lượt luyện đề</span>
          <strong className="mt-1 block text-2xl font-extrabold text-[#092b4c]">
            {student.examAttempts.length} đề
          </strong>
          <span className="mt-1 block text-xs text-slate-500">
            {finishedAttempts.length} đã nộp · {draftAttempts.length} đang làm
          </span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <span className="text-xs font-semibold text-slate-500">Điểm trung bình (Thang 10)</span>
          <strong className="mt-1 block text-2xl font-extrabold text-[#123d68]">
            {avg10}{scores10.length > 0 ? " / 10" : ""}
          </strong>
          <span className="mt-1 block text-xs text-slate-500">
            Cao nhất: {max10}{scores10.length > 0 ? " / 10" : ""}
          </span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <span className="text-xs font-semibold text-slate-500">Tỷ lệ trả lời đúng</span>
          <strong className="mt-1 block text-2xl font-extrabold text-emerald-700">
            {totalAutoQuestions > 0
              ? `${Math.round((totalAutoCorrect / totalAutoQuestions) * 100)}%`
              : "—"}
          </strong>
          <span className="mt-1 block text-xs text-slate-500">
            {totalAutoCorrect}/{totalAutoQuestions} câu đã chấm
          </span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <span className="text-xs font-semibold text-slate-500">Bài chờ giáo viên chấm</span>
          <strong className={`mt-1 block text-2xl font-extrabold ${pendingAttempts.length > 0 ? "text-amber-700" : "text-slate-700"}`}>
            {pendingAttempts.length} bài
          </strong>
          <span className="mt-1 block text-xs text-slate-500">
            Tham gia từ {new Date(student.createdAt).toLocaleDateString("vi-VN")}
          </span>
        </div>
      </div>

      {student.enrollments.length > 0 && (
        <section className="rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-[#092b4c]">
            Khóa học đang theo học tại trung tâm
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {student.enrollments.map((enr) => (
              <div key={enr.id} className="rounded-lg bg-slate-50 p-3">
                <div className="flex items-center justify-between text-sm">
                  <strong className="text-[#092b4c]">{enr.course.title}</strong>
                  <span className="font-extrabold text-[#123d68]">{enr.progress}%</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {enr.course.level || "Chương trình chuẩn"} · {enr.course.ageRange}
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-[#123d68]"
                    style={{ width: `${enr.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {skillStats.length > 0 && (
        <section className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[#092b4c]">
                Phân tích năng lực theo dạng bài (Điểm mạnh & Điểm yếu)
              </h3>
              <p className="text-xs text-slate-500">
                Tổng hợp từ các câu trả lời của học viên giúp giáo viên biết dạng bài nào cần ôn tập thêm.
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {skillStats.map((skill) => {
              const badgeClass =
                skill.accuracy >= 75
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : skill.accuracy >= 50
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-red-50 text-red-700 border-red-200";
              const statusText =
                skill.accuracy >= 75
                  ? "Vững vàng"
                  : skill.accuracy >= 50
                    ? "Cần củng cố"
                    : "Hay sai · Cần kèm thêm";
              return (
                <div
                  key={skill.taskType}
                  className={`rounded-xl border p-3 ${badgeClass}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-xs font-extrabold">{skill.label}</strong>
                    <span className="text-sm font-black tabular-nums">{skill.accuracy}%</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] opacity-85">
                    <span>Đúng {skill.correct}/{skill.total} câu</span>
                    <span className="font-bold">{statusText}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-sm font-bold text-[#092b4c]">
          Lịch sử làm đề chi tiết ({student.examAttempts.length} lượt)
        </h3>
        <div className="mt-3 max-h-80 space-y-2.5 overflow-y-auto pr-1">
          {student.examAttempts.map((attempt) => {
            const totalEarned = attempt.earned + attempt.manualEarned;
            const totalPossible = attempt.possible + attempt.manualPossible;
            const scale10 =
              totalPossible > 0 ? ((totalEarned / totalPossible) * 10).toFixed(1) : null;
            return (
              <div
                key={attempt.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-sm"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-[#092b4c]">{attempt.exam.title}</strong>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                        attempt.status === "GRADED"
                          ? "bg-emerald-50 text-emerald-700"
                          : attempt.status === "SUBMITTED"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {attempt.status === "DRAFT"
                        ? "Đang làm"
                        : statusLabels[attempt.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {answeredCount(attempt.answers)}/{attempt.exam.questions.length} câu đã trả lời · Cập nhật {formatDate(attempt.updatedAt)}
                  </p>
                  {attempt.teacherFeedback && (
                    <p className="mt-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                      <strong>Nhận xét GV:</strong> {attempt.teacherFeedback}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {attempt.status !== "DRAFT" && (
                    <div className="text-right">
                      <strong className="block text-sm text-[#092b4c]">
                        {totalEarned}/{totalPossible} điểm
                      </strong>
                      {scale10 && (
                        <span className="block text-xs font-bold text-[#123d68]">
                          Thang 10: {scale10}/10
                        </span>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onSelectAttempt(attempt.id)}
                    className="btn-outline min-h-9 px-3 text-xs font-bold"
                  >
                    {attempt.status === "DRAFT" ? "Xem tiến độ" : "Xem chi tiết / Chấm bài"}
                  </button>
                </div>
              </div>
            );
          })}
          {student.examAttempts.length === 0 && (
            <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
              Học viên này chưa bắt đầu làm đề thi nào.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function QuestionErrorAnalyticsPanel({
  attempts,
  exams,
  selectedExamId,
  onSelectExamId,
}: {
  attempts: StaffAttempt[];
  exams: Exam[];
  selectedExamId: string;
  onSelectExamId: (examId: string) => void;
}) {
  const submitted = attempts.filter(
    (a) =>
      a.status !== "DRAFT" &&
      (selectedExamId === "ALL" || a.exam.id === selectedExamId),
  );

  if (submitted.length === 0) return null;

  const questionMap = new Map<
    string,
    {
      key: string;
      examTitle: string;
      position: number;
      taskType: string;
      prompt: string;
      correctAnswer: string;
      wrongCount: number;
      totalCount: number;
      wrongChoices: Record<string, number>;
    }
  >();

  for (const attempt of submitted) {
    const answers = objectRecord(attempt.answers);
    for (const q of attempt.exam.questions) {
      if (q.kind === "ESSAY" || !q.answer) continue;
      const key = `${attempt.exam.id}-${q.position}`;
      const item = questionMap.get(key) || {
        key,
        examTitle: attempt.exam.title,
        position: q.position,
        taskType: q.taskType || "GENERAL",
        prompt: stripFormattedText(
          cleanQuestionPrompt(q.content, q.section, q.taskType, q.position),
        ),
        correctAnswer: q.answer,
        wrongCount: 0,
        totalCount: 0,
        wrongChoices: {},
      };
      const response = String(answers[String(q.position)] || "").trim();
      item.totalCount += 1;
      const isCorrect = isAttemptAnswerCorrect(
        response,
        q.answer,
        q.kind,
        q.taskType,
      );
      if (!isCorrect) {
        item.wrongCount += 1;
        const chosenLabel = response ? response.toUpperCase().slice(0, 20) : "Bỏ trống";
        item.wrongChoices[chosenLabel] = (item.wrongChoices[chosenLabel] || 0) + 1;
      }
      questionMap.set(key, item);
    }
  }

  const mostMissed = Array.from(questionMap.values())
    .filter((item) => item.wrongCount > 0)
    .map((item) => ({
      ...item,
      errorRate: Math.round((item.wrongCount / item.totalCount) * 100),
      topWrongChoice:
        Object.entries(item.wrongChoices).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    }))
    .sort((a, b) => b.errorRate - a.errorRate || b.wrongCount - a.wrongCount)
    .slice(0, 6);

  if (mostMissed.length === 0) return null;

  return (
    <details className="soft-card p-5">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 text-sm font-bold text-[#092b4c]">
        <span>
          Phân tích câu hỏi học viên hay làm sai nhất ({mostMissed.length} câu cần lưu ý chữa bài)
        </span>
        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-extrabold text-red-700">
          Gợi ý chữa đề trên lớp
        </span>
      </summary>
      <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Thống kê dựa trên <strong>{submitted.length} bài đã nộp</strong>. Các câu dưới đây có tỷ lệ học viên trả lời sai hoặc bỏ trống cao nhất:
          </span>
          {selectedExamId !== "ALL" && (
            <button
              type="button"
              onClick={() => onSelectExamId("ALL")}
              className="font-bold text-[#123d68] underline"
            >
              Xem trên tất cả đề ({exams.length})
            </button>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {mostMissed.map((item) => (
            <div
              key={item.key}
              className="rounded-xl border border-red-100 bg-red-50/30 p-3.5 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <strong className="text-sm text-[#092b4c]">
                    Câu {item.position} · {item.examTitle}
                  </strong>
                  <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    {questionTaskLabels[item.taskType] || "Câu hỏi chung"}
                  </span>
                </div>
                <span className="shrink-0 rounded-lg bg-red-100 px-2 py-1 font-extrabold text-red-800">
                  Sai {item.errorRate}% ({item.wrongCount}/{item.totalCount})
                </span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-slate-700">{item.prompt}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                <span>
                  Đáp án đúng: <strong className="text-emerald-700">{item.correctAnswer}</strong>
                </span>
                {item.topWrongChoice && (
                  <span>
                    Hay nhầm sang: <strong className="text-red-700">{item.topWrongChoice}</strong>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
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
  max?: string;
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

function questionInteractionData(value: unknown) {
  const item = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const list = (candidate: unknown) => Array.isArray(candidate)
    ? candidate.filter((entry): entry is string => typeof entry === "string")
    : [];
  return {
    matchingLeft: list(item.matchingLeft),
    matchingRight: list(item.matchingRight),
    orderingItems: list(item.orderingItems),
  };
}

function structuredAnswerLines(answer: string | null, taskType: string) {
  if (!answer) return "";
  try {
    const parsed = JSON.parse(answer);
    if (taskType === "MATCHING" && parsed && typeof parsed === "object" && !Array.isArray(parsed))
      return Object.entries(parsed as Record<string, unknown>)
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([, item]) => String(item))
        .join("\n");
    if (taskType === "ORDERING" && Array.isArray(parsed)) return parsed.map(String).join("\n");
  } catch {}
  return answer;
}

function serializedAnswer(taskType: string, structured: unknown, plain: unknown) {
  const lines = String(structured || "").split("\n").map((item) => item.trim()).filter(Boolean);
  if (taskType === "MATCHING" && lines.length)
    return JSON.stringify(Object.fromEntries(lines.map((item, index) => [String(index), item])));
  if (taskType === "ORDERING" && lines.length) return JSON.stringify(lines);
  return String(plain || "").trim();
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
    AI_EXTRACTED: "Gemini nhận diện",
    NEEDS_REVIEW: "Cần kiểm tra",
    TYPE_NORMALIZED: "Đã chuẩn hóa loại câu",
    CHOICES_DEDUPLICATED: "Đã bỏ lựa chọn lặp",
    INTERACTION_INCOMPLETE: "Thiếu dữ liệu kéo-thả",
  };
  return labels[flag] || "Cần rà soát";
}

const questionKindLabels: Record<string, string> = {
  SINGLE_CHOICE: "Chọn một đáp án",
  MULTIPLE_CHOICE: "Chọn nhiều đáp án",
  TRUE_FALSE: "Đúng / Sai",
  SHORT_TEXT: "Trả lời ngắn",
  ESSAY: "Tự luận",
};

const questionTaskLabels: Record<string, string> = {
  GENERAL: "Câu hỏi chung",
  PRONUNCIATION: "Phát âm",
  STRESS: "Trọng âm",
  VOCABULARY: "Từ vựng",
  SYNONYM: "Từ đồng nghĩa",
  ANTONYM: "Từ trái nghĩa",
  PHRASAL_VERB: "Cụm động từ",
  GRAMMAR: "Ngữ pháp",
  GAP_FILL: "Điền chỗ trống",
  FUNCTIONAL_COMMUNICATION: "Giao tiếp",
  PASSIVE_VOICE: "Câu bị động",
  REPORTED_SPEECH: "Câu tường thuật",
  CONDITIONAL_SENTENCE: "Câu điều kiện",
  RELATIVE_CLAUSE: "Mệnh đề quan hệ",
  TAG_QUESTION: "Câu hỏi đuôi",
  WORD_FORM: "Dạng từ",
  VERB_FORM: "Dạng động từ",
  CLOZE: "Điền vào đoạn văn",
  READING_COMPREHENSION: "Đọc hiểu",
  MULTIPLE_SELECT: "Chọn nhiều",
  TRUE_FALSE: "Đúng / Sai",
  MATCHING: "Nối cặp",
  ORDERING: "Sắp xếp",
  ERROR_CORRECTION: "Tìm / sửa lỗi",
  SENTENCE_COMBINATION: "Nối câu",
  SENTENCE_REWRITE: "Viết lại câu",
  SENTENCE_BUILDING: "Xây dựng câu",
  TRANSLATION: "Dịch",
  LISTENING: "Nghe hiểu",
  DICTATION: "Nghe chép",
  WRITING: "Viết",
  OTHER: "Dạng khác",
};

const questionTaskOptions = Object.entries(questionTaskLabels);

function recognitionProviderInfo(question: Question) {
  const provider = question.recognitionProvider || "LOCAL";
  if (provider === "GEMINI") return { label: "Gemini", className: "bg-violet-50 text-violet-700", detail: question.recognitionModel || "Gemini" };
  if (provider === "LOCAL_FALLBACK") return { label: "Dự phòng nội bộ", className: "bg-amber-50 text-amber-800", detail: "Gemini không khả dụng; hệ thống đã tự chuyển sang bộ nhận diện nội bộ" };
  if (provider === "MANUAL") return { label: "Thêm thủ công", className: "bg-blue-50 text-blue-700", detail: "Giáo viên tạo thủ công" };
  return { label: "Nhận diện nội bộ", className: "bg-slate-100 text-slate-700", detail: "Bộ nhận diện không dùng AI" };
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
  const [manualTaskType, setManualTaskType] = useState("GENERAL");
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
  const providerCounts = exam.questions.reduce<Record<string, number>>((counts, question) => {
    const provider = question.recognitionProvider || "LOCAL";
    counts[provider] = (counts[provider] || 0) + 1;
    return counts;
  }, {});
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

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" aria-label="Nguồn nhận diện câu hỏi">
        <span className="font-semibold text-slate-500">Nguồn xử lý:</span>
        {providerCounts.GEMINI > 0 && <span className="rounded-full bg-violet-50 px-2.5 py-1 font-bold text-violet-700">Gemini {providerCounts.GEMINI}</span>}
        {providerCounts.LOCAL_FALLBACK > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 font-bold text-amber-800">Dự phòng {providerCounts.LOCAL_FALLBACK}</span>}
        {providerCounts.LOCAL > 0 && <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-700">Nội bộ {providerCounts.LOCAL}</span>}
        {providerCounts.MANUAL > 0 && <span className="rounded-full bg-blue-50 px-2.5 py-1 font-bold text-blue-700">Thủ công {providerCounts.MANUAL}</span>}
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
                answer: serializedAnswer(String(values.taskType), values.structuredAnswer, values.answer),
                kind: values.kind,
                taskType: values.taskType,
                interactionData: {
                  matchingLeft: String(values.matchingLeft || "").split("\n").map((item) => item.trim()).filter(Boolean),
                  matchingRight: String(values.matchingRight || "").split("\n").map((item) => item.trim()).filter(Boolean),
                  orderingItems: String(values.orderingItems || "").split("\n").map((item) => item.trim()).filter(Boolean),
                },
                points: Number(values.points),
                content: values.content,
                section: values.section,
                options: String(values.options || "").split("\n").map((option) => option.trim()).filter(Boolean),
              });
              event.currentTarget.reset();
              setManualTaskType("GENERAL");
              setShowManual(false);
            }}
            className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"
          >
            <Field name="position" label="Vị trí câu" type="number" min="1" required />
            <label className="text-sm font-semibold">
              Loại câu hỏi
              <select name="kind" className="field-control mt-2 p-3">
                <option value="SINGLE_CHOICE">Chọn một đáp án</option>
                <option value="MULTIPLE_CHOICE">Chọn nhiều đáp án</option>
                <option value="TRUE_FALSE">Đúng / Sai</option>
                <option value="SHORT_TEXT">Trả lời ngắn</option>
                <option value="ESSAY">Tự luận</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              Dạng bài
              <select name="taskType" value={manualTaskType} onChange={(event) => setManualTaskType(event.target.value)} className="field-control mt-2 p-3">
                {questionTaskOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            {manualTaskType === "MATCHING" && (
              <>
                <label className="text-sm font-semibold">
                  Cột trái (mỗi dòng một mục)
                  <textarea name="matchingLeft" required className="field-control mt-2 min-h-32 p-3" />
                </label>
                <label className="text-sm font-semibold">
                  Cột phải (mỗi dòng một mục)
                  <textarea name="matchingRight" required className="field-control mt-2 min-h-32 p-3" />
                </label>
              </>
            )}
            {manualTaskType === "ORDERING" && (
              <label className="text-sm font-semibold sm:col-span-2">
                Các mục cần sắp xếp (mỗi dòng một mục)
                <textarea name="orderingItems" required className="field-control mt-2 min-h-32 p-3" />
              </label>
            )}
            <Field name="section" label="Tên phần" placeholder="Ví dụ: I. Pronunciation" />
            {manualTaskType === "MATCHING" || manualTaskType === "ORDERING" ? (
              <label className="text-sm font-semibold sm:col-span-2">
                {manualTaskType === "MATCHING" ? "Đáp án đúng theo thứ tự cột trái" : "Thứ tự đúng"} (mỗi dòng một mục)
                <textarea name="structuredAnswer" className="field-control mt-2 min-h-28 p-3" placeholder="Có thể để trống để giáo viên chấm tay" />
              </label>
            ) : (
              <Field name="answer" label="Đáp án" placeholder="A hoặc nội dung đáp án" />
            )}
            <label className="text-sm font-semibold sm:col-span-2">
              Nội dung câu hỏi (dùng __chữ__ để gạch chân, ![mô tả](link-ảnh) để chèn ảnh)
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
  const [editingTaskType, setEditingTaskType] = useState(question.taskType || "GENERAL");
  const options = questionOptions(question.options);
  const interaction = questionInteractionData(question.interactionData);
  const flags = questionReviewFlags(question.reviewFlags);
  const confidence = Math.round((question.recognitionConfidence ?? 1) * 100);
  const reviewed = Boolean(question.reviewedAt);
  const providerInfo = recognitionProviderInfo(question);
  const importantFlags = flags.filter((flag) =>
    ["NO_OPTIONS", "POSSIBLE_VOCABULARY", "POSSIBLE_THEORY", "OCR_REVIEW", "COMPLEX_LAYOUT", "LEARNED_CORRECTION", "NEEDS_REVIEW", "TYPE_NORMALIZED", "INTERACTION_INCOMPLETE"].includes(flag),
  );
  const currentBody = {
    position: question.position,
    answer: question.answer || "",
    kind: question.kind,
    taskType: question.taskType || "GENERAL",
    interactionData: interaction,
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
        <div className="flex flex-wrap justify-end gap-2">
          <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-bold ${providerInfo.className}`} title={`${providerInfo.detail}${question.extractionBatch ? ` · cụm ${question.extractionBatch}` : ""}`}>
            {providerInfo.label}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${statusClass}`}>
            {reviewed || confidence >= 68 ? <CheckCircle2 size={12} aria-hidden="true" /> : <AlertTriangle size={12} aria-hidden="true" />}
            {statusLabel}{showTechnical ? ` · ${confidence}%` : ""}
          </span>
        </div>
      </div>

      {!editing ? (
        <>
          {question.section && <p className="mt-3 text-xs font-semibold text-slate-500">{renderFormattedText(question.section)}</p>}
          <p className="mt-2 text-sm font-semibold leading-6 text-[#092b4c]">
            {renderFormattedText(
              cleanQuestionPrompt(
                question.content,
                question.section,
                question.taskType,
                question.position,
              ),
            )}
          </p>
          {options.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {enrichPronunciationOptions(options, question.taskType).map((option) => (
                <span key={option} className="rounded-lg bg-slate-50 px-3 py-2 text-sm leading-5 text-slate-700">
                  {renderFormattedText(option)}
                </span>
              ))}
            </div>
          )}
          {question.taskType === "MATCHING" && (
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <strong className="text-xs text-slate-500">Cột trái</strong>
                <ol className="mt-2 space-y-1.5">{interaction.matchingLeft.map((item, index) => <li key={`${index}-${item}`}>{index + 1}. {item}</li>)}</ol>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <strong className="text-xs text-slate-500">Cột phải</strong>
                <ol className="mt-2 space-y-1.5">{interaction.matchingRight.map((item, index) => <li key={`${index}-${item}`}>{String.fromCharCode(65 + index)}. {item}</li>)}</ol>
              </div>
            </div>
          )}
          {question.taskType === "ORDERING" && interaction.orderingItems.length > 0 && (
            <ol className="mt-3 space-y-2 text-sm">
              {interaction.orderingItems.map((item, index) => <li key={`${index}-${item}`} className="rounded-lg bg-slate-50 px-3 py-2">{index + 1}. {item}</li>)}
            </ol>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-blue-50 px-2 py-1 font-semibold text-blue-700">
              {questionKindLabels[question.kind] || question.kind}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
              {questionTaskLabels[question.taskType] || "Dạng khác"}
            </span>
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
              answer: serializedAnswer(String(values.taskType), values.structuredAnswer, values.answer),
              kind: values.kind,
              taskType: values.taskType,
              interactionData: {
                matchingLeft: String(values.matchingLeft || "").split("\n").map((item) => item.trim()).filter(Boolean),
                matchingRight: String(values.matchingRight || "").split("\n").map((item) => item.trim()).filter(Boolean),
                orderingItems: String(values.orderingItems || "").split("\n").map((item) => item.trim()).filter(Boolean),
              },
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
              <option value="SINGLE_CHOICE">Chọn một đáp án</option>
              <option value="MULTIPLE_CHOICE">Chọn nhiều đáp án</option>
              <option value="TRUE_FALSE">Đúng / Sai</option>
              <option value="SHORT_TEXT">Trả lời ngắn</option>
              <option value="ESSAY">Tự luận</option>
            </select>
          </label>
          <label className="text-xs font-semibold">
            Dạng bài
            <select name="taskType" value={editingTaskType} onChange={(event) => setEditingTaskType(event.target.value)} className="field-control mt-1 p-2 text-sm">
              {questionTaskOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {editingTaskType === "MATCHING" && (
            <>
              <label className="text-xs font-semibold">
                Cột trái
                <textarea name="matchingLeft" defaultValue={interaction.matchingLeft.join("\n")} required className="field-control mt-1 min-h-28 p-2 text-sm" />
              </label>
              <label className="text-xs font-semibold md:col-span-2">
                Cột phải
                <textarea name="matchingRight" defaultValue={interaction.matchingRight.join("\n")} required className="field-control mt-1 min-h-28 p-2 text-sm" />
              </label>
            </>
          )}
          {editingTaskType === "ORDERING" && (
            <label className="text-xs font-semibold md:col-span-3">
              Các mục cần sắp xếp
              <textarea name="orderingItems" defaultValue={interaction.orderingItems.join("\n")} required className="field-control mt-1 min-h-28 p-2 text-sm" />
            </label>
          )}
          <label className="text-xs font-semibold md:col-span-3">
            Nội dung câu hỏi (dùng __chữ__ để gạch chân âm tiết/từ cần sửa, ![mô tả](link-ảnh) để chèn ảnh)
            <textarea name="content" defaultValue={question.content || ""} required className="field-control mt-1 min-h-20 p-2 text-sm" />
          </label>
          <label className="text-xs font-semibold md:col-span-3">
            Các lựa chọn (mỗi dòng một lựa chọn · ví dụ: A. l__a__yer)
            <textarea name="options" defaultValue={options.join("\n")} className="field-control mt-1 min-h-24 p-2 text-sm" />
          </label>
          {editingTaskType === "MATCHING" || editingTaskType === "ORDERING" ? (
            <label className="text-xs font-semibold md:col-span-2">
              {editingTaskType === "MATCHING" ? "Đáp án đúng theo thứ tự cột trái" : "Thứ tự đúng"} (mỗi dòng một mục)
              <textarea name="structuredAnswer" defaultValue={structuredAnswerLines(question.answer, editingTaskType)} className="field-control mt-1 min-h-24 p-2 text-sm" placeholder="Để trống nếu giáo viên sẽ chấm tay" />
            </label>
          ) : (
            <label className="text-xs font-semibold">
              Đáp án
              <input name="answer" defaultValue={question.answer || ""} placeholder="A / nội dung đáp án" className="field-control mt-1 p-2 text-sm" />
            </label>
          )}
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
