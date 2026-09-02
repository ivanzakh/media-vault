<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { searchMedia } from '@/api/media'
import MediaGrid from '@/components/MediaGrid.vue'
import { MAX_PAGES, PAGE_SIZE, usePagedList } from '@/composables/usePagedList'
import { formatNumber, plural } from '@/utils/format'
import { firstValue } from '@/utils/query'

const route = useRoute()
const router = useRouter()

/**
 * Источник правды — URL. Это бесплатно даёт рабочие «назад/вперёд»,
 * перезагрузку страницы и ссылку, которой можно поделиться.
 */
const query = computed(() => firstValue(route.query.q).trim())

// URL правит кто угодно, поэтому номер страницы разбираем защитно.
const page = computed(() => {
  const parsed = Number.parseInt(firstValue(route.query.page), 10)
  if (!Number.isInteger(parsed) || parsed < 1) return 1
  return Math.min(parsed, MAX_PAGES)
})

const { items, totalResults, pageCount, loading, error, load, reset } = usePagedList((signal) =>
  searchMedia(query.value, page.value, signal),
)

function run() {
  if (query.value) load()
  else reset()
}

// Загрузка следует за параметрами маршрута, а не за кликами по пагинатору:
// тогда F5 и переход по истории работают сами собой.
watch([query, page], run, { immediate: true })

function goToPage(value: number) {
  router.push({ name: 'search', query: { q: query.value, page: value } })
}

const foundText = computed(
  () =>
    `Найдено ${formatNumber(totalResults.value)} ` +
    plural(totalResults.value, ['результат', 'результата', 'результатов']),
)

/** Последняя страница выдачи бывает неполной — скелетонов рисуем по факту. */
const skeletonCount = computed(() => {
  if (totalResults.value === 0) return PAGE_SIZE
  const remaining = totalResults.value - (page.value - 1) * PAGE_SIZE
  return Math.min(PAGE_SIZE, Math.max(remaining, 1))
})
</script>

<template>
  <v-container class="py-6">
    <template v-if="query">
      <div class="d-flex align-baseline flex-wrap ga-3 mb-4">
        <h1 class="text-headline-small">{{ query }}</h1>
        <span
          v-if="!loading && !error && totalResults > 0"
          class="text-body-medium text-medium-emphasis"
        >
          {{ foundText }}
        </span>
      </div>

      <MediaGrid
        :items="items"
        :loading="loading"
        :error="error"
        :skeleton-count="skeletonCount"
        empty-title="Ничего не найдено"
        empty-text="Проверьте раскладку и попробуйте другое название."
        @retry="run"
      />

      <!--
        Число страниц клампится потолком TMDB в 500: при широком запросе
        total_results уходит в десятки тысяч, но страницы после 500-й вернут ошибку.
      -->
      <div v-if="!loading && !error && pageCount > 1" class="d-flex justify-center mt-8">
        <v-pagination
          :model-value="page"
          :length="pageCount"
          density="comfortable"
          rounded="circle"
          @update:model-value="goToPage"
        />
      </div>
    </template>

    <v-empty-state
      v-else
      title="Что ищем?"
      text="Введите название фильма или сериала в поле в шапке."
    />
  </v-container>
</template>
