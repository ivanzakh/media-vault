<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <v-container class="py-8">
    <h1 class="text-h5 mb-2">Детальная страница</h1>
    <p class="text-body-2 text-medium-emphasis">
      Тип: <code>{{ route.params.mediaType }}</code
      >, ID: <code>{{ route.params.id }}</code>
    </p>
  </v-container>
</template>
