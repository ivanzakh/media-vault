import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import vuetify from 'vite-plugin-vuetify'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // GitHub Pages раздаёт project site по имени репозитория, поэтому прод
  // собирается под /media-vault/ — переименование репозитория ломает базу.
  // Различаем по mode, а не по command: `vite preview` тоже резолвит конфиг
  // с command === 'serve', и по command база в превью схлопнулась бы в '/'.
  // У build и preview mode === 'production', у dev — 'development'.
  base: mode === 'production' ? '/media-vault/' : '/',
  plugins: [
    vue(),
    vueDevTools(),
    // autoImport подтягивает только реально использованные компоненты и их стили,
    // поэтому регистрировать <v-btn> и остальные руками не нужно.
    vuetify({ autoImport: true }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
}))
