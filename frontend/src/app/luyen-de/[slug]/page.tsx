"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Eye,
  ExternalLink,
  FileText,
  GripVertical,
  ChevronUp,
  ChevronDown,
  ListChecks,
  LogIn,
  RotateCcw,
  Save,
  UserRound,
} from "lucide-react";
import { gradeLabel } from "@/lib/content-options";
import { Modal } from "@/components/modal";

type Question = {
  position: number;
  sourceLabel: string | null;
  section: string | null;
  content: string | null;
  options: unknown;
  interactionData: unknown;
  sourcePage: number | null;
  kind: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_TEXT" | "ESSAY";
  taskType: string;
  points: number;
};
type Exam = {
  id: string;
  title: string;
  summary: string;
  grade: number;
  durationMinutes: number;
  questions: Question[];
  source?: { fileName: string; mimeType: string };
};
type Result = {
  earned: number;
  possible: number;
  manualEarned: number;
  manualPossible: number;
  pending: number;
  provisional: boolean;
  details: {
    position: number;
    status: string;
    correctAnswer?: string;
    score?: number;
  }[];
};
type Attempt = {
  attemptId: string;
  guestToken?: string;
  participantName: string | null;
  status: "DRAFT" | "SUBMITTED" | "GRADED";
};
type StartResponse = Attempt & {
  answers: Record<string, string>;
  savedAt: string;
  teacherFeedback?: string | null;
  result?: Result | null;
};

const api = process.env.NEXT_PUBLIC_API_URL || "/api";

const taskTypeLabels: Record<string, string> = {
  PRONUNCIATION: "Phát âm", STRESS: "Trọng âm", VOCABULARY: "Từ vựng",
  SYNONYM: "Từ đồng nghĩa", ANTONYM: "Từ trái nghĩa", PHRASAL_VERB: "Cụm động từ",
  GRAMMAR: "Ngữ pháp", GAP_FILL: "Điền chỗ trống", FUNCTIONAL_COMMUNICATION: "Giao tiếp",
  PASSIVE_VOICE: "Câu bị động", REPORTED_SPEECH: "Câu tường thuật",
  CONDITIONAL_SENTENCE: "Câu điều kiện", RELATIVE_CLAUSE: "Mệnh đề quan hệ", TAG_QUESTION: "Câu hỏi đuôi",
  WORD_FORM: "Dạng từ", VERB_FORM: "Dạng động từ",
  CLOZE: "Điền vào đoạn văn", READING_COMPREHENSION: "Đọc hiểu",
  MULTIPLE_SELECT: "Chọn nhiều", TRUE_FALSE: "Đúng / Sai", MATCHING: "Nối cặp",
  ORDERING: "Sắp xếp", ERROR_CORRECTION: "Tìm / sửa lỗi",
  SENTENCE_COMBINATION: "Nối câu", SENTENCE_REWRITE: "Viết lại câu",
  SENTENCE_BUILDING: "Xây dựng câu", TRANSLATION: "Dịch", LISTENING: "Nghe hiểu",
  DICTATION: "Nghe chép", WRITING: "Viết", OTHER: "Dạng khác", GENERAL: "Câu hỏi chung",
};

