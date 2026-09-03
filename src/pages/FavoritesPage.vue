<script setup lang="ts">
import { computed, ref } from 'vue'
import { mdiHeartOutline, mdiPlus } from '@mdi/js'

import CategoryNameDialog from '@/components/CategoryNameDialog.vue'
import CategoryTile from '@/components/CategoryTile.vue'
import { useFavoritesStore } from '@/stores/favorites'
import { UNCATEGORIZED, type Category } from '@/types/favorites'
import { formatNumber, plural } from '@/utils/format'

const favorites = useFavoritesStore()

const nameDialogOpen = ref(false)
/** Что правит диалог имени: `null` — создание новой категории. */
const editing = ref<Category | null>(null)

const pendingDelete = ref<Category | null>(null)

const countText = computed(() => {
  const total = favorites.count
  return `${formatNumber(total)} ${plural(total, ['тайтл', 'тайтла', 'тайтлов'])}`
})

/**
 * «Без категории» показываем только пока в ней что-то лежит: пустая плитка
 * рядом с созданными вручную выглядела бы как настоящая категория, которую
 * почему-то нельзя ни переименовать, ни удалить.
 */
const uncategorizedCount = computed(() => favorites.categoryCounts.get(UNCATEGORIZED) ?? 0)

const isEmpty = computed(() => !favorites.count && !favorites.categories.length)

function openNameDialog(category: Category | null): void {
  editing.value = category
  nameDialogOpen.value = true
}

/**
 * Называем цену числом: «удалить категорию» звучит безобидно ровно до момента,
 * когда в ней три десятка тайтлов.
 */
const deleteText = computed(() => {
  const category = pendingDelete.value
  if (!category) return ''

  const count = favorites.categoryCounts.get(category.id) ?? 0
  if (!count) return `Удалить категорию «${category.name}»? В ней ничего нет.`

  const suffix = plural(count, ['тайтл переедет', 'тайтла переедут', 'тайтлов переедут'])
  return `Удалить категорию «${category.name}»? ${formatNumber(count)} ${suffix} в «Без категории» — из избранного они не пропадут.`
})

function onConfirmDelete(): void {
  if (pendingDelete.value) favorites.deleteCategory(pendingDelete.value.id)
  pendingDelete.value = null
}
</script>

<template>
  <v-container class="py-6">
    <div class="d-flex align-center flex-wrap ga-3 mb-4">
      <h1 class="text-headline-small">Избранное</h1>
      <span v-if="favorites.count" class="text-body-medium text-medium-emphasis">
        {{ countText }}
      </span>
    </div>

    <v-empty-state
      v-if="isEmpty"
      :icon="mdiHeartOutline"
      title="Здесь пока пусто"
      text="Нажмите сердечко на карточке или на странице тайтла — он появится здесь."
    >
      <template #actions>
        <v-btn :to="{ name: 'search' }" variant="tonal">Перейти к поиску</v-btn>
      </template>
    </v-empty-state>

    <!--
      Та же сетка, что у карточек: плитка категории по построению имеет
      пропорции постера, поэтому на 375px обе раскладки дают две колонки, а
      переход с экрана категорий внутрь не меняет ритм страницы.
    -->
    <div v-else class="category-grid">
      <CategoryTile
        v-for="category in favorites.categories"
        :key="category.id"
        :category-id="category.id"
        :name="category.name"
        manageable
        @rename="openNameDialog(category)"
        @remove="pendingDelete = category"
      />

      <CategoryTile
        v-if="uncategorizedCount"
        :category-id="UNCATEGORIZED"
        name="Без категории"
      />

      <!--
        Кнопка, а не плитка-ссылка: создание не ведёт на другой адрес. Нативный
        button ради клавиатуры — Enter и пробел работают без обработчиков.
      -->
      <button type="button" class="category-new" @click="openNameDialog(null)">
        <v-icon :icon="mdiPlus" size="32" />
        <span class="text-body-medium">Новая категория</span>
      </button>
    </div>

    <CategoryNameDialog v-model="nameDialogOpen" :category="editing" />

    <v-dialog
      :model-value="pendingDelete !== null"
      max-width="420"
      @update:model-value="pendingDelete = null"
    >
      <v-card title="Удаление категории" :text="deleteText">
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="pendingDelete = null">Отмена</v-btn>
          <v-btn variant="tonal" color="error" @click="onConfirmDelete">Удалить</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
/* Повторяет .media-grid: минимум колонки 150px, чтобы на 375px влезли две. */
.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 20px 16px;
}

/*
  Высота — по обложке, без подписи снизу: align-self не даёт кнопке растянуться
  на всю высоту ячейки вместе с именем и счётчиком соседних плиток.
*/
.category-new {
  aspect-ratio: 2 / 3;
  align-self: start;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px dashed rgba(var(--v-border-color), 0.4);
  border-radius: 8px;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.75;
  transition:
    opacity 0.2s ease,
    border-color 0.2s ease;
}

.category-new:hover {
  opacity: 1;
  border-color: rgb(var(--v-theme-primary));
}

.category-new:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
</style>
