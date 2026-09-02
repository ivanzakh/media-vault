import type {
  AggregateCastMember,
  CastMember,
  MediaDetails,
  MediaItem,
  MediaType,
  MovieDetailsResponse,
  MovieResult,
  TvDetailsResponse,
  TvResult,
} from '@/api/types'

const numberFormat = new Intl.NumberFormat('ru-RU')

/** Подпись типа для карточек, чипов и заголовков — чтобы не расходилась по экранам. */
export function mediaTypeLabel(mediaType: MediaType): string {
  return mediaType === 'movie' ? 'Фильм' : 'Сериал'
}

/** Разряды через неразрывный пробел: 1 234 вместо 1234. */
export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

/**
 * Рейтинг вида «7.8». `null`, если оценок нет вовсе: TMDB отдаёт в этом случае
 * `0`, а «0.0» на карточке читается как «очень плохой фильм», а не «нет оценок».
 */
export function formatRating(voteAverage: number): string | null {
  return voteAverage > 0 ? voteAverage.toFixed(1) : null
}

/** Хронометраж вида «2 ч 22 мин». `null` на входе даёт `null` — данных просто нет. */
export function formatRuntime(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest} мин`
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`
}

/** Русское склонение по числу: 1 результат, 2 результата, 5 результатов. */
export function plural(count: number, forms: [string, string, string]): string {
  const mod100 = count % 100
  if (mod100 >= 11 && mod100 <= 14) return forms[2]

  const mod10 = count % 10
  if (mod10 === 1) return forms[0]
  if (mod10 >= 2 && mod10 <= 4) return forms[1]
  return forms[2]
}

/**
 * Год из даты TMDB вида `2003-05-15`. Возвращает `null` для пустой строки,
 * отсутствующего поля и мусора — у анонсированных тайтлов даты часто нет.
 */
export function parseYear(date: string | undefined): number | null {
  if (!date) return null
  const year = Number.parseInt(date.slice(0, 4), 10)
  return Number.isInteger(year) && year > 0 ? year : null
}

/**
 * Приводит результат `/search/multi` к единой форме.
 *
 * На этапе 7 понадобится вариант, принимающий тип параметром: `/discover/*`
 * не возвращает `media_type`, потому что тип известен из самого запроса.
 */
export function toMediaItem(result: MovieResult | TvResult): MediaItem {
  if (result.media_type === 'movie') {
    return {
      id: result.id,
      mediaType: 'movie',
      // Русского названия у TMDB может не быть — тогда падаем на оригинальное.
      title: result.title || result.original_title,
      originalTitle: result.original_title,
      year: parseYear(result.release_date),
      posterPath: result.poster_path,
      voteAverage: result.vote_average,
      overview: result.overview,
    }
  }

  return {
    id: result.id,
    mediaType: 'tv',
    title: result.name || result.original_name,
    originalTitle: result.original_name,
    year: parseYear(result.first_air_date),
    posterPath: result.poster_path,
    voteAverage: result.vote_average,
    overview: result.overview,
  }
}

/**
 * Деталка → карточка. Избранное хранит `MediaItem`, поэтому со страницы тайтла
 * в стор уезжает не весь ответ, а тот же снимок, что лежит в сетке результатов:
 * на странице избранного он рисуется тем же `MediaCard` и не требует запроса.
 */
export function detailsToMediaItem(details: MediaDetails): MediaItem {
  return {
    id: details.id,
    mediaType: details.mediaType,
    title: details.title,
    originalTitle: details.originalTitle,
    year: details.year,
    posterPath: details.posterPath,
    voteAverage: details.voteAverage,
    overview: details.overview,
  }
}

/**
 * Деталка фильма и сериала — к одной форме. Тип приходит не из ответа (его там
 * нет), а от вызывающей стороны, поэтому нормализаторов два, по одному на форму
 * ответа: так TypeScript проверяет поля, а не мы глазами.
 */
export function toMovieDetails(raw: MovieDetailsResponse): MediaDetails {
  return {
    id: raw.id,
    mediaType: 'movie',
    title: raw.title || raw.original_title,
    originalTitle: raw.original_title,
    year: parseYear(raw.release_date),
    posterPath: raw.poster_path,
    backdropPath: raw.backdrop_path,
    overview: raw.overview,
    tagline: raw.tagline,
    genres: raw.genres,
    voteAverage: raw.vote_average,
    voteCount: raw.vote_count,
    runtime: raw.runtime,
    seasons: null,
    episodes: null,
    cast: raw.credits?.cast ?? [],
  }
}

export function toTvDetails(raw: TvDetailsResponse): MediaDetails {
  return {
    id: raw.id,
    mediaType: 'tv',
    title: raw.name || raw.original_name,
    originalTitle: raw.original_name,
    year: parseYear(raw.first_air_date),
    posterPath: raw.poster_path,
    backdropPath: raw.backdrop_path,
    overview: raw.overview,
    tagline: raw.tagline,
    genres: raw.genres,
    voteAverage: raw.vote_average,
    voteCount: raw.vote_count,
    // Длины серий бывают разные, показываем первую; пустой массив — данных нет.
    runtime: raw.episode_run_time[0] ?? null,
    seasons: raw.number_of_seasons,
    episodes: raw.number_of_episodes,
    cast: (raw.aggregate_credits?.cast ?? []).map(toCastMember),
  }
}

/**
 * Сериальная форма актёра — к общей. Ролей может быть несколько (актёр играл
 * разных персонажей в разных сезонах); показываем ту, что в титрах первой.
 */
function toCastMember(person: AggregateCastMember): CastMember {
  return {
    id: person.id,
    name: person.name,
    profile_path: person.profile_path,
    order: person.order,
    character: person.roles[0]?.character ?? '',
  }
}