export default function ExamPage() {
  const params = useParams<{ slug: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [guestName, setGuestName] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [teacherFeedback, setTeacherFeedback] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    fetch(`${api}/public-content/exams/${encodeURIComponent(params.slug)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setExam(await response.json());
      })
      .catch(() => setError("Không tìm thấy đề hoặc đề chưa được xuất bản."));
    fetch(`${api}/auth/me`, { credentials: "include" })
      .then((response) => setAuthenticated(response.ok))
      .catch(() => setAuthenticated(false));
  }, [params.slug]);

  useEffect(() => {
    if (!exam || authenticated === null || attempt) return;
    const storageKey = `brightpath-attempt-${exam.id}`;
    const stored = window.localStorage.getItem(storageKey);
    let saved: { attemptId?: string; guestToken?: string } = {};
    try {
      saved = stored ? JSON.parse(stored) : {};
    } catch {
      window.localStorage.removeItem(storageKey);
    }
    if (!authenticated && !saved.attemptId) return;
    fetch(`${api}/public-content/exams/${exam.id}/attempts/start`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(saved),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = (await response.json()) as StartResponse;
        setAttempt({
          attemptId: data.attemptId,
          guestToken: saved.guestToken,
          participantName: data.participantName,
          status: data.status,
        });
        setAnswers(data.answers || {});
        setResult(data.result || null);
        setTeacherFeedback(data.teacherFeedback || "");
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({
            attemptId: data.attemptId,
            guestToken: saved.guestToken,
          }),
        );
      })
      .catch(() => {
        window.localStorage.removeItem(storageKey);
        if (authenticated) setError("Chưa thể khởi tạo bài làm.");
      });
  }, [attempt, authenticated, exam]);

  useEffect(() => {
    if (!exam || !attempt || result || attempt.status !== "DRAFT") return;
    const timer = window.setTimeout(() => {
      setSaveState("saving");
      fetch(
        `${api}/public-content/exams/${exam.id}/attempts/${attempt.attemptId}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers,
            guestToken: attempt.guestToken,
          }),
        },
      )
        .then((response) => {
          if (!response.ok) throw new Error();
          setSaveState("saved");
        })
        .catch(() => setSaveState("idle"));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [answers, attempt, exam, result]);

  const answered = useMemo(
    () => Object.values(answers).filter((answer) => answer.trim()).length,
    [answers],
  );
  const webQuestions = !!exam?.questions.some((question) => question.content);

  async function submit() {
    if (!exam || !attempt) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${api}/public-content/exams/${exam.id}/attempts/${attempt.attemptId}/submit`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers, guestToken: attempt.guestToken }),
        },
      );
      if (!response.ok) throw new Error("Không thể nộp bài. Vui lòng thử lại.");
      const data = (await response.json()) as Result;
      setResult(data);
      setAttempt((current) =>
        current
          ? {
              ...current,
              status: data.pending ? "SUBMITTED" : "GRADED",
            }
          : current,
      );
      setReviewOpen(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  }

  async function beginGuest(event: React.FormEvent) {
    event.preventDefault();
    if (!exam) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${api}/public-content/exams/${exam.id}/attempts/start`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participantName: guestName }),
        },
      );
      const data = (await response.json()) as StartResponse & {
        message?: string;
      };
      if (!response.ok)
        throw new Error(data.message || "Không thể bắt đầu bài.");
      const nextAttempt: Attempt = {
        attemptId: data.attemptId,
        guestToken: data.guestToken,
        participantName: data.participantName,
        status: data.status,
      };
      setAttempt(nextAttempt);
      window.localStorage.setItem(
        `brightpath-attempt-${exam.id}`,
        JSON.stringify({
          attemptId: data.attemptId,
          guestToken: data.guestToken,
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  }

  function restartExam() {
    if (!exam) return;
    window.localStorage.removeItem(`brightpath-attempt-${exam.id}`);
    setAnswers({});
    setResult(null);
    setTeacherFeedback("");
    setAttempt(null);
    setDetailOpen(false);
    setSaveState("idle");
  }

  return (
    <section className="min-h-screen bg-[#f5f7fa] py-8 md:py-10">
      <div className="container-shell">
        <Link href="/luyen-de" className="text-sm font-bold text-[#123d68]">
          ← Danh sách đề
        </Link>
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-red-50 p-4 text-red-700"
          >
            {error}
          </p>
        )}
        {exam && (
          <>
            {!result && (
              <div className="mt-5 rounded-2xl bg-[#0b3157] p-6 text-white md:p-8">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div>
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/60">
                      <Clock3 size={14} /> {gradeLabel(exam.grade)} ·{" "}
                      {exam.durationMinutes} phút
                    </p>
                    <h1 className="mt-3 text-2xl font-extrabold md:text-3xl">
                      {exam.title}
                    </h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">
                      {exam.summary ||
                        "Làm từng câu trực tiếp trên web và nộp bài để nhận kết quả."}
                    </p>
                  </div>
                  <a
                    href={`${api}/public-content/exams/${exam.id}/file`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-light min-h-10 px-4"
                  >
                    <FileText size={16} /> {(exam.source?.mimeType || "application/pdf") === "application/pdf" ? "Xem PDF gốc" : "Mở tệp nguồn"}{" "}
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            )}

            {!attempt && (
              <StartScreen
                authenticated={authenticated}
                guestName={guestName}
                setGuestName={setGuestName}
                busy={busy}
                onSubmit={beginGuest}
              />
            )}

            {attempt && result && (
              <CompletionScreen
                exam={exam}
                attempt={attempt}
                answers={answers}
                result={result}
                teacherFeedback={teacherFeedback}
                onDetails={() => setDetailOpen(true)}
                onRestart={restartExam}
              />
            )}

            {attempt &&
              !result &&
              (webQuestions ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    setReviewOpen(true);
                  }}
                  className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"
                >
                  <div className="space-y-5">
                    {exam.questions.map((question, index) => (
                      <div key={question.position}>
                        {question.section &&
                          question.section !==
                            exam.questions[index - 1]?.section && (
                            <div className="mb-3 rounded-xl bg-[#eaf1f7] px-5 py-4 text-sm font-extrabold leading-6 text-[#123d68]">
                              {question.section}
                            </div>
                          )}
                        <QuestionCard
                          question={question}
                          answer={answers[question.position] || ""}
                          disabled={false}
                          onChange={(answer) =>
                            setAnswers((current) => ({
                              ...current,
                              [question.position]: answer,
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <aside className="soft-card flex max-h-[calc(100vh-7.5rem)] flex-col p-4 lg:sticky lg:top-24">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-extrabold text-[#092b4c]">
                          Tiến độ bài làm
                        </h2>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {attempt.participantName}
                        </p>
                      </div>
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                        <Save size={12} />
                        {saveState === "saving"
                          ? "Đang lưu"
                          : saveState === "saved"
                            ? "Đã lưu"
                            : "Tự lưu"}
                      </span>
                    </div>
                    <div className="mt-3 h-2 shrink-0 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[#d91f2a] transition-all"
                        style={{
                          width: `${exam.questions.length ? (answered / exam.questions.length) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Đã trả lời {answered}/{exam.questions.length} câu
                    </p>
                    <div className="mt-4 grid min-h-0 grid-cols-6 gap-1.5 overflow-y-auto pr-1">
                      {exam.questions.map((question) => (
                        <a
                          key={question.position}
                          href={`#question-${question.position}`}
                          className={`grid h-10 place-items-center rounded-lg text-[11px] font-bold ${answers[question.position]?.trim() ? "bg-[#123d68] text-white" : "bg-slate-100 text-slate-500"}`}
                        >
                          {question.position}
                        </a>
                      ))}
                    </div>
                    <button
                      disabled={busy}
                      className="btn-primary mt-4 min-h-11 w-full shrink-0"
                    >
                      {busy ? "Đang lưu..." : "Kiểm tra và nộp bài"}
                    </button>
                  </aside>
                </form>
              ) : (
                <PdfAnswerSheet
                  exam={exam}
                  answers={answers}
                  setAnswers={setAnswers}
                  result={result}
                  busy={busy}
                  onReview={() => setReviewOpen(true)}
                />
              ))}
            <SubmissionReview
              open={reviewOpen}
              exam={exam}
              answers={answers}
              webQuestions={webQuestions}
              busy={busy}
              onClose={() => setReviewOpen(false)}
              onConfirm={submit}
            />
            {attempt && result && (
              <AttemptDetailModal
                open={detailOpen}
                exam={exam}
                answers={answers}
                result={result}
                onClose={() => setDetailOpen(false)}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}

function StartScreen({
  authenticated,
  guestName,
  setGuestName,
  busy,
  onSubmit,
}: {
  authenticated: boolean | null;
  guestName: string;
  setGuestName: (value: string) => void;
  busy: boolean;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <Modal
      open
      title="Ghi nhận người làm bài"
      description="Thông tin này giúp lưu đúng tiến độ và kết quả của người làm đề."
      onClose={() => {}}
      closeable={false}
      size="sm"
    >
      <div className="mx-auto grid size-12 place-items-center rounded-full bg-[#edf3f8] text-[#123d68]">
        <UserRound size={23} />
      </div>
      {authenticated === null || authenticated ? (
        <p className="mt-3 text-center text-sm leading-6 text-slate-500">
          {authenticated === null
            ? "Đang kiểm tra tài khoản..."
            : "Đang mở bài làm và khôi phục phần bạn đã làm trước đó..."}
        </p>
      ) : (
        <>
          <p className="mt-3 text-center text-sm leading-6 text-slate-500">
            Nhập tên nhanh để làm ngay, hoặc đăng nhập để lưu bài vào hồ sơ học
            viên.
          </p>
          <form onSubmit={onSubmit} className="mt-5">
            <label className="text-sm font-bold">
              Họ và tên
              <input
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                minLength={2}
                maxLength={80}
                required
                autoFocus
                className="field-control mt-2 p-3"
                placeholder="Ví dụ: Nguyễn Minh Anh"
              />
            </label>
            <button disabled={busy} className="btn-primary mt-4 w-full">
              {busy ? "Đang bắt đầu..." : "Bắt đầu làm bài"}
            </button>
          </form>
          <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> hoặc
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <Link href="/dang-nhap" className="btn-outline w-full">
            <LogIn size={17} /> Đăng nhập tài khoản học viên
          </Link>
        </>
      )}
    </Modal>
  );
}

function QuestionCard({
  question,
  answer,
  disabled,
  result,
  onChange,
}: {
  question: Question;
  answer: string;
  disabled: boolean;
  result?: { status: string; correctAnswer?: string; score?: number };
  onChange: (answer: string) => void;
}) {
  const options = Array.isArray(question.options)
    ? question.options.map(String)
    : [];
  return (
    <article
      id={`question-${question.position}`}
      className={`soft-card scroll-mt-24 p-5 md:p-6 ${result?.status === "CORRECT" ? "border-emerald-300" : result?.status === "INCORRECT" ? "border-red-300" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-extrabold uppercase tracking-wider text-[#d91f2a]">
          Câu {question.position}
          {question.sourceLabel &&
          question.sourceLabel !== String(question.position)
            ? ` · số ${question.sourceLabel} trong PDF`
            : ""}
        </p>
        <span className="text-xs font-bold text-slate-400">
          {question.points} điểm
        </span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-7 text-[#172b3e] md:text-[15px]">
        {question.content || `Câu ${question.position}`}
      </p>
      {question.taskType && question.taskType !== "GENERAL" && (
        <span className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
          {taskTypeLabels[question.taskType] || "Dạng khác"}
        </span>
      )}
      {question.sourcePage && (
        <p className="mt-1 text-[11px] text-slate-400">
          Trang PDF {question.sourcePage}
        </p>
      )}
      {question.taskType === "MATCHING" && matchingData(question).left.length > 1 && matchingData(question).right.length > 1 ? (
        <MatchingInteraction
          question={question}
          answer={answer}
          disabled={disabled}
          onChange={onChange}
        />
      ) : question.taskType === "ORDERING" && orderingItems(question).length > 1 ? (
        <OrderingInteraction
          question={question}
          answer={answer}
          disabled={disabled}
          onChange={onChange}
        />
      ) : (question.kind === "SINGLE_CHOICE" || question.kind === "TRUE_FALSE") && options.length ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {options.map((option) => {
            const value = choiceValue(option);
            return (
              <label
                key={option}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm leading-6 transition-colors ${answer === value ? "border-[#123d68] bg-[#edf3f8]" : "border-slate-200 bg-white hover:border-slate-300"}`}
              >
                <input
                  type="radio"
                  name={`question-${question.position}`}
                  value={value}
                  checked={answer === value}
                  disabled={disabled}
                  onChange={() => onChange(value)}
                  className="mt-1 accent-[#d91f2a]"
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      ) : question.kind === "MULTIPLE_CHOICE" && options.length ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {options.map((option) => {
            const value = choiceValue(option);
            const selected = multipleAnswers(answer).includes(value);
            return (
              <label key={option} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm leading-6 transition-colors ${selected ? "border-[#123d68] bg-[#edf3f8]" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                <input
                  type="checkbox"
                  value={value}
                  checked={selected}
                  disabled={disabled}
                  onChange={() => {
                    const next = selected
                      ? multipleAnswers(answer).filter((item) => item !== value)
                      : [...multipleAnswers(answer), value];
                    onChange(JSON.stringify(next.sort()));
                  }}
                  className="mt-1 accent-[#d91f2a]"
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      ) : question.kind === "ESSAY" ? (
        <textarea
          value={answer}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="field-control mt-5 min-h-36 p-4 text-sm leading-6"
          placeholder="Nhập bài làm tự luận..."
        />
      ) : (
        <input
          value={answer}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="field-control mt-5 p-3 text-sm"
          placeholder="Nhập câu trả lời..."
        />
      )}
      {result && (
        <p
          className={`mt-4 flex items-center gap-2 text-xs font-bold ${result.status === "CORRECT" ? "text-emerald-700" : result.status === "PENDING" ? "text-amber-700" : "text-red-700"}`}
        >
          <CheckCircle2 size={15} />
          {result.status === "CORRECT"
            ? "Đúng"
            : result.status === "MANUALLY_GRADED"
              ? `Giáo viên đã chấm: ${result.score} điểm`
              : result.status === "PENDING"
                ? "Chờ giáo viên chấm"
                : `Chưa đúng · Đáp án: ${result.correctAnswer}`}
        </p>
      )}
    </article>
  );
}

function interactionRecord(question: Question) {
  return question.interactionData && typeof question.interactionData === "object" && !Array.isArray(question.interactionData)
    ? question.interactionData as Record<string, unknown>
    : {};
}

function interactionList(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function matchingData(question: Question) {
  const data = interactionRecord(question);
  return {
    left: interactionList(data.matchingLeft),
    right: interactionList(data.matchingRight),
  };
}

function orderingItems(question: Question) {
  return interactionList(interactionRecord(question).orderingItems);
}

function matchingAnswers(value: string) {
  if (!value.trim()) return {} as Record<string, string>;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      return Object.fromEntries(Object.entries(parsed).map(([key, item]) => [key, String(item)]));
  } catch {}
  return {} as Record<string, string>;
}

function MatchingInteraction({
  question,
  answer,
  disabled,
  onChange,
  compact = false,
}: {
  question: Question;
  answer: string;
  disabled: boolean;
  onChange: (answer: string) => void;
  compact?: boolean;
}) {
  const { left, right } = matchingData(question);
  const assigned = matchingAnswers(answer);
  const [selected, setSelected] = useState<string | null>(null);
  const assign = (index: number, item: string) => {
    if (disabled) return;
    const next = Object.fromEntries(
      Object.entries(assigned).filter(([key, value]) => key === String(index) || value !== item),
    );
    next[String(index)] = item;
    onChange(JSON.stringify(next));
    setSelected(null);
  };
  const clear = (index: number) => {
    const next = { ...assigned };
    delete next[String(index)];
    onChange(Object.keys(next).length ? JSON.stringify(next) : "");
  };
  return (
    <div className={`${compact ? "mt-3" : "mt-5"}`}>
      <p className="text-xs leading-5 text-slate-500">
        Kéo một mục ở ngân hàng đáp án vào ô tương ứng, hoặc chạm đáp án rồi chạm ô cần nối.
      </p>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Ngân hàng đáp án">
        {right.map((item, index) => {
          const used = Object.values(assigned).includes(item);
          return (
            <button
              key={`${index}-${item}`}
              type="button"
              draggable={!disabled}
              disabled={disabled}
              aria-pressed={selected === item}
              onDragStart={(event) => event.dataTransfer.setData("text/plain", item)}
              onClick={() => setSelected(selected === item ? null : item)}
              className={`min-h-10 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#123d68] ${selected === item ? "border-[#123d68] bg-[#123d68] text-white" : used ? "border-slate-200 bg-slate-100 text-slate-500" : "border-slate-300 bg-white text-[#17324d] hover:border-[#123d68]"}`}
            >
              <span className="mr-2 text-xs opacity-70">{String.fromCharCode(65 + index)}</span>{item}
            </button>
          );
        })}
      </div>
      <div className="mt-4 space-y-2">
        {left.map((item, index) => (
          <div key={`${index}-${item}`} className="grid items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,.9fr)]">
            <div className="rounded-lg bg-slate-50 px-3 py-3 text-sm font-semibold leading-6 text-[#172b3e]">
              {index + 1}. {item}
            </div>
            <button
              type="button"
              disabled={disabled}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const itemValue = event.dataTransfer.getData("text/plain");
                if (itemValue) assign(index, itemValue);
              }}
              onClick={() => selected ? assign(index, selected) : assigned[String(index)] && clear(index)}
              className={`min-h-12 rounded-lg border border-dashed px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#123d68] ${assigned[String(index)] ? "border-[#123d68] bg-[#edf3f8] font-semibold text-[#092b4c]" : selected ? "border-[#123d68] bg-white text-[#123d68]" : "border-slate-300 bg-white text-slate-400"}`}
              aria-label={assigned[String(index)] ? `Mục ${index + 1} đã nối với ${assigned[String(index)]}. Nhấn để bỏ nối.` : `Chọn đáp án cho mục ${index + 1}`}
            >
              {assigned[String(index)] || (selected ? "Chạm để đặt đáp án đã chọn" : "Thả hoặc chọn đáp án")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderingInteraction({
  question,
  answer,
  disabled,
  onChange,
  compact = false,
}: {
  question: Question;
  answer: string;
  disabled: boolean;
  onChange: (answer: string) => void;
  compact?: boolean;
}) {
  const initial = orderingItems(question);
  let parsed: string[] = [];
  try {
    const value = JSON.parse(answer || "[]");
    if (Array.isArray(value)) parsed = value.map(String);
  } catch {}
  const items = parsed.length === initial.length ? parsed : initial;
  const commit = (next: string[]) => onChange(JSON.stringify(next));
  const move = (from: number, to: number) => {
    if (disabled || from === to || to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commit(next);
  };
  return (
    <div className={`${compact ? "mt-3" : "mt-5"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs leading-5 text-slate-500">Kéo các mục hoặc dùng nút lên/xuống để tạo đúng thứ tự.</p>
        {!answer && !disabled && (
          <button type="button" onClick={() => commit(items)} className="text-xs font-bold text-[#123d68] underline underline-offset-4">
            Giữ thứ tự hiện tại
          </button>
        )}
      </div>
      <ol className="mt-3 space-y-2">
        {items.map((item, index) => (
          <li
            key={`${index}-${item}`}
            draggable={!disabled}
            onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              move(Number(event.dataTransfer.getData("text/plain")), index);
            }}
            className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
          >
            <GripVertical size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#edf3f8] text-xs font-extrabold text-[#123d68]">{index + 1}</span>
            <span className="min-w-0 flex-1 text-sm font-semibold leading-6 text-[#172b3e]">{item}</span>
            {!disabled && (
              <span className="flex shrink-0 gap-1">
                <button type="button" onClick={() => move(index, index - 1)} disabled={index === 0} className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-25" aria-label={`Đưa mục ${index + 1} lên`}><ChevronUp size={17} /></button>
                <button type="button" onClick={() => move(index, index + 1)} disabled={index === items.length - 1} className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-25" aria-label={`Đưa mục ${index + 1} xuống`}><ChevronDown size={17} /></button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {!answer && <p className="mt-2 text-xs font-semibold text-amber-700">Chưa ghi nhận câu trả lời.</p>}
    </div>
  );
}

function CompletionScreen({
  exam,
  attempt,
  answers,
  result,
  teacherFeedback,
  onDetails,
  onRestart,
}: {
  exam: Exam;
  attempt: Attempt;
  answers: Record<string, string>;
  result: Result;
  teacherFeedback?: string;
  onDetails: () => void;
  onRestart: () => void;
}) {
  const totalEarned = result.earned + result.manualEarned;
  const totalPossible = result.possible + result.manualPossible;
  const answered = Object.values(answers).filter((value) =>
    value.trim(),
  ).length;
  return (
    <div
      className="soft-card mx-auto mt-6 max-w-4xl overflow-hidden"
      role="status"
    >
      <div className="bg-gradient-to-br from-[#e9fbf4] to-white px-6 py-9 text-center md:px-10">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-200">
          <CheckCircle2 size={34} />
        </div>
        <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-700">
          Đã ghi nhận bài làm
        </p>
        <h2 className="mt-2 text-3xl font-extrabold text-[#092b4c]">
          Hoàn thành bài luyện
        </h2>
        <p className="mt-2 text-sm font-bold text-[#123d68]">{exam.title}</p>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
          Bài làm của <strong>{attempt.participantName || "học viên"}</strong>{" "}
          đã được lưu thành công. Bạn có thể xem chi tiết từng câu hoặc bắt đầu
          một lượt làm mới.
        </p>
      </div>

      <div className="grid gap-3 border-y border-slate-100 p-5 sm:grid-cols-3 md:p-6">
        <ResultStat
          label="Đã trả lời"
          value={`${answered}/${exam.questions.length}`}
        />
        <ResultStat
          label={result.pending ? "Điểm tự động" : "Tổng điểm"}
          value={
            result.pending
              ? result.possible > 0
                ? `${result.earned}/${result.possible}`
                : "Chờ chấm"
              : `${totalEarned}/${totalPossible}`
          }
        />
        <ResultStat
          label="Trạng thái"
          value={
            result.pending ? `${result.pending} câu chờ chấm` : "Đã chấm xong"
          }
        />
      </div>

      <div className="p-5 md:p-6">
        {result.pending > 0 && (
          <p className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <strong>Điểm trên mới là phần chấm tự động.</strong> Có{" "}
            {result.pending} câu chưa có đáp án hoặc cần giáo viên chấm tay, vì
            vậy chưa có điểm cuối cùng.
          </p>
        )}
        {teacherFeedback && (
          <p className="mt-3 rounded-xl bg-[#edf3f8] p-4 text-sm text-[#123d68]">
            <strong>Nhận xét giáo viên:</strong> {teacherFeedback}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          <button type="button" onClick={onDetails} className="btn-primary">
            <Eye size={17} /> Xem chi tiết bài làm
          </button>
          <button type="button" onClick={onRestart} className="btn-outline">
            <RotateCcw size={17} /> Làm lại đề
          </button>
          <Link href="/luyen-de" className="btn-outline">
            <ArrowLeft size={17} /> Quay lại các bài luyện
          </Link>
        </div>
      </div>
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f5f7fa] p-4 text-center">
      <strong className="block text-lg text-[#092b4c]">{value}</strong>
      <span className="mt-1 block text-xs text-slate-500">{label}</span>
    </div>
  );
}

function questionOptions(question: Question) {
  return Array.isArray(question.options) ? question.options.map(String) : [];
}

function choiceLetter(value: string) {
  return value
    .trim()
    .match(/^([A-H])(?:[.)]|\s|$)/i)?.[1]
    ?.toUpperCase();
}

function choiceValue(option: string) {
  return choiceLetter(option) || option.trim();
}

function multipleAnswers(value: string) {
  if (!value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {}
  return value.split(/[,;|]+/).map((item) => item.trim()).filter(Boolean);
}

function answerText(question: Question, answer: string) {
  const normalized = answer.trim();
  if (question.taskType === "MATCHING") {
    const assigned = matchingAnswers(answer);
    const { left } = matchingData(question);
    if (!Object.keys(assigned).length) return "Chưa trả lời";
    return left.map((item, index) => `${item} → ${assigned[String(index)] || "—"}`).join("; ");
  }
  if (question.taskType === "ORDERING") {
    try {
      const parsed = JSON.parse(answer);
      if (Array.isArray(parsed) && parsed.length) return parsed.map(String).join(" → ");
    } catch {}
    return "Chưa trả lời";
  }
  if (question.kind === "MULTIPLE_CHOICE") {
    const selected = multipleAnswers(answer);
    if (!selected.length) return "Chưa trả lời";
    return selected
      .map((value) => questionOptions(question).find((option) => choiceValue(option) === value) || value)
      .join("; ");
  }
  const answerLetter = choiceLetter(normalized);
  return (
    questionOptions(question).find(
      (option) =>
        option.trim().toLocaleLowerCase() === normalized.toLocaleLowerCase() ||
        (!!answerLetter && choiceLetter(option) === answerLetter),
    ) ||
    answer ||
    "Chưa trả lời"
  );
}

function AttemptDetailModal({
  open,
  exam,
  answers,
  result,
  onClose,
}: {
  open: boolean;
  exam: Exam;
  answers: Record<string, string>;
  result: Result;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      title="Chi tiết bài làm"
      description={`${exam.title} · ${exam.questions.length} câu hỏi`}
      onClose={onClose}
      size="xl"
    >
      <div className="space-y-3">
        {exam.questions.map((question) => {
          const detail = result.details.find(
            (item) => item.position === question.position,
          );
          const response = answers[question.position] || "";
          return (
            <article
              key={question.position}
              className="rounded-xl border border-slate-200 p-4 md:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <strong className="text-sm text-[#092b4c]">
                    Câu {question.position}
                  </strong>
                  <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-[#172b3e]">
                    {question.content || `Câu ${question.position}`}
                  </p>
                  {questionOptions(question).length > 0 && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {questionOptions(question).map((option) => {
                        const value = choiceValue(option);
                        const chosen = question.kind === "MULTIPLE_CHOICE"
                          ? multipleAnswers(response).includes(value)
                          : choiceValue(response) === value;
                        const correct = question.kind === "MULTIPLE_CHOICE"
                          ? multipleAnswers(detail?.correctAnswer || "").includes(value)
                          : choiceValue(detail?.correctAnswer || "") === value;
                        return (
                          <div
                            key={option}
                            className={`rounded-lg border px-3 py-2 text-xs leading-5 ${chosen ? "border-[#123d68] bg-[#edf3f8] font-bold text-[#092b4c]" : correct ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-500"}`}
                          >
                            {option}
                            {chosen && (
                              <span className="ml-2 text-[11px] uppercase">
                                Bạn chọn
                              </span>
                            )}
                            {correct && (
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
                    <strong>Bài làm:</strong> {answerText(question, response)}
                  </p>
                </div>
                <ResultBadge detail={detail} />
              </div>
            </article>
          );
        })}
      </div>
    </Modal>
  );
}

function ResultBadge({
  detail,
}: {
  detail:
    | { status: string; correctAnswer?: string; score?: number }
    | undefined;
}) {
  if (!detail) return null;
  const styles =
    detail.status === "CORRECT" || detail.status === "MANUALLY_GRADED"
      ? "bg-emerald-50 text-emerald-700"
      : detail.status === "PENDING"
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-700";
  const label =
    detail.status === "CORRECT"
      ? "Đúng"
      : detail.status === "MANUALLY_GRADED"
        ? `${detail.score} điểm`
        : detail.status === "PENDING"
          ? "Chờ giáo viên chấm"
          : "Chưa đúng";
  return (
    <span
      className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${styles}`}
    >
      {label}
    </span>
  );
}

function SubmissionReview({
  open,
  exam,
  answers,
  webQuestions,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  exam: Exam;
  answers: Record<string, string>;
  webQuestions: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const completed = exam.questions.filter((question) =>
    answers[question.position]?.trim(),
  );
  const missing = exam.questions.filter(
    (question) => !answers[question.position]?.trim(),
  );
  return (
    <Modal
      open={open}
      title="Rà soát trước khi nộp bài"
      description={`Bạn đã hoàn thành ${completed.length}/${exam.questions.length} câu.`}
      onClose={onClose}
      size="lg"
    >
      <div
        className={`rounded-xl p-4 text-sm leading-6 ${missing.length ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}
      >
        <strong className="flex items-center gap-2">
          <ListChecks size={18} />
          {missing.length
            ? `Còn ${missing.length} câu chưa trả lời`
            : "Bạn đã trả lời đầy đủ tất cả câu hỏi"}
        </strong>
        {missing.length > 0 && (
          <p className="mt-1">
            Bạn vẫn có thể nộp bài, nhưng nên kiểm tra lại các câu màu vàng
            trước khi xác nhận.
          </p>
        )}
      </div>
      <div className="mt-5 space-y-2">
        {exam.questions.map((question) => {
          const done = !!answers[question.position]?.trim();
          const content = (
            <div className="flex min-w-0 flex-1 items-start gap-3 text-left">
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-lg text-xs font-extrabold ${done ? "bg-emerald-600 text-white" : "bg-amber-200 text-amber-900"}`}
              >
                {question.position}
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-xs font-semibold leading-5 text-[#172b3e]">
                  {question.content || `Câu ${question.position}`}
                </p>
                <p
                  className={`mt-1 text-xs ${done ? "text-emerald-700" : "text-amber-700"}`}
                >
                  <strong>{done ? "Đã trả lời:" : "Chưa trả lời"}</strong>{" "}
                  {done
                    ? answerText(question, answers[question.position] || "")
                    : ""}
                </p>
              </div>
              {webQuestions && (
                <span className="shrink-0 text-[11px] font-bold text-[#123d68]">
                  Xem câu
                </span>
              )}
            </div>
          );
          const className = `flex w-full items-start rounded-xl border p-3 ${done ? "border-emerald-200 bg-emerald-50/50" : "border-amber-300 bg-amber-50"}`;
          return webQuestions ? (
            <button
              type="button"
              key={question.position}
              className={className}
              onClick={() => {
                onClose();
                window.setTimeout(() => {
                  document
                    .getElementById(`question-${question.position}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 50);
              }}
            >
              {content}
            </button>
          ) : (
            <div key={question.position} className={className}>
              {content}
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-outline">
          {missing.length ? "Quay lại làm tiếp" : "Kiểm tra lại"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="btn-primary"
        >
          {busy
            ? "Đang nộp bài..."
            : `Hoàn thành và nộp bài (${completed.length}/${exam.questions.length})`}
        </button>
      </div>
    </Modal>
  );
}

function PdfAnswerSheet({
  exam,
  answers,
  setAnswers,
  result,
  busy,
  onReview,
}: {
  exam: Exam;
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  result: Result | null;
  busy: boolean;
  onReview: () => void;
}) {
  return (
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="soft-card overflow-hidden">
        <div className="border-b border-slate-100 p-4 text-sm font-bold text-[#092b4c]">
          Tệp đề gốc — nội dung chưa được chuyển thành câu hỏi web
        </div>
        {(exam.source?.mimeType || "application/pdf") === "application/pdf" || exam.source?.mimeType.startsWith("image/") ? (
          <iframe
            src={`${api}/public-content/exams/${exam.id}/file`}
            title={`Đề ${exam.title}`}
            className="h-[75vh] min-h-[600px] w-full"
          />
        ) : (
          <div className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <FileText className="mx-auto text-[#123d68]" size={36} />
              <p className="mt-3 text-sm text-slate-600">Tệp Word/Excel được mở bằng ứng dụng trên thiết bị.</p>
              <a href={`${api}/public-content/exams/${exam.id}/file`} className="btn-outline mt-4">Tải tệp nguồn</a>
            </div>
          </div>
        )}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onReview();
        }}
        className="soft-card p-5 lg:sticky lg:top-24"
      >
        <h2 className="text-lg font-extrabold text-[#092b4c]">Phiếu trả lời</h2>
        <div className="mt-5 max-h-[55vh] space-y-3 overflow-y-auto pr-2">
          {exam.questions.map((question) => (
            <div
              key={question.position}
              className="block rounded-xl border border-slate-200 p-3 text-sm font-semibold"
            >
              <span className="mb-2 block">Câu {question.position}</span>
              {question.taskType === "MATCHING" && matchingData(question).left.length > 1 ? (
                <MatchingInteraction
                  compact
                  question={question}
                  answer={answers[question.position] || ""}
                  disabled={!!result}
                  onChange={(answer) => setAnswers((current) => ({ ...current, [question.position]: answer }))}
                />
              ) : question.taskType === "ORDERING" && orderingItems(question).length > 1 ? (
                <OrderingInteraction
                  compact
                  question={question}
                  answer={answers[question.position] || ""}
                  disabled={!!result}
                  onChange={(answer) => setAnswers((current) => ({ ...current, [question.position]: answer }))}
                />
              ) : question.kind === "SINGLE_CHOICE" || question.kind === "TRUE_FALSE" ? (
                <select
                  disabled={!!result}
                  value={answers[question.position] || ""}
                  onChange={(event) =>
                    setAnswers((value) => ({
                      ...value,
                      [question.position]: event.target.value,
                    }))
                  }
                  className="field-control p-2"
                >
                  <option value="">Chưa chọn</option>
                  {questionOptions(question).map((option) => (
                    <option key={option} value={choiceValue(option)}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : question.kind === "MULTIPLE_CHOICE" ? (
                <div className="space-y-2">
                  {questionOptions(question).map((option) => {
                    const value = choiceValue(option);
                    const selected = multipleAnswers(answers[question.position] || "").includes(value);
                    return (
                      <label key={option} className="flex items-start gap-2 text-xs font-medium">
                        <input
                          type="checkbox"
                          disabled={!!result}
                          checked={selected}
                          onChange={() => setAnswers((current) => {
                            const previous = multipleAnswers(current[question.position] || "");
                            const next = selected ? previous.filter((item) => item !== value) : [...previous, value];
                            return { ...current, [question.position]: JSON.stringify(next.sort()) };
                          })}
                          className="mt-0.5 accent-[#d91f2a]"
                        />
                        <span>{option}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  disabled={!!result}
                  value={answers[question.position] || ""}
                  onChange={(event) =>
                    setAnswers((value) => ({
                      ...value,
                      [question.position]: event.target.value,
                    }))
                  }
                  className="field-control min-h-16 p-2"
                />
              )}
            </div>
          ))}
        </div>
        {!result && (
          <button disabled={busy} className="btn-primary mt-5 w-full">
            {busy ? "Đang chấm..." : "Nộp bài và xem kết quả"}
          </button>
        )}
      </form>
    </div>
  );
}
