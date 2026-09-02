<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mdiHeartOutline, mdiTagMultipleOutline, mdiTagOutline } from '@mdi/js'

import FavoriteTagBar from '@/components/FavoriteTagBar.vue'
import MediaGrid from '@/components/MediaGrid.vue'
import TagManagerDialog from '@/components/TagManagerDialog.vue'
import { useFavoritesStore } from '@/stores/favorites'
import {
  filterFavorites,
  hasActiveFavoritesFilters,
  isFavoritesSortKey,
  parseFavoritesQuery,
  sortFavorites,
  toFavoritesQuery,
  UNTAGGED,
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

/**
 * Источник правды — URL, как в каталоге и поиске: бесплатно даёт «назад/вперёд»,
 * перезагрузку и ссылку на подборку, которой можно поделиться.
 */
const filters = computed(() => parseFavoritesQuery(route.query))

const managerOpen = ref(false)

/*
  Метку могли удалить в диалоге прямо сейчас или открыть старую ссылку на давно
  удалённую — в обоих случаях в URL остаётся id, которому ничего не
  соответствует, и выдача схлопывается в пустоту без объяснений. Чистим набор,
  а не показываем «ничего не найдено».

  replace, а не push: несуществующий фильтр — не шаг истории, и «назад» не
  должно возвращать в него.
*/
watch([() => filters.value.tagIds, () => favorites.tags], ([tagIds]) => {
  if (route.name !== 'favorites' || !tagIds.length) return

  const known = new Set(favorites.tags.map((tag) => tag.id))
  const alive = tagIds.filter((tagId) => tagId === UNTAGGED || known.has(tagId))
  if (alive.length === tagIds.length) return

  router.replace({ name: 'favorites', query: toFavoritesQuery({ ...filters.value, tagIds: alive }) })
})

/*
  Охранника `route.name === 'favorites'`, как в каталоге, здесь не нужно: там он
  отменял лишний запрос к API при уходе со страницы, а тут всё вычисляется из
  памяти и лишний пересчёт ничего не стоит.
*/
const visibleItems = computed(() =>
  sortFavorites(filterFavorites(favorites.items, filters.value), filters.value.sort),
)

const countText = computed(() => {
  const total = favorites.count
  const shown = visibleItems.value.length
  const suffix = plural(shown, ['тайтл', 'тайтла', 'тайтлов'])

  // Пока фильтр не применён, «127 из 127» выглядело бы как ошибка.
  return shown === total
    ? `${formatNumber(total)} ${suffix}`
    : `${formatNumber(shown)} из ${formatNumber(total)} ${suffix}`
})

const filtersApplied = computed(() => hasActiveFavoritesFilters(filters.value))

function apply(patch: Partial<FavoritesFilters>): void {
  router.push({ name: 'favorites', query: toFavoritesQuery({ ...filters.value, ...patch }) })
}

function onTypeChange(value: unknown): void {
  if (value === 'all' || value === 'movie' || value === 'tv') apply({ type: value })
}

function onSortChange(value: unknown): void {
  if (isFavoritesSortKey(value)) apply({ sort: value })
}

function resetFilters(): void {
  router.push({ name: 'favorites' })
}
</script>

<template>
  <v-container class="py-6">
    <div class="d-flex align-center flex-wrap ga-3 mb-4">
      <h1 class="text-headline-small">Избранное</h1>
      <span v-if="favorites.count" class="text-body-medium text-medium-emphasis">
        {{ countText }}
      </span>

      <v-spacer />

      <v-btn
        v-if="favorites.count"
        :prepend-icon="mdiTagMultipleOutline"
        variant="text"
        size="small"
        @click="managerOpen = true"
      >
        Метки
      </v-btn>
    </div>

    <TagManagerDialog v-model="managerOpen" />

    <!--
      Фильтры встроены в шапку, а не спрятаны в сайдбар с полноэкранным диалогом,
      как в каталоге: здесь их всего три, и главный — метки, ради которых на
      страницу и заходят. Прятать их за кнопкой «Фильтры» значило бы прятать
      навигацию по коллекции.
    -->
    <template v-if="favorites.count">
      <!-- Меток ещё нет: полоса пуста, и вместо неё нужна подсказка, откуда они
           берутся — иначе способ разложить коллекцию просто не виден. -->
      <p v-if="!favorites.tags.length" class="text-body-medium text-medium-emphasis mb-3">
        Меток пока нет. Нажмите
        <v-icon :icon="mdiTagOutline" size="16" class="mx-1" />
        на карточке, чтобы разложить коллекцию по своим категориям.
      </p>

      <FavoriteTagBar
        v-else
        :tag-ids="filters.tagIds"
        class="mb-3"
        @change="(tagIds) => apply({ tagIds })"
      />

      <div class="d-flex align-center flex-wrap ga-3 mb-4">
        <v-btn-toggle
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
    </template>

    <!--
      Пагинации здесь нет намеренно: список лежит в памяти целиком, страницы
      делить не из чего. Сетка та же, что в поиске, — карточки должны выглядеть
      одинаково везде.
    -->
    <MediaGrid
      :items="visibleItems"
      with-tags
      :empty-icon="mdiHeartOutline"
      :empty-title="filtersApplied ? 'По этому фильтру ничего нет' : 'Здесь пока пусто'"
      :empty-text="
        filtersApplied
          ? 'Попробуйте выбрать другую метку или снять ограничение по типу.'
          : 'Нажмите сердечко на карточке или на странице тайтла — он появится здесь.'
      "
    >
      <template #empty-actions>
        <v-btn v-if="filtersApplied" variant="tonal" @click="resetFilters">Сбросить фильтры</v-btn>
        <v-btn v-else :to="{ name: 'search' }" variant="tonal">Перейти к поиску</v-btn>
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
