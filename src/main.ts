// Vuetify рассчитан на Roboto, но шрифт в пакет не входит и ставится отдельно.
// Три начертания вместо шести: обычный текст, кнопки и заголовки, акценты.
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'

createApp(App).use(createPinia()).use(router).use(vuetify).mount('#app')
