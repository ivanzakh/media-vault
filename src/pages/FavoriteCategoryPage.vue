<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mdiArrowLeft, mdiFolderOutline } from '@mdi/js'

import MediaGrid from '@/components/MediaGrid.vue'
import { useFavoritesStore } from '@/stores/favorites'
import { UNCATEGORIZED } from '@/types/favorites'
import {
  filterFavorites,
  hasActiveFavoritesFilters,
  isFavoritesSortKey,
  parseFavoritesQuery,
  sortFavorites,
  toFavoritesQuery,
  DEFAULT_FAVORITES_TYPE,
  type FavoritesFilters,
  type FavoritesSortKey,
  type FavoritesType,
} from '@/utils/favorites'
import { formatNumber, plural } from '@/utils/format'

const TYPE_OPTIONS: { value: FavoritesType; title: string }[] = [
  { value: 'all', title: 'Все' },
  { value: 'movie', title: 'Фильмы' },
  { value: 'tv', title: 'Сериалы' },
]

const SORT_OPTIONS: { value: FavoritesSortKey; title: string }[] = [
  { value: 'added', title: 'По добавлению' },
  { value: 'title', title: 'По названию' },
  { value: 'year', title: 'По году' },
  { value: 'rating', title: 'По рейтингу' },
]

const route = useRoute()
const router = useRouter()

const favorites = useFavoritesStore()

const categoryId = computed(() => String(route.params.categoryId ?? ''))

/** `null` — такой категории нет: адрес открыли вручную или её только что удалили. */
const name = computed(() => {
  if (categoryId.value === UNCATEGORIZED) return 'Без категории'
  return favorites.categories.find((category) => category.id === categoryId.value)?.name ?? null
})

/*
  Категорию могли удалить прямо сейчас или открыть старую ссылку на давно
  удалённую — в обоих случаях показывать нечего, а «здесь пусто» не объясняет
  почему. Возвращаем к списку категорий.

  replace, а не push: несуществующий адрес — не шаг истории, и «назад» не
  должно возвращать в него.
*/
watch(
  name,
  (value) => {
    if (route.name !== 'favorites-category') return
    if (value === null) router.replace({ name: 'favorites' })
  },
  { immediate: true },
)

/**
 * Источник правды — URL, как в каталоге и поиске: бесплатно даёт «назад/вперёд»,
 * перезагрузку и ссылку на подборку, которой можно поделиться. Сама категория
 * при этом в параметрах пути, а не в запросе — это адрес, а не настройка.
 */
const filters = computed(() => parseFavoritesQuery(route.query))

/** Всё, что лежит в категории: порядок хранения, последний добавленный первым. */
const categoryItems = computed(() => favorites.itemsInCategory(categoryId.value))

const visibleItems = computed(() =>
  sortFavorites(filterFavorites(categoryItems.value, filters.value), filters.value.sort),
)

/**
 * Переключатель типа осмыслен только в смешанной категории. Там, где лежат одни
 * сериалы, «Все» и «Сериалы» дают одну и ту же выдачу, а «Фильмы» — гарантированно
 * пустую: три кнопки на два бессмысленных исхода.
 */
const hasBothTypes = computed(
  () =>
    categoryItems.value.some((item) => item.mediaType === 'movie') &&
    categoryItems.value.some((item) => item.mediaType === 'tv'),
)

/*
  Раз переключателя может не быть, фильтр по типу нельзя оставлять включённым:
  он стал бы невидимым и неснимаемым, а выдача при этом пустой. Состояние
  возникает обоими путями — из смешанной категории убрали последний фильм, или
  ссылку `?type=movie` открыли на подборке из одних сериалов.

  replace, а не push: чужой фильтр — не шаг истории, и «назад» не должно
  возвращать в него.
*/
watch(
  [hasBothTypes, () => filters.value.type],
  ([bothTypes, type]) => {
    if (route.name !== 'favorites-category' || name.value === null) return
    if (bothTypes || type === DEFAULT_FAVORITES_TYPE) return

    router.replace({
      name: 'favorites-category',
      params: { categoryId: categoryId.value },
      query: toFavoritesQuery({ ...filters.value, type: DEFAULT_FAVORITES_TYPE }),
    })
  },
  { immediate: true },
)

const countText = computed(() => {
  const total = categoryItems.value.length
  const shown = visibleItems.value.length
  const suffix = plural(shown, ['тайтл', 'тайтла', 'тайтлов'])

  // Пока фильтр не применён, «12 из 12» выглядело бы как ошибка.
  return shown === total
    ? `${formatNumber(total)} ${suffix}`
    : `${formatNumber(shown)} из ${formatNumber(total)} ${suffix}`
})

