"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Filter, RotateCcw, Search } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import {
  gradesForLevel,
  gradeLabel,
  materialCategories,
  materialTypes,
  schoolLevels,
} from "@/lib/content-options";

type Material = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  schoolLevel: string | null;
  grade: number | null;
  type: string;
};

const api = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function LibraryPage() {
  const [items, setItems] = useState<Material[]>([]);
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("");
  const [grade, setGrade] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${api}/public-content/materials`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setItems(await response.json());
      })
      .catch(() => setError("Chưa tải được thư viện tài liệu."));
  }, []);

  const categoryChoices = useMemo(
    () =>
      Array.from(
        new Set([...materialCategories, ...items.map((item) => item.category)]),
      ).filter(Boolean),
    [items],
  );
  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    return items.filter(
      (item) =>
        (!keyword ||
          `${item.title} ${item.summary} ${item.category}`
            .toLocaleLowerCase("vi")
            .includes(keyword)) &&
        (!level || item.schoolLevel === level) &&
        (!grade || item.grade === Number(grade)) &&
        (!category || item.category === category) &&
        (!type || item.type === type),
    );
  }, [items, search, level, grade, category, type]);
  const activeFilters = [search, level, grade, category, type].filter(
    Boolean,
  ).length;
  const reset = () => {
    setSearch("");
    setLevel("");
    setGrade("");
    setCategory("");
    setType("");
  };

  return (
    <>
      <PageHero
        kicker="Kho học liệu"
        title="Thư viện tài liệu dễ tìm, dễ tải"
        description="Lọc theo từ khóa, cấp học, lớp, danh mục và loại tài liệu. Nội dung chỉ hiển thị sau khi admin kiểm tra."
      />
      <section className="bg-[#f5f7fa] py-12 md:py-16">
        <div className="container-shell grid items-start gap-7 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="soft-card overflow-hidden lg:sticky lg:top-24">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="flex items-center gap-2 font-extrabold text-[#092b4c]">
                <Filter size={18} /> Bộ lọc
                {activeFilters > 0 && (
                  <span className="rounded-full bg-[#d91f2a] px-2 py-0.5 text-[11px] text-white">
                    {activeFilters}
                  </span>
                )}
              </h2>
              <button
                onClick={reset}
                className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-[#d91f2a]"
              >
                <RotateCcw size={13} /> Xóa lọc
              </button>
            </div>
            <div className="space-y-5 p-5">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">
                Tìm tài liệu
                <span className="relative mt-2 block">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="field-control py-3 pl-10 pr-3 text-sm font-medium normal-case tracking-normal"
                    placeholder="Tên hoặc nội dung..."
                  />
                </span>
              </label>
              <FilterSelect
                label="Cấp học"
                value={level}
                onChange={(value) => {
                  setLevel(value);
                  setGrade("");
                }}
                options={schoolLevels.map((item) => ({
                  value: item.value,
                  label: item.label,
                }))}
              />
              <FilterSelect
                label="Lớp"
                value={grade}
                onChange={setGrade}
                disabled={!level}
                options={gradesForLevel(level).map((item) => ({
                  value: String(item),
                  label: gradeLabel(item),
                }))}
              />
              <FilterSelect
                label="Danh mục"
                value={category}
                onChange={setCategory}
                options={categoryChoices.map((item) => ({
                  value: item,
                  label: item,
                }))}
              />
              <FilterSelect
                label="Loại tài liệu"
                value={type}
                onChange={setType}
                options={[...materialTypes]}
              />
            </div>
          </aside>

          <div className="min-w-0">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-extrabold text-[#092b4c]">
                  {filtered.length} tài liệu phù hợp
                </h2>
              </div>
              {activeFilters > 0 && (
                <p className="text-xs text-slate-500">
                  Đang áp dụng {activeFilters} điều kiện lọc
                </p>
              )}
            </div>
            {error && (
              <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
                {error}
              </p>
            )}
            <div className="grid gap-5 xl:grid-cols-2">
              {filtered.map((item) => (
                <article key={item.id} className="soft-card flex flex-col p-6">
                  <div className="flex flex-wrap gap-2 text-[11px] font-extrabold uppercase tracking-wider">
                    <span className="rounded-full bg-red-50 px-3 py-1 text-[#d91f2a]">
                      {item.category}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                      {item.grade !== null
                        ? gradeLabel(item.grade)
                        : typeLabel(item.type)}
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-extrabold text-[#092b4c]">
                    {item.title}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">
                    {item.summary}
                  </p>
                  <Link
                    className="btn-outline mt-5"
                    href={`/thu-vien/${item.slug}`}
                  >
                    Xem tài liệu →
                  </Link>
                </article>
              ))}
            </div>
            {!filtered.length && !error && (
              <div className="soft-card p-10 text-center">
                <h3 className="font-extrabold text-[#092b4c]">
                  Không có tài liệu phù hợp
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  Hãy bỏ bớt điều kiện hoặc thử một từ khóa khác.
                </p>
                <button onClick={reset} className="btn-outline mt-5">
                  Xóa toàn bộ bộ lọc
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="field-control mt-2 p-3 text-sm font-semibold normal-case tracking-normal disabled:bg-slate-100 disabled:text-slate-400"
      >
        <option value="">Tất cả</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function typeLabel(type: string) {
  return materialTypes.find((item) => item.value === type)?.label || type;
}
