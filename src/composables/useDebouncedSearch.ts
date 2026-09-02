import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'

import { isAbortError } from '@/api/client'
import { searchMulti } from '@/api/media'
import { isMediaResult, type MediaItem } from '@/api/types'
import { toMediaItem } from '@/utils/format'

const SUGGESTION_LIMIT = 8

/**
 * Ввод → подсказки, с тремя вещами, которые легко сделать неправильно:
 * отменить предыдущий запрос, не дать устаревшему ответу перезаписать свежий
 * и корректно погасить `loading`.
 */
export function useDebouncedSearch(delay = 300, minLength = 2) {
  const query = ref('')
  // Список заменяется целиком, глубокая реактивность на нём только тратит время.
  const results = shallowRef<MediaItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /** Запрос достаточно длинный, чтобы показывать подсказки. */
  const isActive = computed(() => query.value.trim().length >= minLength)

  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined

  watch(query, (value) => {
    clearTimeout(timer)
    controller?.abort()
    controller = undefined

    const trimmed = value.trim()
    error.value = null

    if (trimmed.length < minLength) {
      results.value = []
      loading.value = false
      return
    }

    // Спиннер зажигается сразу, ещё до истечения дебаунса: пользователь уже
    // ждёт результат, и пауза без индикации читается как зависание.
    loading.value = true

    timer = setTimeout(async () => {
      const current = new AbortController()
      controller = current

      try {
        const data = await searchMulti(trimmed, 1, current.signal)
        // Защита от гонки: пока летел этот запрос, мог стартовать следующий.
        if (controller !== current) return
        results.value = data.results
          .filter(isMediaResult)
          .map(toMediaItem)
          .slice(0, SUGGESTION_LIMIT)
      } catch (e) {
        if (controller !== current || isAbortError(e)) return
        console.error(e)
        error.value = 'Не удалось загрузить подсказки'
      } finally {
        // Без этой проверки отменённый запрос погасил бы спиннер,
        // пока следующий ещё летит, и индикатор мигал бы.
        if (controller === current) loading.value = false
      }
    }, delay)
  })

  onScopeDispose(() => {
    clearTimeout(timer)
    controller?.abort()
  })

  return { query, results, loading, error, isActive }
}
