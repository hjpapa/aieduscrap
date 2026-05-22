import Link from "next/link";
import { newsCategories, normalizeCategory } from "@/lib/categories";
import { getKstDayRange } from "@/lib/date";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { DailyBriefing, EducationNews, Importance, NewsCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

const importanceLabel: Record<Importance, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

const importanceRank: Record<Importance, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function formatBriefingDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "full",
    timeZone: "Asia/Seoul",
  }).format(new Date(`${value}T00:00:00+09:00`));
}

function sortNews(a: EducationNews, b: EducationNews) {
  const aImportance = a.importance ? importanceRank[a.importance] : 0;
  const bImportance = b.importance ? importanceRank[b.importance] : 0;

  if (aImportance !== bImportance) {
    return bImportance - aImportance;
  }

  return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
}

async function getTodayBriefing() {
  const supabase = getSupabaseAdmin();
  const { date, start, end } = getKstDayRange();

  const [{ data: briefing }, { data: news }] = await Promise.all([
    supabase.from("daily_briefings").select("*").eq("briefing_date", date).maybeSingle(),
    supabase
      .from("education_news")
      .select("*")
      .gte("published_at", start)
      .lt("published_at", end)
      .order("published_at", { ascending: false })
      .limit(50),
  ]);

  return {
    date,
    briefing: briefing as DailyBriefing | null,
    news: ((news ?? []) as EducationNews[]).sort(sortNews),
  };
}

