<script setup lang="ts">
import { mdiMagnify } from '@mdi/js'

import type { MediaItem } from '@/api/types'
import MediaCard from './MediaCard.vue'

withDefaults(
  defineProps<{
    items: MediaItem[]
    loading?: boolean
    error?: string | null
    /** Сколько скелетонов рисовать: обычно столько же, сколько придёт карточек. */
    skeletonCount?: number
    emptyTitle?: string
    emptyText?: string
    /** Путь SVG из @mdi/js: у пустого поиска и пустого избранного смысл разный. */
    emptyIcon?: string
    /** Проброс в карточки: кнопка смены категории нужна только в избранном. */
    withCategory?: boolean
  }>(),
  {
    loading: false,
    error: null,
    skeletonCount: 20,
    emptyTitle: 'Ничего не найдено',
    emptyText: 'Попробуйте изменить запрос.',
    emptyIcon: mdiMagnify,
    withCategory: false,
  },
)

const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <!-- `?? ''` ради типов: prop ждёт строку, а error объявлен как string | null. -->
  <v-alert v-if="error" type="error" variant="tonal" :text="error ?? ''">
    <template #append>
      <v-btn variant="text" @click="emit('retry')">Повторить</v-btn>
    </template>
  </v-alert>

  <!--
    Скелетоны той же геометрии, что карточки с однострочным названием — так
    выглядит большинство карточек. Если реальное название окажется в две
    строки, карточка подрастёт на 20px при подмене — это дешевле, чем всегда
    резервировать вторую строку под короткие названия.
  -->
  <div v-else-if="loading" class="media-grid" aria-hidden="true">
    <v-skeleton-loader
      v-for="n in skeletonCount"
      :key="n"
      class="media-skeleton"
      type="image, text, text"
    />
  </div>

  <v-empty-state
    v-else-if="items.length === 0"
    :icon="emptyIcon"
    :title="emptyTitle"
    :text="emptyText"
  >
    <!-- Без v-if слот считался бы переданным всегда, и пустое состояние
         рисовало бы под текстом пустой блок под кнопки. -->
    <template v-if="$slots['empty-actions']" #actions>
      <slot name="empty-actions" />
    </template>
  </v-empty-state>

  <div v-else class="media-grid">
    <MediaCard
      v-for="item in items"
      :key="`${item.mediaType}:${item.id}`"
      :item="item"
      :with-category="withCategory"
    />
  </div>
</template>

<style scoped>
.media-grid {
  display: grid;
  /*
    Минимум колонки 150px, а не 180px: на экране 375px за вычетом полей
    контейнера остаётся около 343px, и при промежутке 16px на две колонки
    приходится по 163px. С минимумом 180px вторая колонка не влезает и сетка
    схлопывается в одну — то есть один постер во весь экран телефона.

    auto-fill, а не auto-fit: при единственном результате auto-fit растянул бы
    карточку на всю ширину и постер превратился бы в полотно.
  */
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  /* По вертикали больше: иначе подпись слипается со следующим рядом. */
  gap: 20px 16px;
}

/*
  У скелетона свои размеры костей: картинка ростом 150px и отступы по 16px.
  Приводим их к геометрии MediaCard с однострочным названием, иначе при
  подмене данными вёрстка дёргается сильнее, чем нужно.

  Под постером карточка занимает 56px:
     8  padding сверху (pt-2)
    20  строка названия (text-body-medium: 14px × 1.428 = 20px)
     8  gap
    20  строка метаданных (высота чипа x-small)
  Кости повторяют эту раскладку: первая под название, вторая — под метаданные.
*/
.media-skeleton {
  /*
    Штатно кости лежат во флекс-контейнере с flex-wrap: wrap и flex-basis: 100%,
    но Vuetify сам ограничивает соседние текстовые кости (`text + text` получает
    max-width: 50%), и две суженные кости укладываются в одну строку. В блочном
    потоке каждая кость занимает свою строку независимо от ширины.
  */
  display: block;
  background: transparent;
}

.media-skeleton :deep(.v-skeleton-loader__image) {
  height: auto;
  aspect-ratio: 2 / 3;
  border-radius: 8px;
}

.media-skeleton :deep(.v-skeleton-loader__text) {
  height: 12px;
  margin: 8px 0 0;
}

/* Порядок костей задан строкой type="image, text, text" выше: название, метаданные. */
.media-skeleton :deep(.v-skeleton-loader__text:nth-child(2)) {
  height: 20px;
  margin-top: 8px;
  /* Перебивает вуетифаевский max-width: 50% у соседней текстовой кости. */
  max-width: 85%;
}

.media-skeleton :deep(.v-skeleton-loader__text:nth-child(3)) {
  height: 20px;
  margin-top: 8px;
  margin-bottom: 4px;
  max-width: 45%;
  border-radius: 10px;
}
</style>
