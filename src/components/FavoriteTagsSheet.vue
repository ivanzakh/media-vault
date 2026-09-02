<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { mdiPlus } from '@mdi/js'

import MediaPoster from '@/components/MediaPoster.vue'
import { useTagSheet } from '@/composables/useTagSheet'
import { TAG_NAME_MAX_LENGTH, useFavoritesStore } from '@/stores/favorites'

const favorites = useFavoritesStore()

// Разбираем на отдельные привязки, чтобы шаблон работал с `item` и `isOpen`
// напрямую: вложенные в объект ref'ы Vue в шаблоне не разворачивает.
const { item, isOpen, close } = useTagSheet()

const newTagName = ref('')
const chipsEl = ref<HTMLElement | null>(null)

/** Метки текущего тайтла. Пока лист закрыт и тайтла нет — пустой набор. */
const selected = computed(
  () => new Set(item.value ? favorites.itemTagIds(item.value.mediaType, item.value.id) : []),
)

// Поле ввода не должно хранить недописанное имя до следующего открытия: лист
// один на всё приложение, и остаток от прошлого тайтла выглядел бы как ошибка.
watch(isOpen, (open) => {
  if (open) newTagName.value = ''
})

function onToggleTag(tagId: string): void {
  if (!item.value) return
  favorites.toggleItemTag(item.value.mediaType, item.value.id, tagId)
}

/**
 * Создание и назначение — одно действие: метку заводят именно для того тайтла,
 * который сейчас в листе, и второй клик по только что созданному чипу был бы
 * лишним. Если метка с таким именем уже есть, `createTag` вернёт её, и мы
 * просто повесим существующую.
 */
async function onCreateTag(): Promise<void> {
  if (!item.value) return

  const tag = favorites.createTag(newTagName.value)
  if (!tag) return

  if (!selected.value.has(tag.id)) {
    favorites.toggleItemTag(item.value.mediaType, item.value.id, tag.id)
  }

  newTagName.value = ''

  // Новый чип дорисовывается в конце списка — подкручиваем к нему, иначе при
  // десятке меток непонятно, добавилось ли что-нибудь.
  await nextTick()
  chipsEl.value?.scrollTo({ top: chipsEl.value.scrollHeight, behavior: 'smooth' })
}

function onRemoveFromFavorites(): void {
  if (!item.value) return

  favorites.remove(item.value.mediaType, item.value.id)
  close()
}
</script>

<template>
  <!--
    inset — лист не во всю ширину на десктопе: на широком экране полоса от края
    до края читается как отдельная страница, а это всего лишь выбор меток.
  -->
  <v-bottom-sheet v-model="isOpen" inset scrollable>
    <v-card v-if="item">
      <v-card-item>
        <template #prepend>
          <div class="sheet-poster">
            <MediaPoster :path="item.posterPath" :alt="item.title" size="w154" />
          </div>
        </template>

        <v-card-title class="text-title-medium">{{ item.title }}</v-card-title>
        <v-card-subtitle>Сохранено в избранное</v-card-subtitle>
      </v-card-item>

      <v-divider />

      <v-card-text>
        <div class="text-title-small mb-2">Метки</div>

        <p v-if="!favorites.tags.length" class="text-body-medium text-medium-emphasis mb-3">
          Меток пока нет. Заведите первую — по ним удобно раскладывать коллекцию.
        </p>

        <!--
          Выделение цветом, а не `filter`: галочка перед текстом раздвигает чип
          и заставляет соседей перескакивать на другую строку при каждом клике.
          Тот же приём, что в фильтрах каталога.
        -->
        <div v-else ref="chipsEl" class="sheet-chips d-flex flex-wrap ga-2 mb-3">
          <v-chip
            v-for="tag in favorites.tags"
            :key="tag.id"
            :color="selected.has(tag.id) ? 'primary' : undefined"
            :variant="selected.has(tag.id) ? 'flat' : 'tonal'"
            :aria-pressed="selected.has(tag.id)"
            @click="onToggleTag(tag.id)"
          >
            {{ tag.name }}
          </v-chip>
        </div>

        <v-text-field
          v-model="newTagName"
          :append-inner-icon="mdiPlus"
          :maxlength="TAG_NAME_MAX_LENGTH"
          label="Новая метка"
          density="comfortable"
          variant="outlined"
          hide-details
          @keydown.enter.prevent="onCreateTag"
          @click:append-inner="onCreateTag"
        />
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-btn variant="text" color="error" @click="onRemoveFromFavorites">
          Убрать из избранного
        </v-btn>
        <v-spacer />
        <v-btn variant="tonal" @click="close">Готово</v-btn>
      </v-card-actions>
    </v-card>
  </v-bottom-sheet>
</template>

<style scoped>
.sheet-poster {
  width: 48px;
  flex-shrink: 0;
}

/*
  Потолок примерно на пять строк чипов: при большой коллекции меток лист иначе
  вырастает во весь экран и накрывает карточку, ради которой открывался.
*/
.sheet-chips {
  max-height: 200px;
  overflow-y: auto;
}
</style>
