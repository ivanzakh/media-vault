import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

import type { MediaItem, MediaType } from '@/api/types'
import type { FavoriteItem, Tag } from '@/types/favorites'

const STORAGE_KEY = 'media-vault:favorites'

/**
 * Версия формата, а не версия приложения. Вторая версия добавила
 * пользовательские метки: реестр `tags` рядом со списком и `tagIds` на каждой
 * записи. Первая версия читается миграцией ниже, а не выбрасывается.
 */
const STORAGE_VERSION = 2

/** Префикс идентификаторов меток: `t1`, `t2`. См. комментарий к `Tag.id`. */
const TAG_ID_PREFIX = 't'

/** Длинное имя метки — почти наверняка случайно вставленный текст. */
export const TAG_NAME_MAX_LENGTH = 40

interface StoredPayload {
  version: number
  items: FavoriteItem[]
  tags: Tag[]
  /**
   * Монотонный счётчик, а не `max(id) + 1` по существующим меткам. Иначе после
   * удаления `t3` следующая новая метка получила бы тот же `t3`, и сохранённая
   * ссылка `/favorites?tags=t3` открыла бы совсем другую подборку.
   */
  nextTagId: number
}

/**
 * Ключ составной: у фильма и сериала идентификаторы пересекаются, поэтому по
 * чистому id `movie/1399` и `tv/1399` считались бы одним и тем же тайтлом.
 */
function keyOf(item: Pick<MediaItem, 'mediaType' | 'id'>): string {
  return `${item.mediaType}:${item.id}`
}

/** Числовая часть `t12` → 12. Для мусорных значений — 0. */
function tagIdNumber(id: string): number {
  const parsed = Number.parseInt(id.slice(TAG_ID_PREFIX.length), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0
}

/**
 * Разбирает одну запись из хранилища. `localStorage` правит кто угодно, да и
 * старая версия приложения могла записать другую форму, поэтому обязательные
 * поля проверяем, а остальные подставляем по умолчанию: потерять год у одной
 * карточки лучше, чем выбросить всю коллекцию.
 */
function parseItem(value: unknown): FavoriteItem | null {
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
    tagIds: Array.isArray(raw.tagIds)
      ? raw.tagIds.filter((tagId): tagId is string => typeof tagId === 'string')
      : [],
  }
}

function parseTag(value: unknown): Tag | null {
  if (typeof value !== 'object' || value === null) return null

  const raw = value as Record<string, unknown>
  if (typeof raw.id !== 'string' || !raw.id) return null
  if (typeof raw.name !== 'string' || !raw.name) return null

  return { id: raw.id, name: raw.name }
}

interface LoadedState {
  items: FavoriteItem[]
  tags: Tag[]
  nextTagId: number
}

/** Функцией, а не константой: возвращать один и тот же массив из разных веток — заготовка для случайной общей ссылки. */
function emptyState(): LoadedState {
  return { items: [], tags: [], nextTagId: 1 }
}

/**
 * Чтение обёрнуто в try/catch: `localStorage` бросает в приватном режиме, а
 * испорченный вручную JSON не должен превращаться в белый экран — падаем на
 * пустое состояние.
 */
