const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function getKstDayRange(now = new Date()) {
  const kstDate = new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);

  return {
    date: kstDate,
    start: new Date(`${kstDate}T00:00:00+09:00`).toISOString(),
    end: new Date(`${kstDate}T24:00:00+09:00`).toISOString(),
  };
}
