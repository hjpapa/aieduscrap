import type { EducationNews } from "./types";

type TrustedSource = {
  label: string;
  score: number;
  patterns: RegExp[];
};

const trustedSources: TrustedSource[] = [
  {
    label: "공식/국제기구",
    score: 30,
    patterns: [
      /교육부|ministry of education|moe\.go\.kr|korea\.kr/i,
      /keris|한국교육학술정보원|keris\.or\.kr/i,
      /oecd|oecd\.org/i,
      /unesco|unesco\.org/i,
    ],
  },
  {
    label: "전문 교육매체",
    score: 18,
    patterns: [
      /edsurge|edsurge\.com/i,
      /education week|edweek|edweek\.org/i,
      /eschool news|eschoolnews\.com/i,
      /k-12 dive|k12dive\.com/i,
      /the 74|the74million\.org/i,
      /edtech magazine|edtechmagazine\.com/i,
      /education next|educationnext\.org/i,
      /inside higher ed|insidehighered\.com/i,
    ],
  },
];

function trustedSourceText(item: Pick<EducationNews, "source" | "url" | "title">) {
  return [item.source, item.url, item.title].filter(Boolean).join(" ");
}

export function getTrustedSourceLabel(item: Pick<EducationNews, "source" | "url" | "title">) {
  const text = trustedSourceText(item);
  return trustedSources.find((source) => source.patterns.some((pattern) => pattern.test(text)))?.label ?? null;
}

export function getTrustedSourceScore(item: Pick<EducationNews, "source" | "url" | "title">) {
  const text = trustedSourceText(item);
  return trustedSources.find((source) => source.patterns.some((pattern) => pattern.test(text)))?.score ?? 0;
}

export function isTrustedSource(item: Pick<EducationNews, "source" | "url" | "title">) {
  return getTrustedSourceScore(item) > 0;
}
