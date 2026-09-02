import { toMediaItem } from '@/utils/format'

import { tmdb } from './client'
import { isMediaResult } from './types'
import type { ImageSize, MediaItem, MultiSearchResult, Paginated } from './types'

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

/**
 * Тот же поиск, но приведённый к тому, с чем работает приложение: персоны
 * отброшены, фильмы и сериалы нормализованы в `MediaItem`.
 *
 * `total_results` при этом остаётся исходным — он считает и персон тоже, поэтому
 * на странице может оказаться меньше 20 карточек. Это поведение `/search/multi`,
 * а не ошибка: пересчитать его без выкачивания всех страниц невозможно.
 */
export async function searchMedia(
  query: string,
  page = 1,
  signal?: AbortSignal,
): Promise<Paginated<MediaItem>> {
  const data = await searchMulti(query, page, signal)

  return {
    ...data,
    results: data.results.filter(isMediaResult).map(toMediaItem),
  }
}
