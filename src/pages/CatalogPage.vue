<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mdiClose, mdiTune } from '@mdi/js'
import { useDisplay } from 'vuetify'

import { discover } from '@/api/media'
import CatalogFiltersPanel from '@/components/CatalogFilters.vue'
import MediaGrid from '@/components/MediaGrid.vue'
import { PAGE_SIZE, usePagedList } from '@/composables/usePagedList'
import {
  DEFAULT_SORT,
  parseCatalogQuery,
  toCatalogQuery,
  type CatalogFilters,
} from '@/utils/catalog'
import { formatNumber, plural } from '@/utils/format'

const route = useRoute()
const router = useRouter()
/*
  Порог не smAndDown: в Vuetify 4 это ниже 840px, а v-container там ещё узкий
  (700px до 1145px). Панель сбоку начинается там же, где контейнер расширяется
  до 1000px, — раньше она зажала бы выдачу до двух колонок.
*/
const { mdAndDown } = useDisplay()

/**
 * Источник правды — URL: «назад», F5 и вставленная ссылка работают сами собой,
 * а панель фильтров ничего не хранит и только делает `router.push`.
 */
const filters = computed(() => parseCatalogQuery(route.query))

const { items, totalResults, pageCount, loading, error, load } = usePagedList((signal) =>
  discover(filters.value, signal),
)

/*
  Загрузка следует за параметрами маршрута, а не за кликами по фильтрам.

  Проверка имени маршрута обязательна: при уходе на другую страницу route
  обновляется раньше, чем компонент размонтируется, и вотчер успел бы отправить
  ещё один запрос каталога — с параметрами чужой страницы в URL.
*/
watch(
  filters,
  () => {
    if (route.name === 'home') load()
  },
  { immediate: true },
)

function applyPatch(patch: Partial<Omit<CatalogFilters, 'page'>>) {
  // Любое изменение фильтра сбрасывает страницу: в новой выборке 40-й страницы
  // может не быть вовсе, и пользователь упёрся бы в пустой экран.
  router.push({ name: 'home', query: toCatalogQuery({ ...filters.value, ...patch, page: 1 }) })
}

function goToPage(page: number) {
  router.push({ name: 'home', query: toCatalogQuery({ ...filters.value, page }) })
}

function resetFilters() {
  // Тип переживает сброс: «Сериалы» — выбранная сущность, а не фильтр, и
  // возвращать пользователя к фильмам он не просил.
  const query = toCatalogQuery({
    type: filters.value.type,
    sort: DEFAULT_SORT,
    genreIds: [],
    yearFrom: null,
    yearTo: null,
    page: 1,
  })

  router.push({ name: 'home', query })
}

const heading = computed(() => (filters.value.type === 'movie' ? 'Фильмы' : 'Сериалы'))

const foundText = computed(
  () =>
    `Найдено ${formatNumber(totalResults.value)} ` +
    plural(totalResults.value, ['результат', 'результата', 'результатов']),
)

/** Последняя страница выдачи бывает неполной — скелетонов рисуем по факту. */
const skeletonCount = computed(() => {
  if (totalResults.value === 0) return PAGE_SIZE
  const remaining = totalResults.value - (filters.value.page - 1) * PAGE_SIZE
  return Math.min(PAGE_SIZE, Math.max(remaining, 1))
})

/*
  На узком экране панель уезжает в полноэкранный диалог: развёрнутая, она съедает
  весь первый экран, и до самой выдачи пришлось бы прокручивать.
*/
const filtersDialog = ref(false)

/** Сколько фильтров отличается от значений по умолчанию — для бейджа на кнопке. */
const activeFilterCount = computed(() => {
  const { sort, genreIds, yearFrom, yearTo } = filters.value
  let count = 0
  if (sort !== DEFAULT_SORT) count += 1
  if (genreIds.length) count += 1
  if (yearFrom !== null || yearTo !== null) count += 1
  return count
})
</script>

