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
  const [error, setError] = useState<string | null>(null);

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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "산출물을 생성하지 못했습니다.");
    } finally {
      setLoadingType(null);
    }
  }

  return (
    <section className="grid gap-3 border-t border-stone-200 pt-4">
      <div>
        <p className="text-xs font-bold text-emerald-800">TRANSFORM</p>
        <h3 className="mt-1 text-base font-black text-stone-950">업무 산출물로 변환</h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {outputs.map((output) => (
          <button
            className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-bold text-stone-700 transition hover:border-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
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
        <article className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h4 className="text-base font-black text-stone-950">{result.title}</h4>
            {result.provider ? (
              <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-emerald-800">{result.provider}</span>
            ) : null}
          </div>
          <div className="whitespace-pre-wrap text-sm leading-7 text-stone-700">{result.content}</div>
        </article>
      ) : null}
    </section>
  );
}
