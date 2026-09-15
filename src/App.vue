<script setup lang="ts">
import { mdiHeartOutline, mdiMovieOpenOutline, mdiTrayArrowDown, mdiTrayArrowUp } from '@mdi/js'
import { reactive, ref } from 'vue'
import { useDisplay } from 'vuetify'

import FavoriteCategorySheet from '@/components/FavoriteCategorySheet.vue'
import SearchAutocomplete from '@/components/SearchAutocomplete.vue'
import { useFavoritesStore } from '@/stores/favorites'

const { smAndDown } = useDisplay()

const favorites = useFavoritesStore()

const importInput = ref<HTMLInputElement | null>(null)

const snackbar = reactive({ open: false, text: '', color: 'success' })

function showSnackbar(text: string, color: 'success' | 'error'): void {
  snackbar.text = text
  snackbar.color = color
  snackbar.open = true
}

function exportFavorites(): void {
  const json = favorites.exportToJson()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `media-vault-favorites-${new Date().toISOString().slice(0, 10)}.json`
  link.click()

  URL.revokeObjectURL(url)
}

function triggerImport(): void {
  importInput.value?.click()
}

async function onImportFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Сбрасываем сразу, иначе повторный выбор того же файла не вызовет change.
  input.value = ''
  if (!file) return

  try {
    const text = await file.text()
    const { added, skipped } = favorites.importFromJson(text)
    showSnackbar(`Импортировано: ${added}, уже было в избранном: ${skipped}`, 'success')
  } catch (e) {
    showSnackbar(e instanceof Error ? e.message : 'Не удалось импортировать файл', 'error')
  }
}
</script>

<template>
  <v-app>
    <v-app-bar :elevation="1" color="surface">
      <v-container class="d-flex align-center ga-3 py-0">
        <RouterLink to="/" class="app-logo">
          <v-icon :icon="mdiMovieOpenOutline" size="26" color="primary" />
          <span v-if="!smAndDown" class="text-title-large font-weight-medium">Media Vault</span>
        </RouterLink>

        <SearchAutocomplete class="flex-grow-1" />

        <!--
          model-value гасит бейдж на нуле: пустой кружок рядом с сердечком
          читался бы как «что-то есть, но не показано».
        -->
        <v-badge
          :model-value="favorites.count > 0"
          :content="favorites.count"
          color="primary"
          offset-x="6"
          offset-y="6"
          class="flex-shrink-0"
        >
          <v-btn
            v-if="smAndDown"
            :icon="mdiHeartOutline"
            :to="{ name: 'favorites' }"
            variant="text"
            aria-label="Избранное"
          />
          <v-btn v-else :prepend-icon="mdiHeartOutline" :to="{ name: 'favorites' }" variant="text">
            Избранное
          </v-btn>
        </v-badge>
      </v-container>
    </v-app-bar>

    <v-main>
      <RouterView />
    </v-main>

    <!--
      Один экземпляр на всё приложение: сердечки со всех страниц открывают его
      через `useCategorySheet`, а не носят по листу каждое.
    -->
    <FavoriteCategorySheet />

    <!--
      Без `app` футер перестаёт быть элементом лейаута и становится обычным
      блоком в конце страницы: он не отнимает высоту на каждом экране, а уезжает
      вместе с содержимым. На коротких страницах его всё равно прижмёт к низу
      окна — v-main занимает весь остаток высоты. flex-grow-0 нужен, чтобы этот
      остаток не делился между ними: у .v-footer в стилях flex: 1 1 auto.
    -->
    <v-footer color="surface" border class="flex-grow-0">
      <v-container
        class="d-flex flex-column flex-sm-row align-center justify-sm-space-between ga-3 py-3"
      >
        <div class="text-center text-sm-left text-body-small text-medium-emphasis">
          <!-- Атрибуция обязательна по условиям использования TMDB API. -->
          This product uses the TMDB API but is not endorsed or certified by
          <a href="https://www.themoviedb.org/" target="_blank" rel="noopener">TMDB</a>.
        </div>

        <div class="d-flex ga-2 flex-shrink-0">
          <v-btn
            :prepend-icon="mdiTrayArrowDown"
            :disabled="favorites.count === 0"
            color="primary"
            variant="flat"
            @click="exportFavorites"
          >
            Экспорт
          </v-btn>
          <v-btn
            :prepend-icon="mdiTrayArrowUp"
            color="primary"
            variant="flat"
            @click="triggerImport"
          >
            Импорт
          </v-btn>
          <input
            ref="importInput"
            type="file"
            accept="application/json"
            hidden
            @change="onImportFileChange"
          />
        </div>
      </v-container>
    </v-footer>

    <v-snackbar v-model="snackbar.open" :color="snackbar.color" timeout="4000">
      {{ snackbar.text }}
    </v-snackbar>
  </v-app>
</template>

<style scoped>
.app-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  color: inherit;
  text-decoration: none;
}
</style>
