<script setup lang="ts">
import { computed } from 'vue'
import { mdiHeartOutline } from '@mdi/js'

import MediaGrid from '@/components/MediaGrid.vue'
import { useFavoritesStore } from '@/stores/favorites'
import { formatNumber, plural } from '@/utils/format'

const favorites = useFavoritesStore()

const countText = computed(
  () => `${formatNumber(favorites.count)} ${plural(favorites.count, ['тайтл', 'тайтла', 'тайтлов'])}`,
)
</script>

<template>
  <v-container class="py-6">
    <div class="d-flex align-baseline flex-wrap ga-3 mb-4">
      <h1 class="text-headline-small">Избранное</h1>
      <span v-if="favorites.count" class="text-body-medium text-medium-emphasis">
        {{ countText }}
      </span>
    </div>

    <!--
      Пагинации здесь нет намеренно: список лежит в памяти целиком, страницы
      делить не из чего. Сетка та же, что в поиске, — карточки должны выглядеть
      одинаково везде.
    -->
    <MediaGrid
      :items="favorites.items"
      :empty-icon="mdiHeartOutline"
      empty-title="Здесь пока пусто"
      empty-text="Нажмите сердечко на карточке или на странице тайтла — он появится здесь."
    >
      <template #empty-actions>
        <v-btn :to="{ name: 'search' }" variant="tonal">Перейти к поиску</v-btn>
      </template>
    </MediaGrid>
  </v-container>
</template>
