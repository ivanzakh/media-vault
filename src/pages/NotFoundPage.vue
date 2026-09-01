<script setup lang="ts"></script>

<template>
  <v-container class="py-16 text-center">
    <div class="text-h2 font-weight-medium mb-2">404</div>
    <p class="text-body-1 text-medium-emphasis mb-6">Такой страницы нет.</p>
    <v-btn :to="{ name: 'home' }" color="primary" variant="flat">На главную</v-btn>
  </v-container>
</template>
