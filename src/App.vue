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
          <span v-if="!smAndDown" class="text-h6 font-weight-medium">Media Vault</span>
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

    <!-- app: футер становится элементом лейаута, v-main сам получает отступ снизу. -->
    <v-footer app color="surface" border class="justify-center">
      <div class="text-center text-caption text-medium-emphasis py-2">
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
