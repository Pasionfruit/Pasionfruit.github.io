import type { NewsItem } from '../../data/news/client'

export const NEWS_SUMMARY_EVENT = 'ace-news-summary'
export type NewsSummaryRequest = { article: NewsItem; id: string }

export function askAceAboutNews(article: NewsItem) {
  window.dispatchEvent(new CustomEvent<NewsSummaryRequest>(NEWS_SUMMARY_EVENT, {
    detail: { article, id: crypto.randomUUID() },
  }))
}

export function newsSummaryQuestion(article: NewsItem) {
  return `Give me a high-level summary of this news article: ${article.title}\n${article.url}`
}

/** Fetch article content only when the user asks about a linked story. */
export function newsArticleUrl(question: string) {
  if (!/\b(summar\w*|high[- ]level|explain|article|story)\b/i.test(question)) return null
  return question.match(/https:\/\/[^\s<>"\]]+/i)?.[0].replace(/[.,;!?)]*$/, '') ?? null
}
