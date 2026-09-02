import type { LocationQuery, LocationQueryRaw, LocationQueryValue } from 'vue-router'

import { SORT_KEYS, type MediaType, type SortKey } from '@/api/types'
import { MAX_PAGES } from '@/composables/usePagedList'

/** Ниже 1900 в каталоге TMDB почти пусто, а ползунок становится длиннее без пользы. */
export const MIN_YEAR = 1900
export const MAX_YEAR = new Date().getFullYear()

export const DEFAULT_TYPE: MediaType = 'movie'
export const DEFAULT_SORT: SortKey = 'popularity'

/** Состояние каталога целиком. Источник правды — URL, отсюда и разбор из него. */
export interface CatalogFilters {
  type: MediaType
  sort: SortKey
  genreIds: number[]
  /** `null` — граница не задана, параметр в API не уходит вовсе. */
  yearFrom: number | null
  yearTo: number | null
  page: number
}

export function isSortKey(value: unknown): value is SortKey {
  return typeof value === 'string' && (SORT_KEYS as readonly string[]).includes(value)
}

/** Один и тот же ключ в URL может прийти массивом: `?type=movie&type=tv`. Берём первый. */
function firstValue(value: LocationQueryValue | LocationQueryValue[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value
  return raw ?? ''
}

function parseGenreIds(raw: string): number[] {
  if (!raw) return []

  const ids = raw
    .split('|')
    .map((part) => Number.parseInt(part, 10))
    .filter((id) => Number.isInteger(id) && id > 0)

  // Дубли в URL безвредны для TMDB, но ломали бы состояние чипов.
  return [...new Set(ids)]
}

function parseYear(raw: string): number | null {
  const year = Number.parseInt(raw, 10)
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) return null
  return year
}

function parseYearRange(rawFrom: string, rawTo: string): [number | null, number | null] {
  const from = parseYear(rawFrom)
  const to = parseYear(rawTo)

  // Перевёрнутый диапазон — не «пустая выдача», а испорченный URL: в API уходить
  // ему незачем, отбрасываем обе границы к «без ограничения».
  if (from !== null && to !== null && from > to) return [null, null]

  return [from, to]
}

function parsePage(raw: string): number {
  const page = Number.parseInt(raw, 10)
  if (!Number.isInteger(page) || page < 1) return 1
  return Math.min(page, MAX_PAGES)
}

/**
 * Разбор строки запроса. Защитный по всем полям: URL правит кто угодно, и мусор
 * должен отбрасываться к значению по умолчанию, а не уезжать в API.
 */
export function parseCatalogQuery(query: LocationQuery): CatalogFilters {
  const rawType = firstValue(query.type)
  const rawSort = firstValue(query.sort)
  const [yearFrom, yearTo] = parseYearRange(firstValue(query.from), firstValue(query.to))

  return {
    type: rawType === 'movie' || rawType === 'tv' ? rawType : DEFAULT_TYPE,
    sort: isSortKey(rawSort) ? rawSort : DEFAULT_SORT,
    genreIds: parseGenreIds(firstValue(query.genres)),
    yearFrom,
    yearTo,
    page: parsePage(firstValue(query.page)),
  }
}

/**
 * Обратная сборка. Значения по умолчанию в URL не пишем: главная должна
 * оставаться просто `/`, а не `/?type=movie&sort=popularity&page=1`.
 */
export function toCatalogQuery(filters: CatalogFilters): LocationQueryRaw {
  const query: LocationQueryRaw = {}

  if (filters.type !== DEFAULT_TYPE) query.type = filters.type
  if (filters.sort !== DEFAULT_SORT) query.sort = filters.sort
  if (filters.genreIds.length) query.genres = filters.genreIds.join('|')
  if (filters.yearFrom !== null) query.from = String(filters.yearFrom)
  if (filters.yearTo !== null) query.to = String(filters.yearTo)
  if (filters.page > 1) query.page = String(filters.page)

  return query
}
