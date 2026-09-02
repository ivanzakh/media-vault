/** Типы, с которыми работает приложение, и сырые формы ответов TMDB. */

export type MediaType = 'movie' | 'tv'

/** Наборы размеров из `/configuration`: у постеров, бэкдропов и портретов они разные. */
export type PosterSize = 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original'
export type BackdropSize = 'w300' | 'w780' | 'w1280' | 'original'
export type ProfileSize = 'w45' | 'w185' | 'h632' | 'original'

export type ImageSize = PosterSize | BackdropSize | ProfileSize

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
 * `/discover/movie` и `/discover/tv` возвращают те же объекты, что и поиск, но
 * без `media_type`: тип известен из самого запроса. Поэтому формы выводим из
 * поисковых, а тип приписывает уже `discover()` — из своего же параметра.
 */
export type DiscoverMovieResult = Omit<MovieResult, 'media_type'>
export type DiscoverTvResult = Omit<TvResult, 'media_type'>

/**
 * Ключи сортировки в терминах интерфейса. В параметры TMDB их переводит
 * `SORT_PARAM` в `api/media.ts`: у фильмов и сериалов поля называются
 * по-разному, и наружу эта асимметрия не выходит.
 */
export const SORT_KEYS = ['popularity', 'rating', 'votes', 'date'] as const
export type SortKey = (typeof SORT_KEYS)[number]

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

export interface Genre {
  id: number
  name: string
}

/** Актёр из `credits`. `order` — позиция в титрах, в этом порядке TMDB и отдаёт список. */
export interface CastMember {
  id: number
  name: string
  character: string
  profile_path: string | null
  order: number
}

/**
 * Актёр из `aggregate_credits` — сериального аналога `credits`. Роль здесь не
 * одна: за все сезоны актёр мог сыграть несколько персонажей, поэтому вместо
 * `character` приходит массив `roles`.
 */
export interface AggregateCastMember {
  id: number
  name: string
  profile_path: string | null
  order: number
  roles: { character: string; episode_count: number }[]
}

interface BaseDetailsResponse {
  id: number
  overview: string
  tagline: string
  poster_path: string | null
  backdrop_path: string | null
  genres: Genre[]
  vote_average: number
  vote_count: number
}

/**
 * Ответы `/movie/{id}` и `/tv/{id}` не содержат `media_type` — в отличие от
 * `/search/multi`, тип здесь известен из самого запроса. Поэтому размеченного
 * объединения нет: нужную форму выбирает `getDetails` по своему параметру.
 */
export interface MovieDetailsResponse extends BaseDetailsResponse {
  title: string
  original_title: string
  release_date?: string
  /** У анонсированных фильмов хронометраж ещё не проставлен. */
  runtime: number | null
  /** Приходит только вместе с `append_to_response=credits`. */
  credits?: { cast: CastMember[] }
}

export interface TvDetailsResponse extends BaseDetailsResponse {
  name: string
  original_name: string
  first_air_date?: string
  number_of_seasons: number
  number_of_episodes: number
  /** Массив: у сериала серии бывают разной длины, а иногда его вовсе нет. */
  episode_run_time: number[]
  /**
   * Именно `aggregate_credits`, а не `credits`: у сериала `credits` возвращает
   * состав только последнего сезона («Get the latest season credits of a TV
   * show»), и у длинных сериалов там оказывается пара человек или вовсе никого.
   */
  aggregate_credits?: { cast: AggregateCastMember[] }
}

/** Нормализованная деталка: фильм и сериал приведены к одной форме. */
export interface MediaDetails {
  id: number
  mediaType: MediaType
  title: string
  originalTitle: string
  year: number | null
  posterPath: string | null
  backdropPath: string | null
  overview: string
  tagline: string
  genres: Genre[]
  voteAverage: number
  voteCount: number
  /** Минуты: у фильма хронометраж, у сериала длина серии. */
  runtime: number | null
  /** Только у сериала, у фильма — `null`. */
  seasons: number | null
  episodes: number | null
  cast: CastMember[]
}