function loadFromStorage(): LoadedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()

    const payload: unknown = JSON.parse(raw)
    if (typeof payload !== 'object' || payload === null) return emptyState()

    const { version, items, tags, nextTagId } = payload as Partial<StoredPayload>
    if (!Array.isArray(items)) return emptyState()

    // v1 — те же записи, но без меток: реестр пуст, `tagIds` подставит
    // `parseItem`. Форма записи не менялась, поэтому отдельной ветки разбора не
    // нужно — достаточно не выбрасывать коллекцию из-за номера версии.
    if (version !== 1 && version !== STORAGE_VERSION) return emptyState()

    const parsedTags = Array.isArray(tags)
      ? tags.map(parseTag).filter((tag): tag is Tag => tag !== null)
      : []

    // Дубликаты id в реестре сломали бы и фильтрацию, и переименование.
    const known = new Set<string>()
    const uniqueTags = parsedTags.filter((tag) => {
      if (known.has(tag.id)) return false
      known.add(tag.id)
      return true
    })

    const parsedItems = items
      .map(parseItem)
      .filter((item): item is FavoriteItem => item !== null)
      // Метка, которой нет в реестре, — след неудачного удаления или ручной
      // правки хранилища. Показать её нечем, поэтому снимаем.
      .map((item) => ({ ...item, tagIds: item.tagIds.filter((tagId) => known.has(tagId)) }))

    // Счётчик подтягиваем вверх, если в хранилище он оказался меньше уже
    // выданных id: иначе следующая метка затёрла бы существующую.
    const maxUsed = uniqueTags.reduce((max, tag) => Math.max(max, tagIdNumber(tag.id)), 0)
    const storedNext = typeof nextTagId === 'number' && Number.isInteger(nextTagId) ? nextTagId : 1

    return {
      items: parsedItems,
      tags: uniqueTags,
      nextTagId: Math.max(storedNext, maxUsed + 1),
    }
  } catch (e) {
    console.error('Не удалось прочитать избранное', e)
    return emptyState()
  }
}

