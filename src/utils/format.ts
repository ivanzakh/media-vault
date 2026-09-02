import type { MediaItem, MovieResult, TvResult } from '@/api/types'

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
