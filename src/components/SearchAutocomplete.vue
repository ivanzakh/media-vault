<script setup lang="ts">
import { computed, nextTick, ref, useId, watch, type ComponentPublicInstance } from 'vue'
import { mdiMagnify } from '@mdi/js'
import { useRoute, useRouter } from 'vue-router'

import type { MediaItem } from '@/api/types'
import { useDebouncedSearch } from '@/composables/useDebouncedSearch'

// Корень шаблона — фрагмент (поле + меню), поэтому class="flex-grow-1"
// из App.vue не унаследовался бы автоматически. Прокидываем его на поле руками.
defineOptions({ inheritAttrs: false })

const router = useRouter()
const route = useRoute()

const { query, results, loading, error, isActive } = useDebouncedSearch()

// `target` только позиционирует меню и, в отличие от `activator`, не вешает на
// элемент обработчики клика и клавиш. Открытием управляем сами — иначе меню
// перехватывало бы стрелки, которыми мы двигаем подсветку внутри списка.
const fieldRef = ref<ComponentPublicInstance | null>(null)

const menuOpen = ref(false)
const activeIndex = ref(-1)
const listId = useId()

function optionId(index: number) {
  return `${listId}-option-${index}`
}

const isOpen = computed({
  get: () => menuOpen.value && isActive.value,
  set: (value: boolean) => {
    menuOpen.value = value
  },
})

// `clearable` сбрасывает модель в undefined (VInput вызывает reset), а вотчер
// в композабле ждёт строку — без этой обёртки клик по крестику ронял бы watch.
const model = computed<string | null | undefined>({
  get: () => query.value,
  set: (value) => {
    query.value = value ?? ''
  },
})

watch(query, () => {
  menuOpen.value = true
  activeIndex.value = -1
})

watch(results, () => {
  activeIndex.value = -1
})

// Подсвеченный элемент должен оставаться в зоне видимости при навигации стрелками.
watch(activeIndex, async (index) => {
  if (index < 0) return
  await nextTick()
  document.getElementById(optionId(index))?.scrollIntoView({ block: 'nearest' })
})

function close() {
  menuOpen.value = false
  activeIndex.value = -1
}

// Уход на другую страницу не должен оставлять висящее меню.
watch(() => route.fullPath, close)

/** Повторный клик по полю возвращает подсказки, закрытые до этого Esc или выбором. */
function onClick() {
  if (isActive.value) menuOpen.value = true
}

function move(delta: number) {
  const count = results.value.length
  if (count === 0) return
  const next = activeIndex.value + delta
  activeIndex.value = next < 0 ? count - 1 : next >= count ? 0 : next
}

function openItem(item: MediaItem) {
  close()
  router.push({ name: 'details', params: { mediaType: item.mediaType, id: item.id } })
}

function submitSearch() {
  const trimmed = query.value.trim()
  if (!trimmed) return
  close()
  router.push({ name: 'search', query: { q: trimmed, page: 1 } })
}

function onKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp': {
      if (!isActive.value) return
      event.preventDefault()
      // Закрытое меню сначала открываем, не сдвигая подсветку.
      if (!menuOpen.value) menuOpen.value = true
      else move(event.key === 'ArrowDown' ? 1 : -1)
      break
    }
    case 'Enter': {
      event.preventDefault()
      // `noUncheckedIndexedAccess`: обращение по индексу даёт MediaItem | undefined.
      const active = activeIndex.value >= 0 ? results.value[activeIndex.value] : undefined
      if (active) openItem(active)
      else submitSearch()
      break
    }
    case 'Escape': {
      if (!isOpen.value) return
      event.preventDefault()
      close()
      break
    }
    case 'Tab': {
      // Уходим по табу дальше, ничего не выбирая.
      close()
      break
    }
  }
}
</script>

<template>
  <v-text-field
    v-bind="$attrs"
    ref="fieldRef"
    v-model="model"
    :prepend-inner-icon="mdiMagnify"
    :aria-expanded="isOpen ? 'true' : 'false'"
    :aria-controls="listId"
    :aria-activedescendant="activeIndex >= 0 ? optionId(activeIndex) : undefined"
    role="combobox"
    aria-autocomplete="list"
    autocomplete="off"
    placeholder="Фильм или сериал"
    variant="solo-filled"
    density="compact"
    rounded="lg"
    flat
    single-line
    hide-details
    clearable
    @keydown="onKeydown"
    @click="onClick"
  />

  <v-menu
    v-model="isOpen"
    :target="fieldRef ?? undefined"
    :capture-focus="false"
    :close-on-content-click="false"
    :offset="4"
    location="bottom"
  >
    <v-sheet class="search-menu" rounded="lg" elevation="6">
      <div
        v-if="loading || error || results.length === 0"
        class="px-4 py-3 text-body-2"
        :class="error ? 'text-error' : 'text-medium-emphasis'"
        aria-live="polite"
      >
        {{ loading ? 'Загрузка…' : (error ?? 'Ничего не найдено') }}
      </div>

      <v-list :id="listId" role="listbox" density="compact" class="pa-0">
        <v-list-item
          v-for="(item, index) in results"
          :id="optionId(index)"
          :key="`${item.mediaType}:${item.id}`"
          :active="index === activeIndex"
          :aria-selected="index === activeIndex"
          :title="item.title"
          role="option"
          @click="openItem(item)"
        >
          <template #subtitle>{{ item.year ?? 'год неизвестен' }}</template>
          <template #append>
            <v-chip size="x-small" variant="tonal" class="ms-2">
              {{ item.mediaType === 'movie' ? 'Фильм' : 'Сериал' }}
            </v-chip>
          </template>
        </v-list-item>
      </v-list>
    </v-sheet>
  </v-menu>
</template>

<style scoped>
.search-menu {
  /*
    Подсказок не больше SUGGESTION_LIMIT, то есть высота и так ограничена
    примерно 480px. Фиксированный потолок в пикселях резал бы список без нужды,
    поэтому ограничиваем только относительно экрана — ради низких окон
    и ландшафтной ориентации.
  */
  max-height: 70vh;
  overflow-y: auto;
}
</style>
