"use client";

import { FormEvent, useMemo, useState } from "react";
import TransformButtons from "@/components/TransformButtons";
import type { AgentPeriod, NewsReference, RoleType } from "@/lib/types";

type AgentResponse = {
  answer: string;
  references: NewsReference[];
  provider?: string;
  saved?: boolean;
  error?: string;
};

const roles: Array<{ value: RoleType; label: string }> = [
  { value: "homeroom_teacher", label: "담임교사" },
  { value: "it_lead", label: "정보부장" },
  { value: "research_lead", label: "연구부장" },
  { value: "administrator", label: "관리자" },
  { value: "trainer", label: "연수 강사" },
];

const periods: Array<{ value: AgentPeriod; label: string }> = [
  { value: "today", label: "오늘" },
  { value: "3d", label: "최근 3일" },
  { value: "1w", label: "최근 1주일" },
  { value: "1m", label: "최근 1개월" },
];

const starterQuestions = [
  "오늘 뉴스 중 우리 학교가 바로 확인해야 할 내용은?",
  "초등 담임 입장에서 학부모 안내가 필요한 이슈를 정리해줘.",
  "AI교육 관련 뉴스를 연수 주제로 바꾸면 어떻게 시작하면 좋을까?",
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

export default function AgentChat() {
  const [message, setMessage] = useState("");
  const [roleType, setRoleType] = useState<RoleType>("homeroom_teacher");
  const [period, setPeriod] = useState<AgentPeriod>("today");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const referenceIds = useMemo(() => response?.references.map((item) => item.id) ?? [], [response]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim();

    if (!trimmed) {
      setError("질문을 입력해주세요.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          roleType,
          period,
        }),
      });
      const body = (await result.json()) as AgentResponse;

      if (!result.ok) {
        throw new Error(body.error ?? "답변을 생성하지 못했습니다.");
      }

      setResponse(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "답변을 생성하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-emerald-800">AGENT CHAT</p>
          <h2 className="mt-1 text-xl font-black text-stone-950">교육 뉴스에 질문하기</h2>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600">저장 뉴스 기반</span>
      </div>

      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm font-bold text-stone-700">
            분석 관점
            <select
              className="h-11 rounded-md border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-800 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => setRoleType(event.target.value as RoleType)}
              value={roleType}
            >
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-bold text-stone-700">
            검색 기간
            <select
              className="h-11 rounded-md border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-800 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => setPeriod(event.target.value as AgentPeriod)}
              value={period}
            >
              {periods.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="grid gap-2 text-sm font-bold text-stone-700">
          질문
          <textarea
            className="min-h-32 resize-y rounded-md border border-stone-200 bg-white p-3 text-sm leading-6 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
            onChange={(event) => setMessage(event.target.value)}
            placeholder="예: 최근 AI교육 뉴스 중 우리 학교가 준비해야 할 점을 담임교사 관점으로 정리해줘."
            value={message}
          />
        </label>

        <div className="grid gap-2">
          {starterQuestions.map((question) => (
            <button
              className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-left text-xs font-semibold leading-5 text-stone-600 transition hover:border-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
              key={question}
              onClick={() => setMessage(question)}
              type="button"
            >
              {question}
            </button>
          ))}
        </div>

        <div className="flex">
          <button
            className="w-full rounded-md bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading}
            type="submit"
          >
            {loading ? "답변 생성 중..." : "질문하기"}
          </button>
        </div>
      </form>

      {error ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

      {response ? (
        <div className="mt-5 grid gap-5">
          <article className="rounded-lg border border-stone-100 bg-stone-50 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black text-stone-950">답변</h3>
              {response.provider ? (
                <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-emerald-800">{response.provider}</span>
              ) : null}
            </div>
            <div className="max-h-96 overflow-y-auto whitespace-pre-wrap text-sm leading-7 text-stone-700">{response.answer}</div>
          </article>

          <section className="grid gap-3">
            <h3 className="text-base font-black text-stone-950">참고 뉴스</h3>
            {response.references.length > 0 ? (
              <div className="grid gap-2">
                {response.references.map((item) => (
                  <a
                    className="rounded-md border border-stone-200 bg-white p-3 text-sm transition hover:border-emerald-700 hover:bg-emerald-50"
                    href={item.url}
                    key={item.id}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span className="block font-bold leading-6 text-stone-950">{item.title}</span>
                    <span className="mt-1 block text-xs font-semibold text-stone-500">
                      {item.source} · {formatDate(item.published_at)}
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-stone-300 p-3 text-sm text-stone-500">
                참고할 저장 뉴스가 없습니다.
              </p>
            )}
          </section>

          {referenceIds.length > 0 ? <TransformButtons newsIds={referenceIds} roleType={roleType} /> : null}
        </div>
      ) : null}
    </section>
  );
}
