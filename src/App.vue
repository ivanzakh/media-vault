<script setup lang="ts">
import { mdiHeartOutline, mdiMovieOpenOutline } from '@mdi/js'
import { useDisplay } from 'vuetify'

import SearchAutocomplete from '@/components/SearchAutocomplete.vue'

const { smAndDown } = useDisplay()
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

        <v-btn
          v-if="smAndDown"
          :icon="mdiHeartOutline"
          :to="{ name: 'favorites' }"
          variant="text"
          aria-label="Избранное"
        />
        <v-btn
          v-else
          :prepend-icon="mdiHeartOutline"
          :to="{ name: 'favorites' }"
          variant="text"
          class="flex-shrink-0"
        >
          Избранное
        </v-btn>
      </v-container>
    </v-app-bar>

    <v-main>
      <RouterView />
    </v-main>

    <!--
      Без `app` футер перестаёт быть элементом лейаута и становится обычным
      блоком в конце страницы: он не отнимает высоту на каждом экране, а уезжает
      вместе с содержимым. На коротких страницах его всё равно прижмёт к низу
      окна — v-main занимает весь остаток высоты. flex-grow-0 нужен, чтобы этот
      остаток не делился между ними: у .v-footer в стилях flex: 1 1 auto.
    -->
    <v-footer color="surface" border class="justify-center flex-grow-0">
      <div class="text-center text-body-small text-medium-emphasis py-2">
        <!-- Атрибуция обязательна по условиям использования TMDB API. -->
        <div>
          This product uses the TMDB API but is not endorsed or certified by
          <a href="https://www.themoviedb.org/" target="_blank" rel="noopener">TMDB</a>.
        </div>
      </div>
    </v-footer>
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
