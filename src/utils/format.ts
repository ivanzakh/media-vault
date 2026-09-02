import type { MediaItem, MovieResult, TvResult } from '@/api/types'

const numberFormat = new Intl.NumberFormat('ru-RU')

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
