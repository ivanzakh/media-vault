<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { CATEGORY_NAME_MAX_LENGTH, useFavoritesStore } from '@/stores/favorites'
import type { Category } from '@/types/favorites'

const open = defineModel<boolean>({ required: true })

const props = withDefaults(
  defineProps<{
    /** Категория для переименования; `null` — создание новой. */
    category?: Category | null
  }>(),
  { category: null },
)

const favorites = useFavoritesStore()

const name = ref('')

// Значение подставляем на открытии, а не через computed от props: пока диалог
// открыт, поле — это черновик, и внешнее переименование не должно выбрасывать
// из-под курсора то, что человек уже набрал.
watch(open, (isOpen) => {
  if (isOpen) name.value = props.category?.name ?? ''
})

const isRename = computed(() => props.category !== null)

/**
 * Имя занято другой категорией: сохранять нельзя, иначе две станут неразличимы
 * визуально, оставшись разными по id. Сравнение без учёта регистра — стор
 * считает «marvel» и «Marvel» одним и тем же именем.
 */
const error = computed(() => {
  const trimmed = name.value.trim()

  // При создании пустое поле — начальное состояние, а не ошибка: подпись под
  // ещё не тронутым полем читалась бы как упрёк. При переименовании поле
  // открывается заполненным, поэтому пустота там — уже осознанное действие.
  if (!trimmed) return isRename.value ? 'Имя не может быть пустым' : ''

  const lowered = trimmed.toLocaleLowerCase('ru')
  const clash = favorites.categories.some(
    (category) =>
      category.id !== props.category?.id && category.name.toLocaleLowerCase('ru') === lowered,
  )

  return clash ? 'Такая категория уже есть' : ''
})

const canSave = computed(() => Boolean(name.value.trim()) && !error.value)

function onSubmit(): void {
  if (!canSave.value) return

  if (props.category) favorites.renameCategory(props.category.id, name.value)
  else favorites.createCategory(name.value)

  open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="420">
    <v-card :title="isRename ? 'Переименовать категорию' : 'Новая категория'">
      <v-card-text>
        <v-text-field
          v-model="name"
          :error-messages="error"
          :maxlength="CATEGORY_NAME_MAX_LENGTH"
          label="Название"
          density="comfortable"
          variant="outlined"
          autofocus
          hide-details="auto"
          @keydown.enter.prevent="onSubmit"
        />
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Отмена</v-btn>
        <v-btn :disabled="!canSave" variant="tonal" @click="onSubmit">Сохранить</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