function persist(state: LoadedState): void {
  try {
    const payload: StoredPayload = { version: STORAGE_VERSION, ...state }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch (e) {
    // Переполнение квоты и приватный режим: коллекция останется в памяти
    // вкладки, но приложение из-за этого падать не должно.
    console.error('Не удалось сохранить избранное', e)
  }
}

export const useFavoritesStore = defineStore('favorites', () => {
  const stored = loadFromStorage()

  /**
   * Храним денормализованный снимок `MediaItem`, а не один id: иначе на
   * отрисовку страницы избранного понадобился бы отдельный запрос к TMDB на
   * каждую карточку. Постер лежит путём (`/kqjL17...jpg`), полный URL собирает
   * `imageUrl()` — сами картинки в хранилище не попадают, порядка 250 байт на
   * запись. Обратная сторона: без сети список откроется, но постеров не будет.
   */
  const items = ref<FavoriteItem[]>(stored.items)

  /** Порядок массива — это и порядок показа меток в шапке избранного. */
  const tags = ref<Tag[]>(stored.tags)

  const nextTagId = ref(stored.nextTagId)

  /** Set в computed, чтобы `isFavorite` в каждой карточке был O(1), а не перебором. */
  const keys = computed(() => new Set(items.value.map(keyOf)))

  const count = computed(() => items.value.length)

  /**
   * Счётчики считаются по всей коллекции, а не по отфильтрованной выдаче: на
   * чипе должно быть написано, сколько тайтлов у метки, а не сколько их видно
   * прямо сейчас — иначе числа менялись бы от каждого клика.
   */
  const tagCounts = computed(() => {
    const counts = new Map<string, number>()

    for (const item of items.value) {
      for (const tagId of item.tagIds) {
        counts.set(tagId, (counts.get(tagId) ?? 0) + 1)
      }
    }

    return counts
  })

  const untaggedCount = computed(() => items.value.filter((item) => !item.tagIds.length).length)

  function isFavorite(mediaType: MediaType, id: number): boolean {
    return keys.value.has(`${mediaType}:${id}`)
  }

  function findItem(mediaType: MediaType, id: number): FavoriteItem | undefined {
    return items.value.find((item) => item.mediaType === mediaType && item.id === id)
  }

  function itemTagIds(mediaType: MediaType, id: number): string[] {
    return findItem(mediaType, id)?.tagIds ?? []
  }

  /**
   * Единственная точка записи в `items`. Вотчер ниже поверхностный, поэтому
   * массив обязан заменяться целиком: `item.tagIds.push(...)` тихо не
   * сохранился бы.
   */
  function updateItems(update: (items: FavoriteItem[]) => FavoriteItem[]): void {
    items.value = update(items.value)
  }

  function add(item: MediaItem): void {
    if (keys.value.has(keyOf(item))) return

    // Новое кладём в начало: избранное читается как лента последних добавлений.
    updateItems((current) => [{ ...item, tagIds: [] }, ...current])
  }

  function remove(mediaType: MediaType, id: number): void {
    const key = `${mediaType}:${id}`
    updateItems((current) => current.filter((saved) => keyOf(saved) !== key))
  }

  /** @returns `true`, если тайтл добавлен, и `false`, если убран. */
  function toggle(item: MediaItem): boolean {
    if (keys.value.has(keyOf(item))) {
      remove(item.mediaType, item.id)
      return false
    }

    add(item)
    return true
  }

  function setItemTags(mediaType: MediaType, id: number, tagIds: string[]): void {
    const key = `${mediaType}:${id}`
    const known = new Set(tags.value.map((tag) => tag.id))
    const cleaned = [...new Set(tagIds)].filter((tagId) => known.has(tagId))

    updateItems((current) =>
      current.map((item) => (keyOf(item) === key ? { ...item, tagIds: cleaned } : item)),
    )
  }

  function toggleItemTag(mediaType: MediaType, id: number, tagId: string): void {
    const current = itemTagIds(mediaType, id)

    setItemTags(
      mediaType,
      id,
      current.includes(tagId) ? current.filter((saved) => saved !== tagId) : [...current, tagId],
    )
  }

  function normalizeName(name: string): string {
    return name.trim().slice(0, TAG_NAME_MAX_LENGTH)
  }

  function findByName(name: string): Tag | undefined {
    const lowered = name.toLocaleLowerCase('ru')
    return tags.value.find((tag) => tag.name.toLocaleLowerCase('ru') === lowered)
  }

  /**
   * Совпадение имени без учёта регистра возвращает существующую метку, а не
   * заводит вторую: «marvel» и «Marvel» — это одна метка, и разъехавшиеся
   * дубли пришлось бы потом сливать вручную.
   *
   * @returns `null`, если имя пустое.
   */
  function createTag(name: string): Tag | null {
    const normalized = normalizeName(name)
    if (!normalized) return null

    const existing = findByName(normalized)
    if (existing) return existing

    const tag: Tag = { id: `${TAG_ID_PREFIX}${nextTagId.value}`, name: normalized }
    nextTagId.value += 1
    tags.value = [...tags.value, tag]

    return tag
  }

  function renameTag(id: string, name: string): void {
    const normalized = normalizeName(name)
    if (!normalized) return

    // Переименование в имя соседней метки слило бы две метки визуально, оставив
    // их разными по id. Молча отказываемся, вызывающий покажет ошибку.
    const existing = findByName(normalized)
    if (existing && existing.id !== id) return

    tags.value = tags.value.map((tag) => (tag.id === id ? { ...tag, name: normalized } : tag))
  }

  /** Тайтлы остаются в избранном — снимается только сама метка. */
  function deleteTag(id: string): void {
    tags.value = tags.value.filter((tag) => tag.id !== id)
    updateItems((current) =>
      current.map((item) =>
        item.tagIds.includes(id)
          ? { ...item, tagIds: item.tagIds.filter((tagId) => tagId !== id) }
          : item,
      ),
    )
  }

  /** Сдвиг на одну позицию; за границами списка — ничего не делает. */
  function moveTag(id: string, delta: number): void {
    const from = tags.value.findIndex((tag) => tag.id === id)
    if (from === -1) return

    const to = from + delta
    if (to < 0 || to >= tags.value.length) return

    const next = [...tags.value]
    const moved = next[from]
    if (!moved) return

    next.splice(from, 1)
    next.splice(to, 0, moved)
    tags.value = next
  }

  // Массивы заменяются целиком, а не мутируются, поэтому deep-вотчер не нужен.
  watch([items, tags, nextTagId], () => {
    persist({ items: items.value, tags: tags.value, nextTagId: nextTagId.value })
  })

  return {
    items,
    tags,
    count,
    tagCounts,
    untaggedCount,
    isFavorite,
    itemTagIds,
    add,
    remove,
    toggle,
    setItemTags,
    toggleItemTag,
    createTag,
    renameTag,
    deleteTag,
    moveTag,
  }
})
