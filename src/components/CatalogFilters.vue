<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'

import type { MediaType, SortKey } from '@/api/types'
import { useGenresStore } from '@/stores/genres'
import { DEFAULT_SORT, MAX_YEAR, MIN_YEAR, isSortKey, type CatalogFilters } from '@/utils/catalog'

/**
 * Тянущийся ползунок лет иначе порождает запрос на каждый пиксель. Остальные
 * фильтры дискретны — они уезжают в URL сразу, без задержки.
 */
const YEAR_DEBOUNCE = 400

const props = defineProps<{
  type: MediaType
  sort: SortKey
  genreIds: number[]
  yearFrom: number | null
  yearTo: number | null
}>()

/**
 * Компонент ничего не решает сам: он отдаёт наверх изменившиеся поля, а всю
 * запись в URL делает страница. Так источник правды остаётся один.
 */
const emit = defineEmits<{
  change: [patch: Partial<Omit<CatalogFilters, 'page'>>]
  reset: []
}>()

const TYPE_OPTIONS: { value: MediaType; title: string }[] = [
  { value: 'movie', title: 'Фильмы' },
  { value: 'tv', title: 'Сериалы' },
]

const SORT_OPTIONS: { value: SortKey; title: string }[] = [
  { value: 'popularity', title: 'По популярности' },
  { value: 'rating', title: 'По рейтингу' },
  { value: 'votes', title: 'По числу оценок' },
  { value: 'date', title: 'По дате выхода' },
]

const genres = useGenresStore()

// Словарь грузится лениво — при первом показе панели и при смене типа.
watch(() => props.type, (type) => genres.ensureLoaded(type), { immediate: true })

const genreList = computed(() => genres.byType[props.type])

/**
 * Выбранные жанры Set'ом: `v-chip--selected` сам по себе ничего не красит, и
 * состояние каждого чипа приходится считать самим — на каждой перерисовке
 * панели это девятнадцать проверок, поэтому не `includes` по массиву.
 */
const selectedGenres = computed(() => new Set(props.genreIds))

/**
 * Тип здесь намеренно не учитывается: «Сериалы» — это другая сущность, а не
 * применённый фильтр, и сбрасывать в них нечего. По той же причине сброс на
 * стороне страницы выбранный тип сохраняет.
 */
const hasActiveFilters = computed(
  () =>
    props.sort !== DEFAULT_SORT ||
    props.genreIds.length > 0 ||
    props.yearFrom !== null ||
    props.yearTo !== null,
)

function onTypeChange(value: unknown) {
  if (value !== 'movie' && value !== 'tv') return
  if (value === props.type) return

  // ID жанров у фильмов и сериалов не пересекаются, перенос выбора дал бы
  // бессмысленный запрос. Диапазон лет осмыслен для обоих типов и остаётся.
  emit('change', { type: value, genreIds: [] })
}

function onSortChange(value: unknown) {
  if (isSortKey(value)) emit('change', { sort: value })
}

function onGenresChange(value: unknown) {
  const ids = Array.isArray(value) ? value.filter((id): id is number => typeof id === 'number') : []
  emit('change', { genreIds: ids })
}

/*
  У ползунка своё состояние: ручка должна ехать за пальцем сразу, а в URL
  значение попадает только после паузы. Внешние изменения (кнопка «Сбросить»,
  переход по истории) подхватываются вотчером ниже.
*/
const yearRange = ref<[number, number]>([props.yearFrom ?? MIN_YEAR, props.yearTo ?? MAX_YEAR])

watch(
  () => [props.yearFrom, props.yearTo] as const,
  ([from, to]) => {
    yearRange.value = [from ?? MIN_YEAR, to ?? MAX_YEAR]
  },
)

let timer: ReturnType<typeof setTimeout> | undefined

