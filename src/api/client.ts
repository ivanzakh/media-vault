const BASE_URL = 'https://api.themoviedb.org/3'
const LANGUAGE = 'ru-RU'

// Токен впечатывается в бандл на этапе сборки, а не читается в рантайме.
// Точка роста: если понадобится его спрятать, прокси-эндпоинт подменяется
// ровно здесь — остальное приложение про TMDB напрямую не знает.
const TOKEN = import.meta.env.VITE_TMDB_TOKEN

if (!TOKEN) {
  console.error(
    'VITE_TMDB_TOKEN не задан. Скопируйте .env.example в .env.local, подставьте ' +
      'API Read Access Token и перезапустите dev-сервер: переменные окружения ' +
      'подставляются на старте Vite, а не на лету.',
  )
}

export class TmdbError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'TmdbError'
  }
}

type QueryParams = Record<string, string | number | boolean | undefined>

/**
 * Единственное место, знающее про базовый URL, авторизацию и формат ошибок.
 *
 * `signal` — последний необязательный параметр у всех функций запроса. Ровно
 * такую сигнатуру ждёт `queryFn: ({ signal }) => ...` в vue-query, поэтому
 * будущая миграция на него этот слой не затронет.
 */
export async function tmdb<T>(
  path: string,
  params: QueryParams = {},
  signal?: AbortSignal,
): Promise<T> {
  const url = new URL(BASE_URL + path)
  url.searchParams.set('language', LANGUAGE)

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
  }

  const response = await fetch(url, {
    signal,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new TmdbError(response.status, `TMDB ответил ${response.status} на ${path}`)
  }

  return (await response.json()) as T
}

/** Отменённый запрос — не ошибка приложения, его нужно молча проглатывать. */
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
