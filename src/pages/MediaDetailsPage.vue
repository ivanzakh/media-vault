<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <v-container class="py-8">
    <h1 class="text-headline-small mb-2">Детальная страница</h1>
    <p class="text-body-medium text-medium-emphasis">
      Тип: <code>{{ route.params.mediaType }}</code
      >, ID: <code>{{ route.params.id }}</code>
    </p>
  </v-container>
</template>
