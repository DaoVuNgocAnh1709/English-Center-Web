"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  ExternalLink,
  FileText,
} from "lucide-react";
import { gradeLabel } from "@/lib/content-options";
import { safeExternalUrl } from "@/lib/safe-url";

type Material = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  schoolLevel: string | null;
  grade: number | null;
  type: string;
  fileName: string | null;
  mimeType: string | null;
  driveUrl: string | null;
  youtubeUrl: string | null;
  related?: Material[];
};

const api = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function MaterialPage() {
  const { slug } = useParams<{ slug: string }>();
  const [item, setItem] = useState<Material | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`${api}/public-content/materials/${encodeURIComponent(slug)}`)
      .then(async (detailResponse) => {
        if (!detailResponse.ok) throw new Error();
        const data = (await detailResponse.json()) as Material;
        if (!cancelled) {
          setItem(data);
          setError("");
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItem(null);
          setError("Không tìm thấy tài liệu.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const related = useMemo(() => item?.related || [], [item]);
  const driveUrl = safeExternalUrl(item?.driveUrl);
  const youtubeUrl = safeExternalUrl(item?.youtubeUrl);

  return (
    <section className="min-h-[70vh] bg-[#f3f6fa] py-7 md:py-9">
      <div className="container-shell">
        <Link
          href="/thu-vien"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#123d68]"
        >
          <ArrowLeft size={16} /> Thư viện
        </Link>
        {loading && !error && (
          <p className="mt-8 text-sm font-semibold text-slate-500">Đang tải tài liệu...</p>
        )}
        {error && <p className="mt-8 text-red-700">{error}</p>}
        {item && (
          <>
            <header className="surface-panel mt-5 p-5 md:p-7">
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                <div className="max-w-3xl">
                  <h1 className="text-2xl font-extrabold text-[#092b4c] md:text-3xl">
                    {item.title}
                  </h1>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {item.summary}
                  </p>
                  <p className="mt-4 text-xs font-bold text-[#d91f2a]">{item.category}{item.grade !== null ? ` · ${gradeLabel(item.grade)}` : ""}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {item.fileName && (
                    <a
                      href={`${api}/public-content/materials/${item.id}/file`}
                      className="btn-primary min-h-11 px-4"
                    >
                      <Download size={17} /> Tải tài liệu
                    </a>
                  )}
                  {driveUrl && (
                    <a
                      href={driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-outline min-h-11 px-4"
                    >
                      Google Drive <ExternalLink size={15} />
                    </a>
                  )}
                  {youtubeUrl && (
                    <a
                      href={youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-outline min-h-11 px-4"
                    >
                      Xem video <ExternalLink size={15} />
                    </a>
                  )}
                </div>
              </div>
            </header>

            <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
              <div className="surface-panel min-w-0 overflow-hidden">
                <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                  <FileText size={18} className="text-[#d91f2a]" />
                  <h2 className="font-extrabold text-[#092b4c]">
                    Xem tài liệu
                  </h2>
                </div>
                {item.fileName && item.mimeType === "application/pdf" ? (
                  <iframe
                    title={`Xem trước ${item.title}`}
                    src={`${api}/public-content/materials/${item.id}/preview`}
                    className="h-[calc(100vh-25rem)] min-h-[360px] max-h-[560px] w-full bg-slate-100"
                  />
                ) : (
                  <div className="grid min-h-[380px] place-items-center p-8 text-center">
                    <div>
                      <FileText className="mx-auto text-slate-300" size={44} />
                      <p className="mt-4 text-sm leading-6 text-slate-500">
                        Tài liệu này không có bản PDF xem trực tiếp. Hãy dùng
                        liên kết tải xuống, Google Drive hoặc video ở phía trên.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <aside className="surface-panel overflow-hidden lg:sticky lg:top-24">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="font-extrabold text-[#092b4c]">
                    Tài liệu liên quan
                  </h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {related.map((relatedItem) => (
                    <Link
                      key={relatedItem.id}
                      href={`/thu-vien/${relatedItem.slug}`}
                      className="group block p-5 transition-colors hover:bg-slate-50"
                    >
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#d91f2a]">
                        {relatedItem.category}
                        {relatedItem.grade !== null
                          ? ` · ${gradeLabel(relatedItem.grade)}`
                          : ""}
                      </p>
                      <h3 className="mt-2 text-sm font-extrabold leading-6 text-[#092b4c] group-hover:text-[#d91f2a]">
                        {relatedItem.title}
                      </h3>
                      <span className="mt-3 flex items-center gap-1 text-xs font-bold text-[#123d68]">
                        Xem tiếp <ArrowRight size={14} />
                      </span>
                    </Link>
                  ))}
                  {!related.length && (
                    <p className="p-5 text-sm leading-6 text-slate-500">
                      Chưa có tài liệu liên quan được xuất bản.
                    </p>
                  )}
                </div>
                <div className="border-t border-slate-100 p-4">
                  <Link href="/thu-vien" className="btn-outline w-full">
                    Xem toàn bộ thư viện
                  </Link>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
