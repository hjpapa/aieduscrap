const dayMs = 24 * 60 * 60 * 1000;

export function getNewsMaxAgeDays() {
  const configured = Number(process.env.NEWS_MAX_ITEM_AGE_DAYS ?? 7);

  return Number.isFinite(configured) && configured > 0 ? configured : 7;
}

export function isFreshPublishedAt(value: string, now = new Date(), maxAgeDays = getNewsMaxAgeDays()) {
  const publishedAt = new Date(value).getTime();

  if (Number.isNaN(publishedAt)) {
    return false;
  }

  const current = now.getTime();
  const oldestAllowed = current - maxAgeDays * dayMs;
  const newestAllowed = current + dayMs;

  return publishedAt >= oldestAllowed && publishedAt <= newestAllowed;
}
