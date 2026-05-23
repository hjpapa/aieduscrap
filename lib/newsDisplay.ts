type NewsTitleLike = {
  title: string;
  translated_title?: string | null;
};

export function getDisplayTitle(news: NewsTitleLike) {
  return news.translated_title?.trim() || news.title;
}

export function hasTranslatedTitle(news: NewsTitleLike) {
  return Boolean(news.translated_title?.trim() && news.translated_title.trim() !== news.title.trim());
}
