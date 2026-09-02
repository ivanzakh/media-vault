import { ref } from 'vue'
import { defineStore } from 'pinia'

import { getGenres } from '@/api/media'
import type { Genre, MediaType } from '@/api/types'

/**
 * Справочник жанров: два словаря, по одному на тип. ID у фильмов и сериалов не
 * пересекаются (у фильмов `28 Боевик`, у сериалов `10759 Боевик и приключения`),
 * поэтому храним их раздельно и при смене типа выбор жанров сбрасывается.
 *
 * За сессию словарь не меняется, так что кешируем его до перезагрузки вкладки и
 * грузим лениво — при первом показе фильтров, а не на старте приложения.
 */
export const useGenresStore = defineStore('genres', () => {
  const byType = ref<Record<MediaType, Genre[]>>({ movie: [], tv: [] })
  const loading = ref<Record<MediaType, boolean>>({ movie: false, tv: false })
  const error = ref<string | null>(null)

  /*
    Промис на время полёта: два компонента, спросившие жанры одновременно (панель
    фильтров и её же копия в мобильном диалоге), не должны отправить два
    одинаковых запроса.
  */
  const inFlight = new Map<MediaType, Promise<void>>()

  /*
    AbortSignal здесь намеренно нет. Запрос общий и кладётся в кеш, а отмена по
    уходу одного компонента оставила бы словарь пустым для всех остальных.
    Запрос ровно один за сессию, отменять нечего.
  */
  function ensureLoaded(type: MediaType): Promise<void> {
    if (byType.value[type].length) return Promise.resolve()

    const pending = inFlight.get(type)
    if (pending) return pending

    const request = (async () => {
      loading.value[type] = true
      error.value = null
      try {
        byType.value[type] = await getGenres(type)
      } catch (e) {
        console.error(e)
        error.value = 'Не удалось загрузить список жанров'
      } finally {
        loading.value[type] = false
        inFlight.delete(type)
      }
    })()

    inFlight.set(type, request)
    return request
  }

  return { byType, loading, error, ensureLoaded }
})
