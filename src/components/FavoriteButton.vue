<script setup lang="ts">
import { computed } from 'vue'
import { mdiHeart, mdiHeartOutline } from '@mdi/js'

import type { MediaItem } from '@/api/types'
import { useCategorySheet } from '@/composables/useCategorySheet'
import { useFavoritesStore } from '@/stores/favorites'

const props = withDefaults(
  defineProps<{
    item: MediaItem
    /** С подписью — для детальной страницы; без неё — иконка поверх постера. */
    withLabel?: boolean
  }>(),
  { withLabel: false },
)

const favorites = useFavoritesStore()
const categorySheet = useCategorySheet()

const active = computed(() => favorites.isFavorite(props.item.mediaType, props.item.id))
const label = computed(() => (active.value ? 'В избранном' : 'В избранное'))

/**
 * Добавление сразу открывает лист категорий: разложить тайтл проще в тот
 * момент, когда его сохраняют, а не потом, разбирая накопившуюся кучу. Лист
 * можно закрыть не глядя — тайтл останется в избранном «Без категории».
 *
 * При удалении лист не открывается: там решение уже принято, и любое окно
 * поверх было бы лишним шагом.
 */
function onClick(): void {
  if (favorites.toggle(props.item)) categorySheet.open(props.item)
}
</script>

<template>
  <!--
    aria-pressed вместо смены роли: это переключатель одного состояния, и
    читалка объявит «кнопка, В избранном, нажата», а не две разные кнопки.
  -->
  <v-btn
    v-if="withLabel"
    :prepend-icon="active ? mdiHeart : mdiHeartOutline"
    :color="active ? 'red' : undefined"
    :aria-pressed="active"
    variant="tonal"
    @click="onClick"
  >
    {{ label }}
  </v-btn>

  <!--
    variant="text", а не flat: цвет тогда достаётся иконке, а фон остаётся за
    нами. С flat активное состояние красило бы саму подложку, и красный квадрат
    перекрывал бы постер.
  -->
  <v-btn
    v-else
    :icon="active ? mdiHeart : mdiHeartOutline"
    :color="active ? 'red' : undefined"
    :aria-label="label"
    :aria-pressed="active"
    variant="text"
    size="small"
    class="favorite-chip"
    @click="onClick"
  />
</template>

<style scoped>
.favorite-chip {
  /*
    Кнопка лежит поверх постера, а постер бывает любой — от чёрного кадра до
    белого. Подложка берётся токеном темы, а не константой rgba, чтобы иконка
    читалась и в светлой палитре, и в тёмной.
  */
  background: rgba(var(--v-theme-surface), 0.82);
}
</style>
