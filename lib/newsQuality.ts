export function isLikelyNavigationPageTitle(title: string) {
  const normalized = title.replace(/\s+/g, " ").trim();
  const navigationPatterns = [
    /^공지사항\s*(>|-|$)/,
    /^홍보자료\s*(-|$)/,
    /^동정자료\s*(-|$)/,
    /^보도설명·반박\s*(-|$)/,
    /^정책\s*>/,
    /^재외교육기관포털\s*(-|$)/,
    />\s*공지사항\s*-/,
  ];

  return navigationPatterns.some((pattern) => pattern.test(normalized));
}

export function isCollectableNewsItem({ title, source }: { title: string; source: string }) {
  if (isLikelyNavigationPageTitle(title)) {
    return false;
  }

  if (/교육부 공식 뉴스|KERIS 공식 뉴스/.test(source) && !/[가-힣A-Za-z0-9]{8,}/.test(title.replace(/\s+/g, ""))) {
    return false;
  }

  return true;
}
