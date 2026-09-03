<script setup lang="ts">
import { computed } from 'vue'
import { mdiDeleteOutline, mdiDotsVertical, mdiFolderOutline, mdiPencilOutline } from '@mdi/js'

import MediaPoster from '@/components/MediaPoster.vue'
import { useFavoritesStore } from '@/stores/favorites'
import type { FavoriteItem } from '@/types/favorites'
import { formatNumber, plural } from '@/utils/format'

const props = withDefaults(
  defineProps<{
    categoryId: string
    name: string
    /** Встроенная «Без категории» не переименовывается и не удаляется. */
    manageable?: boolean
  }>(),
  { manageable: false },
)

/*
  Плитка только сообщает о намерении, а диалоги живут на странице: так их по
  одному на весь список, а не по паре на каждую категорию, и «какую именно
  сейчас правят» хранится в одном месте.
*/
const emit = defineEmits<{ rename: []; remove: [] }>()

const favorites = useFavoritesStore()

/**
 * Ровно четыре ячейки, недостающие — `null`. Фиксированная длина, а не
 * `slice(0, 4)`: у категории с одним тайтлом плитка должна остаться той же
 * формы, что у полной, иначе одна и та же сущность выглядит по-разному в
 * зависимости от наполнения.
 *
 * Тайтлы идут от последнего добавленного — стор кладёт новое в начало списка,
 * поэтому обложка обновляется, когда в категорию что-то кладут.
 */
const cover = computed<(FavoriteItem | null)[]>(() => {
  const items = favorites.itemsInCategory(props.categoryId)
  return [0, 1, 2, 3].map((index) => items[index] ?? null)
})

const count = computed(() => favorites.categoryCounts.get(props.categoryId) ?? 0)

const countText = computed(
  () => `${formatNumber(count.value)} ${plural(count.value, ['тайтл', 'тайтла', 'тайтлов'])}`,
)
</script>

<template>
  <!-- Рамка — система координат для кнопки меню, которая ляжет поверх обложки. -->
  <div class="category-tile-frame">
    <!--
      `to` рендерит плитку как router-link, а не как div с @click: работает
      средний клик и «открыть в новой вкладке», переход по Tab и Enter, и
      читалки объявляют элемент ссылкой. Ровно как в MediaCard.
    -->
    <v-card
      :to="{ name: 'favorites-category', params: { categoryId } }"
      variant="flat"
      color="transparent"
      rounded="0"
      class="category-tile"
    >
      <div v-if="count" class="category-tile__cover">
        <template v-for="(item, index) in cover" :key="index">
          <MediaPoster
            v-if="item"
            :path="item.posterPath"
            :alt="`Постер: ${item.title}`"
            size="w154"
          />
          <div v-else class="category-tile__blank" />
        </template>
      </div>

      <div v-else class="category-tile__empty">
        <v-icon :icon="mdiFolderOutline" size="40" class="text-medium-emphasis" />
      </div>

      <div class="category-tile__body pt-2">
        <div class="category-tile__name text-body-medium font-weight-medium">{{ name }}</div>
        <div class="text-body-small text-medium-emphasis">{{ countText }}</div>
      </div>
    </v-card>

    <!--
      Кнопка лежит рядом с карточкой, а не внутри неё: внутри она была бы
      кнопкой внутри ссылки — недопустимая вложенность, из-за которой клик
      пришлось бы гасить через @click.stop.prevent. Тот же приём, что в
      MediaCard.
    -->
    <v-menu v-if="manageable">
      <template #activator="{ props: menuProps }">
        <v-btn
          v-bind="menuProps"
          :icon="mdiDotsVertical"
          :aria-label="`Действия: ${name}`"
          variant="text"
          size="small"
          class="category-tile__menu-btn"
        />
      </template>

      <v-list density="compact">
        <v-list-item
          :prepend-icon="mdiPencilOutline"
          title="Переименовать"
          @click="emit('rename')"
        />
        <v-list-item
          :prepend-icon="mdiDeleteOutline"
          title="Удалить"
          base-color="error"
          @click="emit('remove')"
        />
      </v-list>
    </v-menu>
  </div>
</template>

<style scoped>
.category-tile-frame {
  /* Система координат для кнопки меню. */
  position: relative;
}

/*
  Та же подложка, что у кнопок на карточке: кнопка лежит поверх обложки, а
  обложка бывает любой — от чёрного кадра до белого. Токен темы, а не константа
  rgba, чтобы иконка читалась и в светлой палитре, и в тёмной.
*/
.category-tile__menu-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(var(--v-theme-surface), 0.82);
}

.category-tile {
  /*
    У v-card в стилях overflow: hidden — он обрезал бы кольцо фокуса, которое
    рисуется с отступом наружу от обложки.
  */
  overflow: visible;
}

/*
  Штатная подсветка v-card — полупрозрачный оверлей на весь элемент. На
  прозрачной плитке он обводит содержимое впритык и читается как серый
  прямоугольник, поэтому гасим его и показываем наведение на самой обложке.
*/
.category-tile :deep(.v-card__overlay) {
  display: none;
}

/*
  Четыре обложки 2:3 в сетке 2×2 дают блок тех же пропорций 2:3 — плитка
  категории получается ровно той же формы и высоты, что карточка в каталоге, и
  садится с ними в одну сетку.

  Скругление общее, а собственные радиусы постеров гасим: иначе плитка выглядит
  мозаикой из четырёх карточек, а не одной обложкой категории.
*/
.category-tile__cover {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  border-radius: 8px;
  overflow: hidden;
  background: rgb(var(--v-theme-surface-light));
}

.category-tile__cover :deep(.poster) {
  border-radius: 0;
}

/* Недостающая обложка — та же подложка, что у промежутков сетки. */
.category-tile__blank {
  aspect-ratio: 2 / 3;
  background: rgb(var(--v-theme-surface-light));
}

.category-tile__empty {
  aspect-ratio: 2 / 3;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: rgb(var(--v-theme-surface-light));
}

.category-tile-frame:hover :deep(.v-img__img) {
  transform: scale(1.06);
}

.category-tile-frame:hover .category-tile__name {
  color: rgb(var(--v-theme-primary));
}

/* Оверлей рисовал и фокус тоже, поэтому кольцо теперь наше. */
.category-tile:focus-visible {
  outline: none;
}

.category-tile:focus-visible .category-tile__cover,
.category-tile:focus-visible .category-tile__empty {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .category-tile-frame:hover :deep(.v-img__img) {
    transform: none;
  }
}

.category-tile__name {
  transition: color 0.2s ease;
  /* Длинные имена обрезаем на второй строке, иначе плитки в ряду разъезжаются. */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  /*
    Место под вторую строку резервируется всегда: без него счётчики в ряду
    вставали бы на разной высоте — у категории с коротким именем на 20px выше,
    чем у соседней с переносом. 40px — две строки text-body-medium.
  */
  min-height: 40px;
}
</style>
