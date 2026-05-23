"use client";

import { useState } from "react";
import type { OutputType, RoleType } from "@/lib/types";

type TransformResult = {
  title: string;
  content: string;
  provider?: string;
};

const outputs: Array<{ type: OutputType; label: string }> = [
  { type: "report_summary", label: "보고용 요약" },
  { type: "training_intro", label: "연수 도입부" },
  { type: "lesson_idea", label: "수업 아이디어" },
  { type: "parent_notice", label: "학부모 안내문" },
  { type: "checklist", label: "체크리스트" },
];

export default function TransformButtons({ newsIds, roleType }: { newsIds: string[]; roleType: RoleType }) {
  const [loadingType, setLoadingType] = useState<OutputType | null>(null);
  const [result, setResult] = useState<TransformResult | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copyResult() {
    if (!result) {
      return;
    }

    await navigator.clipboard.writeText(`${result.title}\n\n${result.content}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function exportResult() {
    if (!result) {
      return;
    }

    const blob = new Blob([`${result.title}\n\n${result.content}`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${result.title.replace(/[^\p{L}\p{N}]+/gu, "-")}-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleTransform(outputType: OutputType) {
    setLoadingType(outputType);
    setError(null);

    try {
      const response = await fetch("/api/transform", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          outputType,
          newsIds,
          roleType,
        }),
      });
      const body = (await response.json()) as TransformResult & { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? "산출물을 생성하지 못했습니다.");
      }

      setResult(body);
      setResultOpen(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "산출물을 생성하지 못했습니다.");
    } finally {
      setLoadingType(null);
    }
  }

  return (
    <section className="grid min-w-0 gap-3 border-t border-stone-200 pt-4">
      <div>
        <p className="text-xs font-bold text-emerald-800">TRANSFORM</p>
        <h3 className="mt-1 text-base font-black text-stone-950">업무 산출물로 변환</h3>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {outputs.map((output) => (
          <button
            className="min-h-10 rounded-md border border-stone-200 bg-white px-2.5 py-2 text-xs font-bold leading-5 text-stone-700 transition hover:border-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={Boolean(loadingType)}
            key={output.type}
            onClick={() => handleTransform(output.type)}
            type="button"
          >
            {loadingType === output.type ? "생성 중..." : output.label}
          </button>
        ))}
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

      {result ? (
        <button
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-sm font-bold text-emerald-900 transition hover:border-emerald-700"
          onClick={() => setResultOpen(true)}
          type="button"
        >
          {result.title} 열기
        </button>
      ) : null}

      {result && resultOpen ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-stone-950/45 p-4">
          <section
            aria-labelledby="transform-result-title"
            className="grid max-h-[92vh] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg bg-white shadow-2xl"
            role="dialog"
          >
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 p-5">
              <div>
                <p className="text-xs font-bold text-emerald-800">GENERATED OUTPUT</p>
                <h4 className="mt-1 text-xl font-black text-stone-950" id="transform-result-title">
                  {result.title}
                </h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {result.provider ? (
                  <span className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
                    {result.provider}
                  </span>
                ) : null}
                <button
                  className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-bold text-stone-700 transition hover:border-emerald-700 hover:text-emerald-800"
                  onClick={copyResult}
                  type="button"
                >
                  {copied ? "복사됨" : "복사"}
                </button>
                <button
                  className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-bold text-stone-700 transition hover:border-emerald-700 hover:text-emerald-800"
                  onClick={exportResult}
                  type="button"
                >
                  내보내기
                </button>
                <button
                  className="rounded-md bg-stone-900 px-3 py-2 text-sm font-bold text-white transition hover:bg-stone-700"
                  onClick={() => setResultOpen(false)}
                  type="button"
                >
                  닫기
                </button>
              </div>
            </header>

            <div className="min-h-0 overflow-y-auto p-5">
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-4 whitespace-pre-wrap text-sm leading-7 text-stone-700 [overflow-wrap:anywhere]">
                {result.content}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
