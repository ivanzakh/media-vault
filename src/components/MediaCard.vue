<script setup lang="ts">
import { computed } from 'vue'
import { mdiStar, mdiTagOutline } from '@mdi/js'

import type { MediaItem } from '@/api/types'
import { useTagSheet } from '@/composables/useTagSheet'
import { useFavoritesStore } from '@/stores/favorites'
import { formatRating, mediaTypeLabel } from '@/utils/format'
import FavoriteButton from './FavoriteButton.vue'
import MediaPoster from './MediaPoster.vue'

const props = withDefaults(
  defineProps<{
    item: MediaItem
    /**
     * Метки и кнопка их правки. Только для избранного: в каталоге и поиске
     * большинство карточек не сохранено, и пустое место под чипы там было бы
     * пустым у всей сетки.
     */
    withTags?: boolean
  }>(),
  { withTags: false },
)

const favorites = useFavoritesStore()
const tagSheet = useTagSheet()

const rating = computed(() => formatRating(props.item.voteAverage))

const tagNames = computed(() => {
  if (!props.withTags) return []

  const assigned = new Set(favorites.itemTagIds(props.item.mediaType, props.item.id))
  // Идём по реестру, а не по `tagIds` записи: порядок меток задан в диалоге
  // управления, и на карточках он должен быть тем же, что в шапке.
  return favorites.tags.filter((tag) => assigned.has(tag.id)).map((tag) => tag.name)
})
</script>

<template>
  <!--
    Кнопка избранного лежит рядом с карточкой, а не внутри неё. Внутри она была
    бы кнопкой внутри ссылки — недопустимая вложенность, из-за которой клик
    пришлось бы гасить через @click.stop.prevent, а Tab всё равно вёл бы себя
    странно. Соседний элемент над постером решает это без всяких оговорок.
  -->
  <div class="media-card-frame">
    <!--
      `to` рендерит карточку как router-link, а не как div с @click: работает
      средний клик и «открыть в новой вкладке», переход по Tab и Enter, и читалки
      объявляют элемент ссылкой. Ради этого и берём v-card.

      Материальные v-card-title/v-card-text не используем — их отступы рассчитаны
      на текстовую карточку, а здесь главный элемент постер.
    -->
    <v-card
      :to="{ name: 'details', params: { mediaType: item.mediaType, id: item.id } }"
      variant="flat"
      color="transparent"
      rounded="0"
      class="media-card"
    >
      <MediaPoster :path="item.posterPath" :alt="`Постер: ${item.title}`" />

      <div class="media-card__body pt-2">
        <div class="media-card__title text-body-medium font-weight-medium">{{ item.title }}</div>

        <div class="d-flex align-center ga-2">
          <v-chip size="x-small" variant="tonal">
            {{ mediaTypeLabel(item.mediaType) }}
          </v-chip>
          <span class="text-body-small text-medium-emphasis">{{ item.year ?? '—' }}</span>

          <v-spacer />

          <span v-if="rating" class="d-inline-flex align-center ga-1 text-body-small">
            <v-icon :icon="mdiStar" size="14" color="amber-darken-2" />
            {{ rating }}
          </span>
        </div>
      </div>
    </v-card>

    <!--
      Метки под карточкой, а не внутри ссылки: строка растёт по числу меток, а
      у .media-card__body высота выверена под скелетоны сетки — лишний блок
      внутри рассинхронизировал бы их.
    -->
    <div v-if="tagNames.length" class="media-card__tags d-flex flex-wrap ga-1 pt-2">
      <v-chip v-for="name in tagNames" :key="name" size="x-small" variant="tonal" :title="name">
        {{ name }}
      </v-chip>
    </div>

    <div class="media-card__actions">
      <!--
        Отдельная кнопка, а не открытие листа по сердечку: сердечко на уже
        сохранённом тайтле должно убирать его одним кликом, как везде в
        приложении, и подменять это действие меню значило бы удивлять на каждом
        экране ради редкого сценария.
      -->
      <v-btn
        v-if="withTags"
        :icon="mdiTagOutline"
        :aria-label="`Метки: ${item.title}`"
        variant="text"
        size="small"
        class="media-card__chip-btn"
        @click="tagSheet.open(item)"
      />
      <FavoriteButton :item="item" />
    </div>
  </div>
</template>

<style scoped>
.media-card-frame {
  /* Система координат для кнопки избранного. */
  position: relative;
}

.media-card__actions {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  gap: 2px;
}

/*
  Та же подложка, что у сердечка: кнопка лежит поверх постера, а постер бывает
  любой — от чёрного кадра до белого. Токен темы, а не константа rgba, чтобы
  иконка читалась и в светлой палитре, и в тёмной.
*/
.media-card__chip-btn {
  background: rgba(var(--v-theme-surface), 0.82);
}

/* Длинное имя метки не должно распирать колонку сетки. */
.media-card__tags .v-chip {
  max-width: 100%;
}

.media-card {
  /*
    У v-card в стилях overflow: hidden — он обрезал бы кольцо фокуса, которое
    рисуется с отступом наружу от постера. Зум картинки это не расклеивает:
    его держит собственный overflow у .poster.
  */
  overflow: visible;
}

/*
  Штатная подсветка v-card — полупрозрачный оверлей на весь элемент. На
  прозрачной карточке он обводит содержимое впритык и читается как серый
  прямоугольник без полей, поэтому гасим его и показываем наведение на самом
  постере: он здесь и есть главный элемент.
*/
.media-card :deep(.v-card__overlay) {
  display: none;
}

/*
  Наведение слушаем на рамке, а не на самой карточке: кнопка избранного лежит
  поверх постера, но в дереве стоит рядом с карточкой, и при переходе курсора на
  неё карточка теряла бы hover — постер отыгрывал бы зум назад прямо под пальцем.
*/
.media-card-frame:hover :deep(.v-img__img) {
  transform: scale(1.06);
}

.media-card-frame:hover .media-card__title {
  color: rgb(var(--v-theme-primary));
}

/*
  Оверлей рисовал и фокус тоже, поэтому кольцо теперь наше: без него переход
  по Tab через сетку был бы невидимым.
*/
.media-card:focus-visible {
  outline: none;
}

.media-card:focus-visible :deep(.poster) {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .media-card-frame:hover :deep(.v-img__img) {
    transform: none;
  }
}

/*
  Строка метаданных идёт под постером, название — под ней. Так расстояние от
  постера до чипа и от чипа до названия постоянно, а вся неопределённость
  высоты уезжает за последнюю строку названия, где её не видно.

  Порядок меняется через column-reverse, а не в разметке: в DOM название
  остаётся первым, и скринридер читает ссылку как «Название, Сериал, 2016, 7.1».
*/
.media-card__body {
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
}

.media-card__title {
  transition: color 0.2s ease;
  /* Длинные названия обрезаем на второй строке, иначе карточки в ряду разъезжаются. */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  /*
    Место под вторую строку резервируется всегда — но теперь оно уходит вниз,
    за последнюю строку, и на прозрачном фоне не видно. Нужно оно ради ряда,
    где все названия короткие: без резерва он стал бы на 20px ниже соседних,
    и ровно на эти 20px дёргалась бы вёрстка при подмене скелетонов данными.
    40px — две строки text-body-medium (14px × 1.428).
  */
  min-height: 40px;
}
</style>
