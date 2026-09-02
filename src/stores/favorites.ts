import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

import type { MediaItem, MediaType } from '@/api/types'

const STORAGE_KEY = 'media-vault:favorites'

/**
 * Версия формата, а не версия приложения. Форма `MediaItem` наверняка изменится
 * (ближайший кандидат — пользовательские метки), и версия позволит написать
 * миграцию вместо молчаливой потери чужой коллекции.
 */
const STORAGE_VERSION = 1

interface StoredPayload {
  version: number
  items: MediaItem[]
}

/**
 * Ключ составной: у фильма и сериала идентификаторы пересекаются, поэтому по
 * чистому id `movie/1399` и `tv/1399` считались бы одним и тем же тайтлом.
 */
function keyOf(item: Pick<MediaItem, 'mediaType' | 'id'>): string {
  return `${item.mediaType}:${item.id}`
}

/**
 * Разбирает одну запись из хранилища. `localStorage` правит кто угодно, да и
 * старая версия приложения могла записать другую форму, поэтому обязательные
 * поля проверяем, а остальные подставляем по умолчанию: потерять год у одной
 * карточки лучше, чем выбросить всю коллекцию.
 */
function parseItem(value: unknown): MediaItem | null {
  if (typeof value !== 'object' || value === null) return null

  const raw = value as Record<string, unknown>
  const { id, mediaType, title } = raw

  if (typeof id !== 'number' || !Number.isInteger(id)) return null
  if (mediaType !== 'movie' && mediaType !== 'tv') return null
  if (typeof title !== 'string' || !title) return null

  return {
    id,
    mediaType,
    title,
    originalTitle: typeof raw.originalTitle === 'string' ? raw.originalTitle : title,
    year: typeof raw.year === 'number' ? raw.year : null,
    posterPath: typeof raw.posterPath === 'string' ? raw.posterPath : null,
    voteAverage: typeof raw.voteAverage === 'number' ? raw.voteAverage : 0,
    overview: typeof raw.overview === 'string' ? raw.overview : '',
  }
}

/**
 * Чтение обёрнуто в try/catch: `localStorage` бросает в приватном режиме, а
 * испорченный вручную JSON не должен превращаться в белый экран — падаем на
 * пустой список.
 */
function loadFromStorage(): MediaItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []

    const payload: unknown = JSON.parse(raw)
    if (typeof payload !== 'object' || payload === null) return []

    const { version, items } = payload as Partial<StoredPayload>
    // Здесь же появится миграция, когда версия станет второй.
    if (version !== STORAGE_VERSION || !Array.isArray(items)) return []

    return items.map(parseItem).filter((item): item is MediaItem => item !== null)
  } catch (e) {
    console.error('Не удалось прочитать избранное', e)
    return []
  }
}

function persist(items: MediaItem[]): void {
  try {
    const payload: StoredPayload = { version: STORAGE_VERSION, items }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch (e) {
    // Переполнение квоты и приватный режим: коллекция останется в памяти
    // вкладки, но приложение из-за этого падать не должно.
    console.error('Не удалось сохранить избранное', e)
  }
}

export const useFavoritesStore = defineStore('favorites', () => {
  /**
   * Храним денормализованный снимок `MediaItem`, а не один id: иначе на
   * отрисовку страницы избранного понадобился бы отдельный запрос к TMDB на
   * каждую карточку. Постер лежит путём (`/kqjL17...jpg`), полный URL собирает
   * `imageUrl()` — сами картинки в хранилище не попадают, порядка 250 байт на
   * запись. Обратная сторона: без сети список откроется, но постеров не будет.
   */
  const items = ref<MediaItem[]>(loadFromStorage())

  /** Set в computed, чтобы `isFavorite` в каждой карточке был O(1), а не перебором. */
  const keys = computed(() => new Set(items.value.map(keyOf)))

  const count = computed(() => items.value.length)

  function isFavorite(mediaType: MediaType, id: number): boolean {
    return keys.value.has(`${mediaType}:${id}`)
  }

  function toggle(item: MediaItem): void {
    const key = keyOf(item)

    if (keys.value.has(key)) {
      items.value = items.value.filter((saved) => keyOf(saved) !== key)
      return
    }

    // Новое кладём в начало: избранное читается как лента последних добавлений.
    items.value = [{ ...item }, ...items.value]
  }

  // Массив заменяется целиком, а не мутируется, поэтому deep-вотчер не нужен.
  watch(items, persist)

  return { items, count, isFavorite, toggle }
})