function CategoryFilter({
  activeCategory,
  counts,
}: {
  activeCategory: NewsCategory | "전체";
  counts: Map<NewsCategory, number>;
}) {
  const filters: Array<NewsCategory | "전체"> = ["전체", ...newsCategories];

  return (
    <nav aria-label="뉴스 카테고리 필터" className="flex gap-2 overflow-x-auto pb-1">
      {filters.map((category) => {
        const active = activeCategory === category;
        const href = category === "전체" ? "/#news-list" : `/?category=${encodeURIComponent(category)}#news-list`;
        const count =
          category === "전체"
            ? Array.from(counts.values()).reduce((sum, value) => sum + value, 0)
            : counts.get(category) ?? 0;

        return (
          <Link
            className={[
              "whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition",
              active
                ? "border-emerald-800 bg-emerald-800 text-white"
                : "border-stone-200 bg-white text-stone-600 hover:border-emerald-700 hover:text-emerald-800",
            ].join(" ")}
            href={href}
            key={category}
          >
            {category}
            <span className={active ? "ml-2 text-emerald-100" : "ml-2 text-stone-400"}>{count}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function TodayBriefingCard({
  briefing,
  briefingDate,
  majorNews,
}: {
  briefing: DailyBriefing | null;
  briefingDate: string;
  majorNews: EducationNews[];
}) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-emerald-800">TODAY BRIEFING</p>
          <h2 className="mt-1 text-2xl font-black text-stone-950">
            {briefing?.title ?? `${briefingDate} 교육 뉴스 브리핑`}
          </h2>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
          주요 뉴스 {majorNews.length}건
        </span>
      </div>

      {majorNews.length > 0 ? (
        <div className="grid gap-3">
          {majorNews.map((item, index) => (
            <article className="rounded-lg border border-stone-100 bg-stone-50/70 p-4" key={item.id}>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-stone-500">
                <span className="rounded-full bg-white px-2.5 py-1 text-emerald-800">{index + 1}</span>
                <span>{normalizeCategory(item.category)}</span>
                <span>·</span>
                <span>{item.source}</span>
                <span>·</span>
                <time dateTime={item.published_at}>{formatDate(item.published_at)}</time>
              </div>

              <h3 className="text-lg font-black leading-snug text-stone-950">{item.title}</h3>

              <div className="mt-3 grid gap-2 text-sm leading-6 text-stone-700">
                <div>
                  <span className="font-bold text-emerald-800">사실요약: </span>
                  <span>{item.summary ?? "아직 요약이 생성되지 않았습니다."}</span>
                </div>
                <div>
                  <span className="font-bold text-emerald-800">교사관점: </span>
                  <span>{item.teacher_insight ?? "아직 교사 관점 통찰이 생성되지 않았습니다."}</span>
                </div>
              </div>

              <a
                className="mt-3 inline-flex w-fit rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-bold text-emerald-800 transition hover:border-emerald-700 hover:bg-emerald-50"
                href={item.url}
                rel="noreferrer"
                target="_blank"
              >
                원문 보기
              </a>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-stone-300 bg-white/70 p-5 text-sm leading-6 text-stone-500">
          아직 오늘 생성된 주요 브리핑이 없습니다. `/api/collect-news` 실행 후 `/api/generate-briefing`을 호출하면 이곳에
          표시됩니다.
        </div>
      )}
    </section>
  );
}

function NewsCard({ item, featured = false }: { item: EducationNews; featured?: boolean }) {
  const category = normalizeCategory(item.category);
  const importance = item.importance ?? "medium";

  return (
    <article
      className={[
        "grid gap-4 rounded-lg border bg-white p-5 shadow-sm",
        featured ? "border-emerald-200 ring-1 ring-emerald-100" : "border-stone-200",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">{category}</span>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">중요도 {importanceLabel[importance]}</span>
        <span className="text-stone-400">{item.source}</span>
        <span className="text-stone-300">·</span>
        <time className="text-stone-400" dateTime={item.published_at}>
          {formatDate(item.published_at)}
        </time>
      </div>

      <h3 className={featured ? "text-xl font-bold leading-snug text-stone-950" : "text-lg font-bold leading-snug text-stone-950"}>
        {item.title}
      </h3>

      <div className="grid gap-3 text-sm leading-6 text-stone-700">
        <section className="grid gap-1">
          <h4 className="text-xs font-bold text-emerald-800">사실 요약</h4>
          <p>{item.summary ?? "아직 요약이 생성되지 않았습니다."}</p>
        </section>
        <section className="grid gap-1">
          <h4 className="text-xs font-bold text-emerald-800">초등교사 관점 통찰</h4>
          <p>{item.teacher_insight ?? "아직 교사 관점 통찰이 생성되지 않았습니다."}</p>
        </section>
        <section className="grid gap-1">
          <h4 className="text-xs font-bold text-emerald-800">학교 적용 아이디어</h4>
          <p>{item.school_action ?? "아직 학교 적용 아이디어가 생성되지 않았습니다."}</p>
        </section>
      </div>

      <a
        className="w-fit rounded-md border border-stone-200 px-3 py-2 text-sm font-bold text-emerald-800 transition hover:border-emerald-700 hover:bg-emerald-50"
        href={item.url}
        rel="noreferrer"
        target="_blank"
      >
        원문 보기
      </a>
    </article>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const selectedCategory = params.category ? normalizeCategory(decodeURIComponent(params.category)) : "전체";
  let briefing: DailyBriefing | null = null;
  let news: EducationNews[] = [];
  let briefingDate = getKstDayRange().date;
  let error: string | null = null;

  try {
    const result = await getTodayBriefing();
    briefingDate = result.date;
    briefing = result.briefing;
    news = result.news;
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "뉴스 브리핑을 불러오지 못했습니다.";
  }

  const counts = new Map<NewsCategory, number>(newsCategories.map((category) => [category, 0]));
  for (const item of news) {
    const category = normalizeCategory(item.category);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  const filteredNews =
    selectedCategory === "전체" ? news : news.filter((item) => normalizeCategory(item.category) === selectedCategory);
  const topNews = filteredNews.filter((item) => item.importance === "high").slice(0, 5);
  const remainingNews = filteredNews.filter((item) => !topNews.some((topItem) => topItem.id === item.id));
  const majorNews = news
    .filter((item) => item.summary || item.teacher_insight)
    .slice(0, 5);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 grid gap-4 border-b border-stone-200 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-emerald-800">초등교사 개인 브리핑</p>
            <h1 className="mt-1 text-3xl font-black tracking-normal text-stone-950 sm:text-4xl">
              오늘의 교육 뉴스
            </h1>
          </div>
          <time className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-600">
            {formatBriefingDate(briefingDate)}
          </time>
        </div>
        <p className="max-w-3xl text-base leading-7 text-stone-600">
          수업 전 10분 안에 훑어볼 수 있도록 중요한 뉴스, 사실 요약, 교사 관점, 학교 적용 아이디어를 분리했습니다.
        </p>
      </header>

      {error ? (
        <section className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-800">
          환경변수 또는 Supabase 연결을 확인해주세요. {error}
        </section>
      ) : null}

      {!error ? (
        <div className="grid gap-6">
          <TodayBriefingCard briefing={briefing} briefingDate={briefingDate} majorNews={majorNews} />

          <section className="sticky top-0 z-10 -mx-4 grid scroll-mt-4 gap-3 border-y border-stone-200 bg-[#f6f4ee]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8" id="news-list">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-emerald-800">CATEGORY</p>
                <h2 className="mt-1 text-xl font-black text-stone-950">카테고리별로 빠르게 보기</h2>
              </div>
            </div>
            <CategoryFilter activeCategory={selectedCategory} counts={counts} />
          </section>

          <section className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-emerald-800">TOP PRIORITY</p>
                <h2 className="mt-1 text-xl font-black text-stone-950">중요도 높은 뉴스 5개</h2>
              </div>
              <span className="text-sm font-semibold text-stone-500">{topNews.length}건</span>
            </div>
            {topNews.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {topNews.map((item) => (
                  <NewsCard featured item={item} key={item.id} />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-stone-300 bg-white/70 p-5 text-sm text-stone-500">
                선택한 카테고리에 중요도 높은 뉴스가 아직 없습니다.
              </div>
            )}
          </section>

          <section className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-emerald-800">ALL NEWS</p>
                <h2 className="mt-1 text-xl font-black text-stone-950">오늘 수집된 뉴스</h2>
              </div>
              <span className="text-sm font-semibold text-stone-500">{remainingNews.length}건</span>
            </div>
            {remainingNews.length > 0 ? (
              <div className="grid gap-4">
                {remainingNews.map((item) => (
                  <NewsCard item={item} key={item.id} />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-stone-300 bg-white/70 p-5 text-sm text-stone-500">
                표시할 추가 뉴스가 없습니다.
              </div>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}
