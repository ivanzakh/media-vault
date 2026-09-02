<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { mdiArrowDown, mdiArrowUp, mdiClose, mdiDeleteOutline, mdiPlus } from '@mdi/js'
import { useDisplay } from 'vuetify'

import { TAG_NAME_MAX_LENGTH, useFavoritesStore } from '@/stores/favorites'
import { formatNumber, plural } from '@/utils/format'

const open = defineModel<boolean>({ required: true })

const favorites = useFavoritesStore()
const { mobile } = useDisplay()

/**
 * Черновики имён отдельно от стора: пока человек стирает старое имя, поле
 * пустое, а пустое имя стор молча отвергает — без черновика курсор выбрасывало
 * бы обратно на прежнее значение после каждого символа.
 */
const drafts = ref<Record<string, string>>({})
const newTagName = ref('')
const pendingDelete = ref<string | null>(null)

watch(open, (isOpen) => {
  if (!isOpen) return

  drafts.value = Object.fromEntries(favorites.tags.map((tag) => [tag.id, tag.name]))
  newTagName.value = ''
  pendingDelete.value = null
})

const deleting = computed(() => favorites.tags.find((tag) => tag.id === pendingDelete.value))

const deletingText = computed(() => {
  const tag = deleting.value
  if (!tag) return ''

  const count = favorites.tagCounts.get(tag.id) ?? 0
  if (!count) return `Удалить метку «${tag.name}»? Она ни на чём не стоит.`

  // Называем цену числом: «удалить метку» звучит безобидно ровно до момента,
  // когда она снимается с трёх десятков тайтлов.
  const suffix = plural(count, ['тайтла', 'тайтлов', 'тайтлов'])
  return `Удалить метку «${tag.name}»? Она снимется с ${formatNumber(count)} ${suffix}. Сами тайтлы останутся в избранном.`
})

/** Имя занято другой меткой: сохранять нельзя, иначе две метки станут неразличимы. */
function isDuplicate(id: string, name: string): boolean {
  const lowered = name.trim().toLocaleLowerCase('ru')
  if (!lowered) return false

  return favorites.tags.some(
    (tag) => tag.id !== id && tag.name.toLocaleLowerCase('ru') === lowered,
  )
}

function errorFor(id: string): string | undefined {
  const draft = drafts.value[id] ?? ''
  if (!draft.trim()) return 'Имя не может быть пустым'
  if (isDuplicate(id, draft)) return 'Такая метка уже есть'
  return undefined
}

function onRename(id: string): void {
  if (errorFor(id)) return
  favorites.renameTag(id, drafts.value[id] ?? '')
}

function onCreate(): void {
  const tag = favorites.createTag(newTagName.value)
  if (!tag) return

  drafts.value = { ...drafts.value, [tag.id]: tag.name }
  newTagName.value = ''
}

function onConfirmDelete(): void {
  if (pendingDelete.value) favorites.deleteTag(pendingDelete.value)
  pendingDelete.value = null
}
</script>

<template>
  <!-- На узком экране во весь экран: строка метки — это поле ввода, две стрелки
       и корзина, и в тесном диалоге они налезали бы друг на друга. -->
  <v-dialog v-model="open" :fullscreen="mobile" max-width="560" scrollable>
    <v-card>
      <v-toolbar color="surface" title="Управление метками">
        <template #append>
          <v-btn :icon="mdiClose" variant="text" aria-label="Закрыть" @click="open = false" />
        </template>
      </v-toolbar>

      <v-card-text>
        <p v-if="!favorites.tags.length" class="text-body-medium text-medium-emphasis">
          Меток пока нет. Заведите первую здесь или прямо с карточки тайтла.
        </p>

        <div v-else class="d-flex flex-column ga-2 mb-4">
          <div v-for="(tag, index) in favorites.tags" :key="tag.id" class="d-flex align-start ga-1">
            <!-- Не v-model: под noUncheckedIndexedAccess чтение из Record даёт
                 `string | undefined`, и двусторонняя привязка на этом спотыкается. -->
            <v-text-field
              :model-value="drafts[tag.id] ?? tag.name"
              :error-messages="errorFor(tag.id)"
              :maxlength="TAG_NAME_MAX_LENGTH"
              :suffix="String(favorites.tagCounts.get(tag.id) ?? 0)"
              :aria-label="`Имя метки ${tag.name}`"
              density="compact"
              variant="outlined"
              hide-details="auto"
              @update:model-value="drafts[tag.id] = $event"
              @blur="onRename(tag.id)"
              @keydown.enter="onRename(tag.id)"
            />

            <!--
              Стрелками, а не перетаскиванием: drag-and-drop без библиотеки —
              это отдельная история для клавиатуры и тач-скрина, а меток десяток,
              и переставить их парой нажатий не тяжелее.
            -->
            <v-btn
              :icon="mdiArrowUp"
              :disabled="index === 0"
              :aria-label="`Переместить «${tag.name}» выше`"
              variant="text"
              size="small"
              @click="favorites.moveTag(tag.id, -1)"
            />
            <v-btn
              :icon="mdiArrowDown"
              :disabled="index === favorites.tags.length - 1"
              :aria-label="`Переместить «${tag.name}» ниже`"
              variant="text"
              size="small"
              @click="favorites.moveTag(tag.id, 1)"
            />
            <v-btn
              :icon="mdiDeleteOutline"
              :aria-label="`Удалить метку «${tag.name}»`"
              variant="text"
              size="small"
              color="error"
              @click="pendingDelete = tag.id"
            />
          </div>
        </div>

        <v-text-field
          v-model="newTagName"
          :append-inner-icon="mdiPlus"
          :maxlength="TAG_NAME_MAX_LENGTH"
          label="Новая метка"
          density="comfortable"
          variant="outlined"
          hide-details
          @keydown.enter.prevent="onCreate"
          @click:append-inner="onCreate"
        />
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-spacer />
        <v-btn variant="tonal" @click="open = false">Готово</v-btn>
      </v-card-actions>
    </v-card>

    <v-dialog :model-value="pendingDelete !== null" max-width="420" @update:model-value="pendingDelete = null">
      <v-card title="Удаление метки" :text="deletingText">
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="pendingDelete = null">Отмена</v-btn>
          <v-btn variant="tonal" color="error" @click="onConfirmDelete">Удалить</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>
