import type { LocationQuery, LocationQueryRaw } from 'vue-router'

import type { FavoriteItem } from '@/types/favorites'
import { firstValue } from '@/utils/query'

/**
 * В избранном «Все» — полноценное значение по умолчанию, а не отсутствие
 * фильтра: категория бывает смешанной, и разделять её на фильмы и сериалы нужно
 * не всегда. В каталоге такого варианта нет — там тип задаёт сам эндпоинт TMDB.
 */
export type FavoritesType = 'all' | 'movie' | 'tv'

/**
 * Ключи сортировки свои, а не из каталога: там сортирует TMDB по полям, которых
 * в сохранённом снимке нет (число оценок, популярность), зато здесь есть
 * «по добавлению» — порядок, которого у выдачи API не бывает.
 */
export const FAVORITES_SORT_KEYS = ['added', 'title', 'year', 'rating'] as const
export type FavoritesSortKey = (typeof FAVORITES_SORT_KEYS)[number]

export const DEFAULT_FAVORITES_TYPE: FavoritesType = 'all'
export const DEFAULT_FAVORITES_SORT: FavoritesSortKey = 'added'

/**
 * Фильтры действуют внутри одной категории. Самой категории здесь нет: она
 * приходит параметром маршрута (`/favorites/c1`), а не строкой запроса — это
 * адрес страницы, а не её настройка.
 */
export interface FavoritesFilters {
  type: FavoritesType
  sort: FavoritesSortKey
}

export function isFavoritesSortKey(value: unknown): value is FavoritesSortKey {
  return typeof value === 'string' && (FAVORITES_SORT_KEYS as readonly string[]).includes(value)
}

/**
 * Разбор строки запроса. Защитный по всем полям: URL правит кто угодно, и мусор
 * должен отбрасываться к значению по умолчанию.
 */
export function parseFavoritesQuery(query: LocationQuery): FavoritesFilters {
  const rawType = firstValue(query.type)
  const rawSort = firstValue(query.sort)

  return {
    type: rawType === 'movie' || rawType === 'tv' ? rawType : DEFAULT_FAVORITES_TYPE,
    sort: isFavoritesSortKey(rawSort) ? rawSort : DEFAULT_FAVORITES_SORT,
  }
}

/**
 * Обратная сборка. Значения по умолчанию в URL не пишем: категория без фильтров
 * должна оставаться просто `/favorites/c1`, а не `/favorites/c1?type=all&sort=added`.
 */
export function toFavoritesQuery(filters: FavoritesFilters): LocationQueryRaw {
  const query: LocationQueryRaw = {}

  if (filters.type !== DEFAULT_FAVORITES_TYPE) query.type = filters.type
  if (filters.sort !== DEFAULT_FAVORITES_SORT) query.sort = filters.sort

  return query
}

export function hasActiveFavoritesFilters(filters: FavoritesFilters): boolean {
  return filters.type !== DEFAULT_FAVORITES_TYPE || filters.sort !== DEFAULT_FAVORITES_SORT
}

export function filterFavorites(items: FavoriteItem[], filters: FavoritesFilters): FavoriteItem[] {
  if (filters.type === 'all') return items
  return items.filter((item) => item.mediaType === filters.type)
}

/** `null` в конец при любой сортировке: «неизвестно» — не то же самое, что «мало». */
function compareNullable(a: number | null, b: number | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return b - a
}

export function sortFavorites(items: FavoriteItem[], sort: FavoritesSortKey): FavoriteItem[] {
  // `added` — это и есть порядок хранения: стор кладёт новое в начало, поэтому
  // отдельное поле с датой добавления не нужно.
  if (sort === 'added') return items

  const sorted = [...items]

  switch (sort) {
    case 'title':
      // localeCompare с русской локалью: иначе «Ё» уезжает в конец латиницы.
      sorted.sort((a, b) => a.title.localeCompare(b.title, 'ru'))
      break
    case 'year':
      sorted.sort((a, b) => compareNullable(a.year, b.year))
      break
    case 'rating':
      // Нулевой рейтинг у TMDB означает «оценок нет» — ему место рядом с `null`.
      sorted.sort((a, b) => compareNullable(a.voteAverage || null, b.voteAverage || null))
      break
  }

  return sorted
}