<template>
  <v-container class="py-6">
    <div class="d-flex align-center flex-wrap ga-3 mb-4">
      <h1 class="text-headline-small">{{ heading }}</h1>

      <!--
        Место под текст занято уже во время загрузки: иначе на мобилке он
        появляется после ответа сервера, строка переносится и кнопка «Фильтры»
        прыгает вниз.
      -->
      <v-skeleton-loader
        v-if="loading"
        type="text"
        class="catalog-found-skeleton"
        aria-hidden="true"
      />
      <span v-else-if="!error && totalResults > 0" class="text-body-medium text-medium-emphasis">
        {{ foundText }}
      </span>

      <v-spacer />

      <v-badge
        v-if="mdAndDown"
        :model-value="activeFilterCount > 0"
        :content="activeFilterCount"
        color="primary"
      >
        <v-btn :prepend-icon="mdiTune" variant="tonal" @click="filtersDialog = true">
          Фильтры
        </v-btn>
      </v-badge>
    </div>

    <div class="catalog-layout">
      <!--
        Панель сбоку, а не полосой над выдачей: фильтры остаются на виду при
        прокрутке, и менять их можно, не возвращаясь к началу страницы.
      -->
      <aside v-if="!mdAndDown" class="catalog-sidebar">
        <v-sheet color="surface" border rounded="lg" class="pa-4">
          <CatalogFiltersPanel
            :type="filters.type"
            :sort="filters.sort"
            :genre-ids="filters.genreIds"
            :year-from="filters.yearFrom"
            :year-to="filters.yearTo"
            @change="applyPatch"
            @reset="resetFilters"
          />
        </v-sheet>
      </aside>

      <div>
        <MediaGrid
          :items="items"
          :loading="loading"
          :error="error"
          :skeleton-count="skeletonCount"
          empty-title="Под фильтры ничего не подошло"
          empty-text="Расширьте диапазон лет или снимите часть жанров."
          @retry="load"
        />

        <!-- Число страниц клампится потолком TMDB в 500: у широкой выборки
             total_results уходит в сотни тысяч, но 501-я страница вернёт ошибку. -->
        <div v-if="!loading && !error && pageCount > 1" class="mt-8">
          <v-pagination
            :model-value="filters.page"
            :length="pageCount"
            density="comfortable"
            rounded="circle"
            @update:model-value="goToPage"
          />
        </div>
      </div>
    </div>

    <v-dialog v-if="mdAndDown" v-model="filtersDialog" fullscreen scrollable>
      <v-card>
        <v-toolbar color="surface" title="Фильтры" density="comfortable">
          <!-- Через #append, а не дефолтный слот: иначе кнопка встала бы вплотную
               к заголовку, а не у правого края. -->
          <template #append>
            <v-btn :icon="mdiClose" aria-label="Закрыть" @click="filtersDialog = false" />
          </template>
        </v-toolbar>

        <v-card-text>
          <CatalogFiltersPanel
            :type="filters.type"
            :sort="filters.sort"
            :genre-ids="filters.genreIds"
            :year-from="filters.yearFrom"
            :year-to="filters.yearTo"
            @change="applyPatch"
            @reset="resetFilters"
          />
        </v-card-text>

        <v-card-actions class="justify-end pa-4">
          <v-btn variant="flat" color="primary" @click="filtersDialog = false">Показать</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
/* Ширина под типичный текст «Найдено 1 234 результата». */
.catalog-found-skeleton {
  width: 190px;
  background: transparent;
}

.catalog-found-skeleton :deep(.v-skeleton-loader__text) {
  margin: 0;
}

.catalog-layout {
  display: grid;
  /*
    280px хватает на сегментный переключатель и на чипы жанров по два в ряд;
    minmax(0, 1fr) у выдачи обязателен — иначе сетка постеров не даёт колонке
    сжаться ниже своей минимальной ширины и раскладку распирает вправо.
  */
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 24px;
  /* Иначе колонка панели растянулась бы на всю высоту выдачи. */
  align-items: start;
}

/*
  Ширина панели подобрана под число колонок в выдаче, а не на глаз.

  На широком контейнере (v-container от 1545px даёт 1400px, то есть 1368px
  содержимого) панель в 280px оставляет сетке 1064px, и в ряд встаёт шесть
  карточек: страница в 20 штук ложится в три ряда плюс два огрызка. Панель в
  380px оставляет 964px — шестая колонка (980px) уже не влезает, остаётся пять,
  и страница делится ровно на четыре ряда.

  Ниже этого порога контейнер сужается до 1000px, и там панель остаётся узкой:
  при 380px сетке досталось бы 564px, то есть всего три колонки.
*/
@media (min-width: 1545px) {
  .catalog-layout {
    grid-template-columns: 380px minmax(0, 1fr);
  }
}

.catalog-sidebar {
  /*
    64px высота шапки плюс отступ. Панель едет вместе со страницей, пока не
    упрётся в шапку, и дальше остаётся на месте.
  */
  position: sticky;
  top: 80px;
  /* Панель выше экрана иначе прятала бы ползунок лет под нижним краем. */
  max-height: calc(100vh - 96px);
  overflow-y: auto;
}

/*
  Тот же порог, что и mdAndDown в скрипте (брейкпоинт lg в Vuetify 4 — 1145px):
  ниже него панель уезжает в диалог, и вторая колонка исчезает вместе с ней —
  без этого от неё осталась бы дыра во всю высоту выдачи.
*/
@media (max-width: 1144.98px) {
  .catalog-layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
