<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { mdiCheck, mdiPlus } from '@mdi/js'

import MediaPoster from '@/components/MediaPoster.vue'
import { useCategorySheet } from '@/composables/useCategorySheet'
import { CATEGORY_NAME_MAX_LENGTH, useFavoritesStore } from '@/stores/favorites'
import { UNCATEGORIZED } from '@/types/favorites'

const favorites = useFavoritesStore()

// Разбираем на отдельные привязки, чтобы шаблон работал с `item` и `isOpen`
// напрямую: вложенные в объект ref'ы Vue в шаблоне не разворачивает.
const { item, isOpen, close } = useCategorySheet()

const newCategoryName = ref('')

/** Категория текущего тайтла. Пока лист закрыт и тайтла нет — «Без категории». */
const selectedId = computed(() =>
  item.value ? favorites.itemCategoryId(item.value.mediaType, item.value.id) : UNCATEGORIZED,
)

// Поле ввода не должно хранить недописанное имя до следующего открытия: лист
// один на всё приложение, и остаток от прошлого тайтла выглядел бы как ошибка.
watch(isOpen, (open) => {
  if (open) newCategoryName.value = ''
})

/**
 * Выбор сразу закрывает лист. Категория одна, и после тапа выбирать больше
 * нечего — отдельная кнопка «Готово» была бы лишним подтверждением уже
 * совершённого действия.
 */
function onSelect(categoryId: string): void {
  if (!item.value) return

  favorites.setItemCategory(item.value.mediaType, item.value.id, categoryId)
  close()
}

/**
 * Создание и назначение — одно действие: категорию заводят именно для того
 * тайтла, который сейчас в листе, и второй тап по только что созданному пункту
 * был бы лишним. Если категория с таким именем уже есть, `createCategory`
 * вернёт её, и мы просто назначим существующую.
 */
function onCreate(): void {
  const category = favorites.createCategory(newCategoryName.value)
  if (!category) return

  onSelect(category.id)
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
    до края читается как отдельная страница, а это всего лишь выбор категории.
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
        <div class="text-title-small mb-2">Категория</div>

        <!--
          Список, а не чипы: выбор здесь одиночный, и строка с галочкой читается
          как выбор одного из вариантов, тогда как ряд чипов подсказывает, что
          можно отметить несколько.
        -->
        <v-list class="sheet-list" density="comfortable" bg-color="transparent">
          <!-- «Без категории» первым и всегда: это значение по умолчанию, и
               вернуть тайтл в него нужно ровно тем же способом, что выбрать. -->
          <v-list-item
            :active="selectedId === UNCATEGORIZED"
            title="Без категории"
            @click="onSelect(UNCATEGORIZED)"
          >
            <template #append>
              <v-icon v-if="selectedId === UNCATEGORIZED" :icon="mdiCheck" />
            </template>
          </v-list-item>

          <v-list-item
            v-for="category in favorites.categories"
            :key="category.id"
            :active="selectedId === category.id"
            :title="category.name"
            @click="onSelect(category.id)"
          >
            <template #append>
              <v-icon v-if="selectedId === category.id" :icon="mdiCheck" />
            </template>
          </v-list-item>
        </v-list>

        <v-text-field
          v-model="newCategoryName"
          :append-inner-icon="mdiPlus"
          :maxlength="CATEGORY_NAME_MAX_LENGTH"
          label="Новая категория"
          density="comfortable"
          variant="outlined"
          hide-details
          class="mt-3"
          @keydown.enter.prevent="onCreate"
          @click:append-inner="onCreate"
        />
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-btn variant="text" color="error" @click="onRemoveFromFavorites">
          Убрать из избранного
        </v-btn>
        <v-spacer />
        <v-btn variant="tonal" @click="close">Закрыть</v-btn>
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
  Потолок примерно на шесть строк: при большом числе категорий лист иначе
  вырастает во весь экран и накрывает карточку, ради которой открывался.
*/
.sheet-list {
  max-height: 264px;
  overflow-y: auto;
}
</style>
