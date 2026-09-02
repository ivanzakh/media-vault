import { tmdb } from './client'
import type { ImageSize, MultiSearchResult, Paginated } from './types'

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p'

/** `null` на входе даёт `null` на выходе, чтобы показать заглушку вместо битой картинки. */
export function imageUrl(path: string | null, size: ImageSize): string | null {
  return path ? `${IMAGE_BASE_URL}/${size}${path}` : null
}

/**
 * Текстовый поиск. Принимает только `query`, `include_adult`, `language` и `page` —
 * ни года, ни жанра здесь нет, для фильтров существует `/discover` (этап 7).
 * Порядок выдачи задаёт TMDB, на клиенте мы его не трогаем.
 */
export function searchMulti(query: string, page = 1, signal?: AbortSignal) {
  return tmdb<Paginated<MultiSearchResult>>(
    '/search/multi',
    { query, page, include_adult: false },
    signal,
  )
}
