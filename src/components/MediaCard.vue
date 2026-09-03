<script setup lang="ts">
import { computed } from 'vue'
import { mdiStar } from '@mdi/js'

import type { MediaItem } from '@/api/types'
import { formatRating, mediaTypeLabel } from '@/utils/format'
import FavoriteButton from './FavoriteButton.vue'
import MediaPoster from './MediaPoster.vue'

const props = withDefaults(
  defineProps<{
    item: MediaItem
    /**
     * На карточке избранного клик по сердечку не убирает тайтл сразу, а
     * открывает лист управления категорией — там же есть и «Убрать из
     * избранного». В каталоге и поиске большинство карточек не сохранено,
     * и открывать лист управления там нечем.
     */
    withCategory?: boolean
  }>(),
  { withCategory: false },
)

const rating = computed(() => formatRating(props.item.voteAverage))
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

    <div class="media-card__actions">
      <FavoriteButton :item="item" :with-category="withCategory" />
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

/* Название идёт под постером, строка метаданных — под ним. */
.media-card__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.media-card__title {
  transition: color 0.2s ease;
  /*
    Длинные названия обрезаем на второй строке, иначе карточки в ряду
    разъезжаются. Место под вторую строку намеренно не резервируем: у
    большинства названий она пустая, и однострочные карточки в ряду будут
    на 20px короче двухстрочных соседей — это дешевле, чем пустое место под
    каждым однострочным названием.
  */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
}
</style>