function onYearInput(value: unknown) {
  if (!Array.isArray(value)) return

  const [from, to] = value
  if (typeof from !== 'number' || typeof to !== 'number') return

  yearRange.value = [from, to]

  clearTimeout(timer)
  timer = setTimeout(() => {
    // Ручка на самом краю означает «без ограничения»: тогда параметр не уходит
    // ни в URL, ни в API — иначе каждый запрос тащил бы заведомо пустой фильтр.
    emit('change', {
      yearFrom: from === MIN_YEAR ? null : from,
      yearTo: to === MAX_YEAR ? null : to,
    })
  }, YEAR_DEBOUNCE)
}

onScopeDispose(() => clearTimeout(timer))
</script>

<template>
  <!--
    Всегда вертикальный стек: панель живёт либо в узкой колонке сайдбара, либо в
    мобильном диалоге — в обоих случаях горизонтального места нет, и раскладка
    получается одна на оба контекста.
  -->
  <div class="d-flex flex-column ga-6">
    <!-- Переключатель во всю ширину: две равные половины читаются как сегментный
         контрол, а не как пара кнопок, прижатых к левому краю. -->
    <v-btn-toggle
      :model-value="type"
      mandatory
      density="comfortable"
      variant="outlined"
      divided
      class="w-100"
      @update:model-value="onTypeChange"
    >
      <v-btn
        v-for="option in TYPE_OPTIONS"
        :key="option.value"
        :value="option.value"
        class="flex-grow-1"
      >
        {{ option.title }}
      </v-btn>
    </v-btn-toggle>

    <v-select
      :model-value="sort"
      :items="SORT_OPTIONS"
      label="Сортировка"
      density="comfortable"
      variant="outlined"
      hide-details
      @update:model-value="onSortChange"
    />

    <div>
      <div class="text-title-medium mb-2">Жанры</div>

      <v-alert
        v-if="genres.error"
        type="warning"
        variant="tonal"
        density="compact"
        :text="genres.error"
      />

      <div v-else-if="!genreList.length && genres.loading[type]" class="d-flex flex-wrap ga-2">
        <v-skeleton-loader v-for="n in 10" :key="n" type="chip" class="genre-skeleton" />
      </div>

      <!--
        Чипами, а не выпадающим списком: жанров около девятнадцати, весь набор
        помещается в две-три строки, и выбор делается в один клик — сразу видно,
        что выбрано, а что доступно. `column` вместо горизонтальной прокрутки:
        на узком экране панель живёт в полноэкранном диалоге, где вертикального
        места достаточно, а прокрутка внутри прокрутки только мешает.

        Без `filter`: галочка перед текстом раздвигает чип и заставляет соседей
        перескакивать на другую строку при каждом клике. Выбор показываем цветом
        — он читается с одного взгляда на всю группу, а не по одному чипу.
      -->
      <v-chip-group
        v-else
        :model-value="genreIds"
        multiple
        column
        @update:model-value="onGenresChange"
      >
        <v-chip
          v-for="genre in genreList"
          :key="genre.id"
          :value="genre.id"
          :color="selectedGenres.has(genre.id) ? 'primary' : undefined"
          :variant="selectedGenres.has(genre.id) ? 'flat' : 'tonal'"
        >
          {{ genre.name }}
        </v-chip>
      </v-chip-group>
    </div>

    <div>
      <div class="text-title-medium">Годы</div>
      <!--
        mt-8 — место под всплывающие подписи ручек: с thumb-label="always" они
        висят над ползунком и иначе налезли бы на заголовок. px-2 — минимальное
        поле по горизонтали: ручка в крайнем положении стоит у самого края
        дорожки, и её подпись вылезает наружу примерно на девять пикселей.
        Восьми хватает, чтобы остаток ушёл в собственные поля панели и не дал ей
        горизонтальную прокрутку.
      -->
      <v-range-slider
        :model-value="yearRange"
        :min="MIN_YEAR"
        :max="MAX_YEAR"
        :step="1"
        thumb-label="always"
        hide-details
        class="mt-8 px-2"
        @update:model-value="onYearInput"
      />
    </div>

    <v-btn variant="text" :disabled="!hasActiveFilters" @click="emit('reset')">Сбросить</v-btn>
  </div>
</template>

<style scoped>
.genre-skeleton {
  background: transparent;
}
</style>
