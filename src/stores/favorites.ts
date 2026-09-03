import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

import type { MediaItem, MediaType } from '@/api/types'
import { UNCATEGORIZED, type Category, type FavoriteItem } from '@/types/favorites'

const STORAGE_KEY = 'media-vault:favorites'

/**
 * Версия формата, а не версия приложения. Первая — избранное без разметки,
 * вторая — многозначные метки (`tags` + `tagIds` на записи), третья — категории:
 * ровно одна на тайтл. Обе старые версии читаются миграциями ниже, а не
 * выбрасываются.
 */
const STORAGE_VERSION = 3

/** Префикс идентификаторов категорий: `c1`, `c2`. См. комментарий к `Category.id`. */
const CATEGORY_ID_PREFIX = 'c'

/** Длинное имя категории — почти наверняка случайно вставленный текст. */
export const CATEGORY_NAME_MAX_LENGTH = 40

interface StoredPayload {
  version: number
  items: FavoriteItem[]
  categories: Category[]
  /**
   * Монотонный счётчик, а не `max(id) + 1` по существующим категориям. Иначе
   * после удаления `c3` следующая новая категория получила бы тот же `c3`, и
   * сохранённая ссылка `/favorites/c3` открыла бы совсем другую подборку.
   */
  nextCategoryId: number
}

/**
 * Ключ составной: у фильма и сериала идентификаторы пересекаются, поэтому по
 * чистому id `movie/1399` и `tv/1399` считались бы одним и тем же тайтлом.
 */
function keyOf(item: Pick<MediaItem, 'mediaType' | 'id'>): string {
  return `${item.mediaType}:${item.id}`
}

