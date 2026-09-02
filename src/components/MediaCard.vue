<script setup lang="ts">
import { computed } from 'vue'
import { mdiStar } from '@mdi/js'

import type { MediaItem } from '@/api/types'
import { formatRating } from '@/utils/format'
import MediaPoster from './MediaPoster.vue'

const props = defineProps<{ item: MediaItem }>()

const rating = computed(() => formatRating(props.item.voteAverage))
</script>

<template>
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
          {{ item.mediaType === 'movie' ? 'Фильм' : 'Сериал' }}
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
</template>

<style scoped>
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

.media-card:hover :deep(.v-img__img) {
  transform: scale(1.06);
}

.media-card:hover .media-card__title {
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
  .media-card:hover :deep(.v-img__img) {
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
