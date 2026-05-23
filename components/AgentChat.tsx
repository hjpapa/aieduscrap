"use client";

import { FormEvent, useMemo, useState } from "react";
import TransformButtons from "@/components/TransformButtons";
import { getDisplayTitle, hasTranslatedTitle } from "@/lib/newsDisplay";
import type { AgentPeriod, NewsReference, RoleType } from "@/lib/types";

type AgentResponse = {
  answer: string;
  structuredAnswer?: AgentStructuredAnswer;
  references: NewsReference[];
  provider?: string;
  saved?: boolean;
  error?: string;
};

type AgentStructuredAnswer = {
  headline: string;
  briefAnswer: string;
  evidenceCards: Array<{
    newsId: string;
    pointTitle: string;
    factSummary: string;
    teacherInterpretation: string;
    schoolAction: string;
  }>;
  nextSteps: string[];
  cautions: string[];
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
  "오늘 AI교육 동향 중 우리 학교가 확인해야 할 변화는?",
  "국제 AI교육 뉴스에서 초등교사가 참고할 흐름을 정리해줘.",
  "AI교육 관련 뉴스를 연수 주제로 바꾸면 어떻게 시작하면 좋을까?",
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function getReference(references: NewsReference[], newsId: string) {
  return references.find((item) => item.id === newsId);
}

function formatAnswerForExport(response: AgentResponse) {
  const structured = response.structuredAnswer;

  if (!structured) {
    const references = response.references
      .map((item, index) => `${index + 1}. ${getDisplayTitle(item)}\n- 원제: ${item.title}\n- 출처: ${item.source}\n- URL: ${item.url}`)
      .join("\n\n");

    return [`뉴스 근거 답변`, response.answer, "", "참고 뉴스", references].join("\n\n");
  }

  const cards = structured.evidenceCards
    .map((card, index) => {
      const reference = getReference(response.references, card.newsId);

      return [
        `${index + 1}. ${card.pointTitle}`,
        `- 뉴스 근거: ${card.factSummary}`,
        `- 교사 관점: ${card.teacherInterpretation}`,
        `- 학교 적용: ${card.schoolAction}`,
        reference ? `- 참고 뉴스: ${getDisplayTitle(reference)} / ${reference.source} / ${reference.url}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  return [
    structured.headline,
    "",
    structured.briefAnswer,
    "",
    "핵심 카드",
    cards,
    "",
    "다음 실행",
    structured.nextSteps.map((item, index) => `${index + 1}. ${item}`).join("\n"),
    "",
    "주의",
    structured.cautions.map((item, index) => `${index + 1}. ${item}`).join("\n"),
  ].join("\n");
}

function StructuredAnswerView({ response }: { response: AgentResponse }) {
  const structured = response.structuredAnswer;

  if (!structured) {
    return (
      <article className="min-w-0 rounded-lg border border-emerald-100 bg-emerald-50/40 p-4">
        <div className="whitespace-pre-wrap text-sm leading-7 text-stone-700 [overflow-wrap:anywhere]">{response.answer}</div>
      </article>
    );
  }

  return (
    <article className="grid min-w-0 gap-4">
      <section className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4">
        <p className="text-xs font-bold text-emerald-800">SUMMARY</p>
        <h4 className="mt-1 text-xl font-black leading-snug text-stone-950">{structured.headline}</h4>
        <p className="mt-3 text-sm leading-7 text-stone-700">{structured.briefAnswer}</p>
      </section>

      {structured.evidenceCards.length > 0 ? (
        <section className="grid gap-3">
          {structured.evidenceCards.map((card, index) => {
            const reference = getReference(response.references, card.newsId);

            return (
              <div className="rounded-lg border border-stone-200 bg-white p-4" key={`${card.newsId}-${index}`}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                    {index + 1}
                  </span>
                  <h5 className="text-base font-black leading-snug text-stone-950">{card.pointTitle}</h5>
                </div>

                <div className="grid gap-3 text-sm leading-6 text-stone-700">
                  <section>
                    <p className="text-xs font-bold text-emerald-800">뉴스에 근거한 내용</p>
                    <p className="mt-1">{card.factSummary}</p>
                  </section>
                  <section>
                    <p className="text-xs font-bold text-emerald-800">교사 관점 해석</p>
                    <p className="mt-1">{card.teacherInterpretation}</p>
                  </section>
                  <section>
                    <p className="text-xs font-bold text-emerald-800">학교 적용 아이디어</p>
                    <p className="mt-1">{card.schoolAction}</p>
                  </section>
                </div>

                {reference ? (
                  <a
                    className="mt-4 block rounded-md border border-stone-200 bg-stone-50 p-3 text-sm transition hover:border-emerald-700 hover:bg-emerald-50"
                    href={reference.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span className="block break-words font-bold leading-6 text-stone-950">{getDisplayTitle(reference)}</span>
                    {hasTranslatedTitle(reference) ? (
                      <span className="mt-1 block break-words text-xs text-stone-500">{reference.title}</span>
                    ) : null}
                    <span className="mt-1 block text-xs font-semibold text-stone-500">
                      {reference.source} · {formatDate(reference.published_at)}
                    </span>
                  </a>
                ) : null}
              </div>
            );
          })}
        </section>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <h5 className="text-sm font-black text-stone-950">다음 실행</h5>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-stone-700">
            {structured.nextSteps.map((item, index) => (
              <li className="flex gap-2" key={`${item}-${index}`}>
                <span className="font-bold text-emerald-800">{index + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-amber-100 bg-amber-50/60 p-4">
          <h5 className="text-sm font-black text-stone-950">주의할 점</h5>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-stone-700">
            {structured.cautions.map((item, index) => (
              <li className="flex gap-2" key={`${item}-${index}`}>
                <span className="font-bold text-amber-800">{index + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </article>
  );
}

export default function AgentChat() {
  const [message, setMessage] = useState("");
  const [roleType, setRoleType] = useState<RoleType>("homeroom_teacher");
  const [period, setPeriod] = useState<AgentPeriod>("today");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [answerOpen, setAnswerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const referenceIds = useMemo(() => response?.references.map((item) => item.id) ?? [], [response]);
  const answerExportText = useMemo(() => (response ? formatAnswerForExport(response) : ""), [response]);

  async function copyAnswer() {
    if (!answerExportText) {
      return;
    }

    await navigator.clipboard.writeText(answerExportText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function exportAnswer() {
    if (!answerExportText) {
      return;
    }

    const blob = new Blob([answerExportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `education-news-answer-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

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
      setAnswerOpen(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "답변을 생성하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
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
              className="h-11 w-full rounded-md border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-800 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
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
              className="h-11 w-full rounded-md border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-800 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
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
            className="min-h-32 w-full resize-y rounded-md border border-stone-200 bg-white p-3 text-sm leading-6 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
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
        <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-emerald-800">ANSWER READY</p>
              <h3 className="mt-1 text-base font-black text-stone-950">답변이 생성되었습니다</h3>
              <p className="mt-1 text-sm leading-6 text-stone-600">
                참고 뉴스 {response.references.length}건을 바탕으로 정리했습니다.
              </p>
            </div>
            <div className="flex gap-2">
              {response.provider ? (
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-800">{response.provider}</span>
              ) : null}
            </div>
          </div>

          <button
            className="mt-4 w-full rounded-md bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-900"
            onClick={() => setAnswerOpen(true)}
            type="button"
          >
            답변 창 열기
          </button>
        </div>
      ) : null}

      {response && answerOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-stone-950/45 p-4">
          <section
            aria-labelledby="agent-answer-title"
            className="grid max-h-[92vh] w-full max-w-4xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg bg-white shadow-2xl"
            role="dialog"
          >
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 p-5">
              <div>
                <p className="text-xs font-bold text-emerald-800">AGENT ANSWER</p>
                <h3 className="mt-1 text-xl font-black text-stone-950" id="agent-answer-title">
                  구조화된 뉴스 답변
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-bold text-stone-700 transition hover:border-emerald-700 hover:text-emerald-800"
                  onClick={copyAnswer}
                  type="button"
                >
                  {copied ? "복사됨" : "복사"}
                </button>
                <button
                  className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-bold text-stone-700 transition hover:border-emerald-700 hover:text-emerald-800"
                  onClick={exportAnswer}
                  type="button"
                >
                  내보내기
                </button>
                <button
                  className="rounded-md bg-stone-900 px-3 py-2 text-sm font-bold text-white transition hover:bg-stone-700"
                  onClick={() => setAnswerOpen(false)}
                  type="button"
                >
                  닫기
                </button>
              </div>
            </header>

            <div className="grid min-h-0 gap-5 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
              <StructuredAnswerView response={response} />

              <aside className="grid content-start gap-4">
                <section className="rounded-lg border border-stone-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="text-sm font-black text-stone-950">참고 뉴스</h4>
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-bold text-stone-500">
                      {response.references.length}건
                    </span>
                  </div>
                  {response.references.length > 0 ? (
                    <div className="grid gap-2">
                      {response.references.map((item) => (
                        <a
                          className="min-w-0 rounded-md border border-stone-200 bg-stone-50 p-3 text-sm transition hover:border-emerald-700 hover:bg-emerald-50"
                          href={item.url}
                          key={item.id}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <span className="block break-words font-bold leading-6 text-stone-950">{getDisplayTitle(item)}</span>
                          {hasTranslatedTitle(item) ? (
                            <span className="mt-1 block break-words text-xs text-stone-500">{item.title}</span>
                          ) : null}
                          <span className="mt-1 block break-words text-xs font-semibold text-stone-500">
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
              </aside>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