/** Числовая часть `c12` → 12. Для мусорных значений — 0. */
function categoryIdNumber(id: string): number {
  const parsed = Number.parseInt(id.slice(CATEGORY_ID_PREFIX.length), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0
}

/**
 * Разобранная запись плюс её метки из второй версии формата. Категорию по ним
 * восстанавливает миграция: здесь ещё нет реестра, по которому выбирать.
 */
interface ParsedItem {
  item: FavoriteItem
  legacyTagIds: string[]
}

/**
 * Разбирает одну запись из хранилища. `localStorage` правит кто угодно, да и
 * старая версия приложения могла записать другую форму, поэтому обязательные
 * поля проверяем, а остальные подставляем по умолчанию: потерять год у одной
 * карточки лучше, чем выбросить всю коллекцию.
 */
function parseItem(value: unknown): ParsedItem | null {
  if (typeof value !== 'object' || value === null) return null

  const raw = value as Record<string, unknown>
  const { id, mediaType, title } = raw

  if (typeof id !== 'number' || !Number.isInteger(id)) return null
  if (mediaType !== 'movie' && mediaType !== 'tv') return null
  if (typeof title !== 'string' || !title) return null

  return {
    item: {
      id,
      mediaType,
      title,
      originalTitle: typeof raw.originalTitle === 'string' ? raw.originalTitle : title,
      year: typeof raw.year === 'number' ? raw.year : null,
      posterPath: typeof raw.posterPath === 'string' ? raw.posterPath : null,
      voteAverage: typeof raw.voteAverage === 'number' ? raw.voteAverage : 0,
      overview: typeof raw.overview === 'string' ? raw.overview : '',
      categoryId:
        typeof raw.categoryId === 'string' && raw.categoryId ? raw.categoryId : UNCATEGORIZED,
    },
    legacyTagIds: Array.isArray(raw.tagIds)
      ? raw.tagIds.filter((tagId): tagId is string => typeof tagId === 'string')
      : [],
  }
}

function parseCategory(value: unknown): Category | null {
  if (typeof value !== 'object' || value === null) return null

  const raw = value as Record<string, unknown>
  if (typeof raw.id !== 'string' || !raw.id) return null
  if (typeof raw.name !== 'string' || !raw.name) return null

  return { id: raw.id, name: raw.name }
}

interface LoadedState {
  items: FavoriteItem[]
  categories: Category[]
  nextCategoryId: number
}

/** Функцией, а не константой: возвращать один и тот же массив из разных веток — заготовка для случайной общей ссылки. */
function emptyState(): LoadedState {
  return { items: [], categories: [], nextCategoryId: 1 }
}

/**
 * Миграция со второй версии. Реестр меток становится реестром категорий с
 * перенумерацией по позиции (`t1` → `c1`): старые id больше нигде не хранятся,
 * а сквозная нумерация с единицы избавляет от мусорных значений, которые могла
 * оставить ручная правка хранилища. Ссылки вида `/favorites?tags=t3` вместе с
 * метками и так перестали существовать, ломать нечего.
 *
 * У тайтла с несколькими метками категорией становится первая по порядку
 * реестра — тот порядок, который задавался вручную в менеджере меток, то есть
 * самая «главная» из них. Остальные отбрасываются.
 */
function migrateFromTags(rawTags: unknown, parsed: ParsedItem[]): LoadedState {
  const categories: Category[] = []
  /** Старый id метки → её позиция в реестре. */
  const order = new Map<string, number>()

  if (Array.isArray(rawTags)) {
    for (const entry of rawTags) {
      const tag = parseCategory(entry)
      // Дубликаты id в реестре сломали бы выбор категории по метке.
      if (!tag || order.has(tag.id)) continue

      order.set(tag.id, categories.length)
      categories.push({ id: `${CATEGORY_ID_PREFIX}${categories.length + 1}`, name: tag.name })
    }
  }

  const items = parsed.map(({ item, legacyTagIds }) => {
    let best = -1

    for (const tagId of legacyTagIds) {
      const index = order.get(tagId)
      // Метка, которой нет в реестре, — след неудачного удаления или ручной
      // правки хранилища. Показать её нечем, поэтому просто пропускаем.
      if (index === undefined) continue
      if (best === -1 || index < best) best = index
    }

    const category = best === -1 ? undefined : categories[best]
    return { ...item, categoryId: category?.id ?? UNCATEGORIZED }
  })

  return { items, categories, nextCategoryId: categories.length + 1 }
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

    const stored = payload as Partial<StoredPayload> & { tags?: unknown }
    const { version, items, categories, nextCategoryId } = stored
    if (!Array.isArray(items)) return emptyState()

    const parsed = items.map(parseItem).filter((entry): entry is ParsedItem => entry !== null)

    // v1 — те же записи, но без разметки: реестр пуст, `parseItem` уже проставил
    // всем `UNCATEGORIZED`. Форма записи не менялась, отдельной ветки не нужно.
    if (version === 1) return { ...emptyState(), items: parsed.map((entry) => entry.item) }

    if (version === 2) return migrateFromTags(stored.tags, parsed)
    if (version !== STORAGE_VERSION) return emptyState()

    const parsedCategories = Array.isArray(categories)
      ? categories.map(parseCategory).filter((category): category is Category => category !== null)
      : []

    // Дубликаты id в реестре сломали бы и выбор категории, и переименование.
    const known = new Set<string>()
    const uniqueCategories = parsedCategories.filter((category) => {
      if (known.has(category.id)) return false
      known.add(category.id)
      return true
    })

    const parsedItems = parsed.map(({ item }) =>
      // Категория, которой нет в реестре, — след неудачного удаления или ручной
      // правки хранилища: тайтл возвращается в «Без категории», а не пропадает.
      known.has(item.categoryId) ? item : { ...item, categoryId: UNCATEGORIZED },
    )

    // Счётчик подтягиваем вверх, если в хранилище он оказался меньше уже
    // выданных id: иначе следующая категория затёрла бы существующую.
    const maxUsed = uniqueCategories.reduce(
      (max, category) => Math.max(max, categoryIdNumber(category.id)),
      0,
    )
    const storedNext =
      typeof nextCategoryId === 'number' && Number.isInteger(nextCategoryId) ? nextCategoryId : 1

    return {
      items: parsedItems,
      categories: uniqueCategories,
      nextCategoryId: Math.max(storedNext, maxUsed + 1),
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

  /** Порядок массива — это и порядок плиток на странице избранного. */
  const categories = ref<Category[]>(stored.categories)

  const nextCategoryId = ref(stored.nextCategoryId)

  /** Set в computed, чтобы `isFavorite` в каждой карточке был O(1), а не перебором. */
  const keys = computed(() => new Set(items.value.map(keyOf)))

  const count = computed(() => items.value.length)

  /**
   * Счётчики по всем категориям сразу, включая `UNCATEGORIZED`: считать их
   * по одному на каждой плитке значило бы проходить коллекцию столько раз,
   * сколько категорий.
   */
  const categoryCounts = computed(() => {
    const counts = new Map<string, number>()

    for (const item of items.value) {
      counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1)
    }

    return counts
  })

  function isFavorite(mediaType: MediaType, id: number): boolean {
    return keys.value.has(`${mediaType}:${id}`)
  }

  function findItem(mediaType: MediaType, id: number): FavoriteItem | undefined {
    return items.value.find((item) => item.mediaType === mediaType && item.id === id)
  }

  function itemCategoryId(mediaType: MediaType, id: number): string {
    return findItem(mediaType, id)?.categoryId ?? UNCATEGORIZED
  }

  /** Порядок сохраняется: свежедобавленные идут первыми, как и во всей коллекции. */
  function itemsInCategory(categoryId: string): FavoriteItem[] {
    return items.value.filter((item) => item.categoryId === categoryId)
  }

  /**
   * Единственная точка записи в `items`. Вотчер ниже поверхностный, поэтому
   * массив обязан заменяться целиком: `item.categoryId = ...` тихо не
   * сохранился бы.
   */
  function updateItems(update: (items: FavoriteItem[]) => FavoriteItem[]): void {
    items.value = update(items.value)
  }

  function add(item: MediaItem): void {
    if (keys.value.has(keyOf(item))) return

    // Новое кладём в начало: избранное читается как лента последних добавлений.
    updateItems((current) => [{ ...item, categoryId: UNCATEGORIZED }, ...current])
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

  function hasCategory(categoryId: string): boolean {
    return categories.value.some((category) => category.id === categoryId)
  }

  function setItemCategory(mediaType: MediaType, id: number, categoryId: string): void {
    const key = `${mediaType}:${id}`
    const next = hasCategory(categoryId) ? categoryId : UNCATEGORIZED

    updateItems((current) =>
      current.map((item) => (keyOf(item) === key ? { ...item, categoryId: next } : item)),
    )
  }

  function normalizeName(name: string): string {
    return name.trim().slice(0, CATEGORY_NAME_MAX_LENGTH)
  }

  function findByName(name: string): Category | undefined {
    const lowered = name.toLocaleLowerCase('ru')
    return categories.value.find((category) => category.name.toLocaleLowerCase('ru') === lowered)
  }

  /**
   * Совпадение имени без учёта регистра возвращает существующую категорию, а не
   * заводит вторую: «marvel» и «Marvel» — это одно и то же, и разъехавшиеся
   * дубли пришлось бы потом сливать вручную.
   *
   * @returns `null`, если имя пустое.
   */
  function createCategory(name: string): Category | null {
    const normalized = normalizeName(name)
    if (!normalized) return null

    const existing = findByName(normalized)
    if (existing) return existing

    const category: Category = {
      id: `${CATEGORY_ID_PREFIX}${nextCategoryId.value}`,
      name: normalized,
    }
    nextCategoryId.value += 1
    // Новая встаёт в конец: порядок категорий — это порядок их появления.
    categories.value = [...categories.value, category]

    return category
  }

  function renameCategory(id: string, name: string): void {
    const normalized = normalizeName(name)
    if (!normalized) return

    // Переименование в имя соседней категории слило бы две визуально, оставив
    // их разными по id. Молча отказываемся, вызывающий покажет ошибку.
    const existing = findByName(normalized)
    if (existing && existing.id !== id) return

    categories.value = categories.value.map((category) =>
      category.id === id ? { ...category, name: normalized } : category,
    )
  }

  /** Тайтлы остаются в избранном — они переезжают в «Без категории». */
  function deleteCategory(id: string): void {
    categories.value = categories.value.filter((category) => category.id !== id)
    updateItems((current) =>
      current.map((item) =>
        item.categoryId === id ? { ...item, categoryId: UNCATEGORIZED } : item,
      ),
    )
  }

  // Массивы заменяются целиком, а не мутируются, поэтому deep-вотчер не нужен.
  watch([items, categories, nextCategoryId], () => {
    persist({
      items: items.value,
      categories: categories.value,
      nextCategoryId: nextCategoryId.value,
    })
  })

  return {
    items,
    categories,
    count,
    categoryCounts,
    isFavorite,
    itemCategoryId,
    itemsInCategory,
    hasCategory,
    add,
    remove,
    toggle,
    setItemCategory,
    createCategory,
    renameCategory,
    deleteCategory,
  }
})
