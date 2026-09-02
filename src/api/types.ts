/** Типы, с которыми работает приложение, и сырые формы ответов TMDB. */

export type MediaType = 'movie' | 'tv'

export type ImageSize = 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original'

export interface Paginated<T> {
  page: number
  results: T[]
  total_pages: number
  total_results: number
}

interface BaseResult {
  id: number
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  genre_ids: number[]
  popularity: number
  vote_average: number
  vote_count: number
  original_language: string
}

export interface MovieResult extends BaseResult {
  media_type: 'movie'
  title: string
  original_title: string
  /** Может отсутствовать или быть пустой строкой у анонсированных тайтлов. */
  release_date?: string
}

export interface TvResult extends BaseResult {
  media_type: 'tv'
  name: string
  original_name: string
  /** Может отсутствовать или быть пустой строкой у анонсированных тайтлов. */
  first_air_date?: string
  origin_country: string[]
}

export interface PersonResult {
  media_type: 'person'
  id: number
  name: string
  original_name: string
  profile_path: string | null
  popularity: number
}

/**
 * `/search/multi` возвращает три разных формы в одном массиве: у фильма `title`
 * и `release_date`, у сериала `name` и `first_air_date`. Размеченное объединение
 * по `media_type` — единственный способ разобрать это без приведений типов.
 */
export type MultiSearchResult = MovieResult | TvResult | PersonResult

export function isMediaResult(result: MultiSearchResult): result is MovieResult | TvResult {
  return result.media_type === 'movie' || result.media_type === 'tv'
}

/**
 * Нормализованная форма, в которой фильм и сериал неразличимы. Дальше по
 * приложению ходит только она — она же ляжет в избранное на этапе 6.
 */
export interface MediaItem {
  id: number
  mediaType: MediaType
  title: string
  originalTitle: string
  year: number | null
  posterPath: string | null
  voteAverage: number
  overview: string
}
