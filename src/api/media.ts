import { toMediaItem, toMovieDetails, toTvDetails } from '@/utils/format'

import { tmdb } from './client'
import { isMediaResult } from './types'
import type {
  DiscoverMovieResult,
  DiscoverTvResult,
  Genre,
  ImageSize,
  MediaDetails,
  MediaItem,
  MediaType,
  MovieDetailsResponse,
  MultiSearchResult,
  Paginated,
  SortKey,
  TvDetailsResponse,
} from './types'

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

/**
 * Порог числа оценок при сортировке по рейтингу. Без него `vote_average.desc`
 * выдаёт мусор: наверху окажутся тайтлы с единственной оценкой 10/10. TMDB в
 * собственном примере для «Топ рейтинга» использует ровно 200.
 */
const MIN_VOTES_FOR_RATING = 200

/**
 * Ключ интерфейса → параметр TMDB. Вся асимметрия movie/tv собрана здесь:
 * у фильма дата называется `primary_release_date`, у сериала `first_air_date`.
 */
const SORT_PARAM: Record<MediaType, Record<SortKey, string>> = {
  movie: {
    popularity: 'popularity.desc',
    rating: 'vote_average.desc',
    votes: 'vote_count.desc',
    date: 'primary_release_date.desc',
  },
  tv: {
    popularity: 'popularity.desc',
    rating: 'vote_average.desc',
    votes: 'vote_count.desc',
    date: 'first_air_date.desc',
  },
}

export interface DiscoverOptions {
  type: MediaType
  sort: SortKey
  genreIds?: number[]
  /** Границы включительны и разворачиваются в края года. `null` — без ограничения. */
  yearFrom?: number | null
  yearTo?: number | null
  page?: number
}

function discoverParams(options: DiscoverOptions) {
  // `release_date` и `air_date` берём не эти: у первого другая семантика
  // (региональные релизы), второй означает «в этот период выходила серия».
  const dateField = options.type === 'movie' ? 'primary_release_date' : 'first_air_date'

  return {
    sort_by: SORT_PARAM[options.type][options.sort],

    /*
      Края года, а не одна и та же дата на обеих границах: с `-01-01` сверху из
      выборки молча выпал бы весь последний год диапазона.
    */
    [`${dateField}.gte`]: options.yearFrom ? `${options.yearFrom}-01-01` : undefined,
    [`${dateField}.lte`]: options.yearTo ? `${options.yearTo}-12-31` : undefined,

    /*
      Пайп, а не запятая: запятая означает «И» — тайтл обязан принадлежать всем
      выбранным жанрам сразу, и на двух-трёх чипах выдача схлопнулась бы почти в
      пустоту. Пользователь же ожидает «любой из этих жанров».
    */
    with_genres: options.genreIds?.join('|') || undefined,

    'vote_count.gte': options.sort === 'rating' ? MIN_VOTES_FOR_RATING : undefined,
    include_adult: false,
    page: options.page ?? 1,
  }
}

/**
 * Каталог с серверными фильтрами. Наружу отдаёт те же `MediaItem`, что и поиск,
 * поэтому страница каталога рисуется тем же `MediaGrid`.
 *
 * Ветвление по типу, а не общий вызов: у `/discover/movie` и `/discover/tv`
 * разные формы результата, и тип приписывается здесь — в ответе его нет.
 */
export async function discover(
  options: DiscoverOptions,
  signal?: AbortSignal,
): Promise<Paginated<MediaItem>> {
  const params = discoverParams(options)

  if (options.type === 'movie') {
    const data = await tmdb<Paginated<DiscoverMovieResult>>('/discover/movie', params, signal)
    return {
      ...data,
      results: data.results.map((result) =>
        toMediaItem({ ...result, media_type: 'movie' as const }),
      ),
    }
  }

  const data = await tmdb<Paginated<DiscoverTvResult>>('/discover/tv', params, signal)
  return {
    ...data,
    results: data.results.map((result) => toMediaItem({ ...result, media_type: 'tv' as const })),
  }
}

/**
 * Справочник жанров. ID у фильмов и сериалов не совпадают — это два разных
 * словаря, а не один с фильтром.
 */
export async function getGenres(type: MediaType, signal?: AbortSignal): Promise<Genre[]> {
  const data = await tmdb<{ genres: Genre[] }>(`/genre/${type}/list`, {}, signal)
  return data.genres
}

/**
 * Деталка тайтла. `append_to_response` привозит актёрский состав тем же
 * запросом — иначе на открытие карточки уходило бы два вызова.
 *
 * Ветвление по типу, а не общий дженерик: ответы `/movie` и `/tv` не содержат
 * `media_type`, различить их постфактум нечем, а так каждый разбирает свой
 * нормализатор и TypeScript проверяет поля.
 */
export async function getDetails(
  type: MediaType,
  id: number,
  signal?: AbortSignal,
): Promise<MediaDetails> {
  if (type === 'movie') {
    const params = { append_to_response: 'credits' }
    return toMovieDetails(await tmdb<MovieDetailsResponse>(`/movie/${id}`, params, signal))
  }

  // У сериала `credits` — это состав последнего сезона, а не всего сериала.
  // Полный состав живёт в `aggregate_credits`, у него и форма актёра другая.
  const params = { append_to_response: 'aggregate_credits' }
  return toTvDetails(await tmdb<TvDetailsResponse>(`/tv/${id}`, params, signal))
}
