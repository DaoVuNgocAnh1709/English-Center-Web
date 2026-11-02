export default function GlobalLoading() {
  return (
    <div
      className="min-h-[65vh] bg-[#f3f6fa]"
      aria-busy="true"
      aria-label="Đang tải nội dung trang"
    >
      <div className="bg-[#0b2f53] py-14 md:py-20">
        <div className="container-shell">
          <div className="h-3.5 w-32 animate-pulse rounded bg-white/15" />
          <div className="mt-5 h-10 w-full max-w-lg animate-pulse rounded-lg bg-white/20" />
          <div className="mt-4 h-4 w-full max-w-md animate-pulse rounded bg-white/15" />
        </div>
      </div>
      <div className="container-shell py-12">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-52 animate-pulse rounded-[14px] border border-slate-200/80 bg-white p-6"
            >
              <div className="h-4 w-24 rounded bg-slate-100" />
              <div className="mt-4 h-6 w-3/4 rounded bg-slate-200/70" />
              <div className="mt-3 h-4 w-full rounded bg-slate-100" />
              <div className="mt-2 h-4 w-2/3 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
