import { computed, onScopeDispose, ref, shallowRef } from 'vue'

import { isAbortError } from '@/api/client'
import type { Paginated } from '@/api/types'

/** Размер страницы у TMDB фиксирован и не настраивается параметром. */
export const PAGE_SIZE = 20

/**
 * TMDB отказывается отдавать страницы с номером больше 500: `page=501`
 * возвращает ошибку `page must be less than or equal to 500`. В спецификации
 * этого потолка нет, поэтому на него легко напороться — считаем число страниц
 * с оглядкой на него, иначе пагинатор нарисует страницы, которые дадут ошибку.
 */
export const MAX_PAGES = 500

/**
 * Загрузка одной страницы списка: отмена предыдущего запроса, защита от гонок
 * и число страниц с учётом потолка TMDB.
 *
 * `fetcher` получает `signal` — это будущая точка входа vue-query: тело
 * композабла заменится на `useQuery`, а сам `fetcher` останется как `queryFn`.
 */
export function usePagedList<T>(fetcher: (signal: AbortSignal) => Promise<Paginated<T>>) {
  // Список заменяется целиком, глубокая реактивность на нём только тратит время.
  const items = shallowRef<T[]>([])
  const totalResults = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  /** Сколько страниц реально доступно: не больше 500 × 20 = 10 000 элементов. */
  const pageCount = computed(() =>
    Math.ceil(Math.min(totalResults.value, MAX_PAGES * PAGE_SIZE) / PAGE_SIZE),
  )

  let controller: AbortController | undefined

  async function load() {
    controller?.abort()
    const current = new AbortController()
    controller = current

    loading.value = true
    error.value = null

    try {
      const data = await fetcher(current.signal)
      if (controller !== current) return
      items.value = data.results
      totalResults.value = data.total_results
    } catch (e) {
      if (controller !== current || isAbortError(e)) return
      console.error(e)
      items.value = []
      totalResults.value = 0
      error.value = 'Не удалось загрузить результаты'
    } finally {
      // Отменённый запрос не гасит спиннер: следующий уже летит.
      if (controller === current) loading.value = false
    }
  }

  /** Сброс без запроса — например, когда в URL пустой поисковый запрос. */
  function reset() {
    controller?.abort()
    controller = undefined
    items.value = []
    totalResults.value = 0
    loading.value = false
    error.value = null
  }

  onScopeDispose(() => controller?.abort())

  return { items, totalResults, pageCount, loading, error, load, reset }
}
