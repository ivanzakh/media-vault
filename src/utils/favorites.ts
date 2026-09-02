import type { LocationQuery, LocationQueryRaw } from 'vue-router'

import type { FavoriteItem } from '@/types/favorites'
import { firstValue } from '@/utils/query'

/**
 * В избранном «Все» — полноценное значение по умолчанию, а не отсутствие
 * фильтра: коллекция смешанная, и разделять её на фильмы и сериалы нужно не
 * всегда. В каталоге такого варианта нет — там тип задаёт сам эндпоинт TMDB.
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
 * Псевдо-метка «Без меток». Живёт в том же списке, что и настоящие: иначе
 * неразобранные тайтлы было бы нечем найти, а отдельный переключатель рядом с
 * чипами выглядел бы как фильтр другого рода, хотя выбор здесь один и тот же.
 * Значение не может совпасть с настоящим id: те всегда вида `t<число>`.
 */
export const UNTAGGED = 'none'

export interface FavoritesFilters {
  type: FavoritesType
  sort: FavoritesSortKey
  /** Может содержать `UNTAGGED` наравне с обычными id. */
  tagIds: string[]
}

export function isFavoritesSortKey(value: unknown): value is FavoritesSortKey {
  return typeof value === 'string' && (FAVORITES_SORT_KEYS as readonly string[]).includes(value)
}

function parseTagIds(raw: string): string[] {
  if (!raw) return []

  // Дубли безвредны для фильтрации, но ломали бы состояние чипов.
  return [...new Set(raw.split('|').filter(Boolean))]
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
    tagIds: parseTagIds(firstValue(query.tags)),
  }
}

/**
 * Обратная сборка. Значения по умолчанию в URL не пишем: избранное без фильтров
 * должно оставаться просто `/favorites`, а не `/favorites?type=all&sort=added`.
 */
export function toFavoritesQuery(filters: FavoritesFilters): LocationQueryRaw {
  const query: LocationQueryRaw = {}

  if (filters.type !== DEFAULT_FAVORITES_TYPE) query.type = filters.type
  if (filters.sort !== DEFAULT_FAVORITES_SORT) query.sort = filters.sort
  if (filters.tagIds.length) query.tags = filters.tagIds.join('|')

  return query
}

export function hasActiveFavoritesFilters(filters: FavoritesFilters): boolean {
  return (
    filters.type !== DEFAULT_FAVORITES_TYPE ||
    filters.sort !== DEFAULT_FAVORITES_SORT ||
    filters.tagIds.length > 0
  )
}

/**
 * Метки складываются по ИЛИ: выбор второй метки расширяет выдачу, а не сужает.
 * Так же ведут себя жанры в каталоге, и одинаковое поведение на двух экранах
 * важнее теоретической пользы от пересечения — при И выдача схлопывалась бы в
 * ноль на любой неудачной паре, и это выглядело бы как поломка.
 */
export function filterFavorites(items: FavoriteItem[], filters: FavoritesFilters): FavoriteItem[] {
  const wanted = new Set(filters.tagIds)
  const withoutTags = wanted.delete(UNTAGGED)
  const byTags = withoutTags || wanted.size > 0

  return items.filter((item) => {
    if (filters.type !== 'all' && item.mediaType !== filters.type) return false
    if (!byTags) return true

    if (withoutTags && !item.tagIds.length) return true
    return item.tagIds.some((tagId) => wanted.has(tagId))
  })
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
