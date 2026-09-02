<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { mdiImageOffOutline } from '@mdi/js'

import { imageUrl } from '@/api/media'
import type { ImageSize } from '@/api/types'

const props = withDefaults(
  defineProps<{
    path: string | null
    alt: string
    size?: ImageSize
  }>(),
  { size: 'w342' },
)

const src = computed(() => imageUrl(props.path, props.size))

// Постера нет у заметной доли тайтлов, и ссылка иногда битая — в обоих случаях
// показываем заглушку: пустой прямоугольник читается как баг вёрстки.
const failed = ref(false)
watch(src, () => {
  failed.value = false
})
</script>

<template>
  <div class="poster">
    <!--
      v-img откладывает загрузку до появления в зоне видимости через
      IntersectionObserver, поэтому loading="lazy" здесь не нужен.
    -->
    <v-img
      v-if="src && !failed"
      :src="src"
      :alt="alt"
      height="100%"
      cover
      @error="failed = true"
    />
    <div v-else class="poster__fallback text-medium-emphasis">
      <v-icon :icon="mdiImageOffOutline" size="32" />
    </div>
  </div>
</template>

<style scoped>
.poster {
  /*
    2/3 — родное соотношение постеров TMDB. Фиксируем его на контейнере, чтобы
    место под картинку было занято до её загрузки и сетка не прыгала.
  */
  aspect-ratio: 2 / 3;
  overflow: hidden;
  border-radius: 8px;
  /* surface-light входит во встроенные темы и отличим от фона в обеих. */
  background: rgb(var(--v-theme-surface-light));
}

.poster :deep(.v-img__img) {
  /* Зум идёт внутри неизменной рамки, поэтому при наведении сетка не едет. */
  transition: transform 0.25s ease;
}

.poster__fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>