const filtersApplied = computed(() => hasActiveFavoritesFilters(filters.value))

/**
 * Пусто именно из-за фильтра, а не потому, что категория пуста. Проверяем по
 * факту, а не по `filtersApplied`: сортировка тоже считается активным фильтром,
 * но выдачу не сокращает — в пустой категории с `?sort=title` иначе показалось
 * бы «по этому фильтру ничего нет».
 */
const emptiedByFilters = computed(
  () => categoryItems.value.length > 0 && visibleItems.value.length === 0,
)

function apply(patch: Partial<FavoritesFilters>): void {
  router.push({
    name: 'favorites-category',
    params: { categoryId: categoryId.value },
    query: toFavoritesQuery({ ...filters.value, ...patch }),
  })
}

function onTypeChange(value: unknown): void {
  if (value === 'all' || value === 'movie' || value === 'tv') apply({ type: value })
}

function onSortChange(value: unknown): void {
  if (isFavoritesSortKey(value)) apply({ sort: value })
}

function resetFilters(): void {
  router.push({ name: 'favorites-category', params: { categoryId: categoryId.value } })
}
</script>

<template>
  <!-- v-if по имени: пока вотчер выше не увёл на список, рисовать пустую
       страницу несуществующей категории не нужно. -->
  <v-container v-if="name" class="py-6">
    <div class="d-flex align-center flex-wrap ga-2 mb-4">
      <!--
        Ссылка на список, а не router.back(): на страницу заходят и по прямой
        ссылке, и тогда «назад» увело бы из приложения.
      -->
      <v-btn
        :icon="mdiArrowLeft"
        :to="{ name: 'favorites' }"
        variant="text"
        aria-label="К категориям"
      />

      <h1 class="text-headline-small">{{ name }}</h1>
      <span class="text-body-medium text-medium-emphasis">{{ countText }}</span>
    </div>

    <!--
      Фильтры встроены в шапку, а не спрятаны в диалог, как в каталоге: их всего
      два, и прятать их за кнопкой «Фильтры» дороже, чем показать.

      Прячем целиком, пока категория пуста: переключать нечего, а ряд элементов
      управления над пустым состоянием выглядит как поломка.
    -->
    <div v-if="categoryItems.length" class="d-flex align-center flex-wrap ga-3 mb-4">
      <!-- Только для смешанной категории: см. `hasBothTypes`. -->
      <v-btn-toggle
        v-if="hasBothTypes"
        :model-value="filters.type"
        mandatory
        density="compact"
        variant="outlined"
        divided
        @update:model-value="onTypeChange"
      >
        <v-btn v-for="option in TYPE_OPTIONS" :key="option.value" :value="option.value">
          {{ option.title }}
        </v-btn>
      </v-btn-toggle>

      <v-spacer class="d-none d-sm-block" />

      <v-select
        :model-value="filters.sort"
        :items="SORT_OPTIONS"
        label="Сортировка"
        density="compact"
        variant="outlined"
        hide-details
        class="sort-select"
        @update:model-value="onSortChange"
      />

      <v-btn v-if="filtersApplied" variant="text" size="small" @click="resetFilters">
        Сбросить
      </v-btn>
    </div>

    <MediaGrid
      :items="visibleItems"
      with-category
      :empty-icon="mdiFolderOutline"
      :empty-title="emptiedByFilters ? 'По этому фильтру ничего нет' : 'В этой категории пусто'"
      :empty-text="
        emptiedByFilters
          ? 'Попробуйте снять ограничение по типу.'
          : 'Откройте тайтл в избранном и выберите эту категорию — он появится здесь.'
      "
    >
      <template #empty-actions>
        <v-btn v-if="emptiedByFilters" variant="tonal" @click="resetFilters">
          Сбросить фильтры
        </v-btn>
        <v-btn v-else :to="{ name: 'favorites' }" variant="tonal">К категориям</v-btn>
      </template>
    </MediaGrid>
  </v-container>
</template>

<style scoped>
/*
  Селект без ширины растянулся бы на весь остаток строки. Фиксированная ширина
  оставляет его в одном ряду с переключателем типа даже на 390 px — иначе ряд
  разъезжается на две строки и шапка растёт ровно там, где место дороже всего.
*/
.sort-select {
  max-width: 200px;
}
</style>
