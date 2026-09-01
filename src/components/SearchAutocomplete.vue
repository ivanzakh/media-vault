<script setup lang="ts">
import { ref } from 'vue'
import { mdiMagnify } from '@mdi/js'

// Этап 1 — только вёрстка поля. Запросы, дебаунс и подсказки придут на этапах 2–3.
const query = ref('')
</script>

<template>
  <v-text-field
    v-model="query"
    :prepend-inner-icon="mdiMagnify"
    placeholder="Фильм или сериал"
    variant="solo-filled"
    density="compact"
    rounded="lg"
    flat
    single-line
    hide-details
    clearable
  />
</template>
