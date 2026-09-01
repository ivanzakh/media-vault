import { createRouter, createWebHistory } from 'vue-router'

import SearchPage from '@/pages/SearchPage.vue'

const router = createRouter({
  // BASE_URL берётся из конфига Vite, чтобы сборка не была привязана к корню домена.
  history: createWebHistory(import.meta.env.BASE_URL),

  // Порядок важен: сначала конкретные пути, затем параметрический, последним catch-all.
  routes: [
    // На этапе 7 корень отойдёт каталогу, поиск останется на /search.
    { path: '/', name: 'home', component: SearchPage },
    { path: '/search', name: 'search', component: SearchPage },
    {
      path: '/favorites',
      name: 'favorites',
      component: () => import('@/pages/FavoritesPage.vue'),
    },
    {
      // Ограничение (movie|tv) не даёт /search и /favorites попасть под этот маршрут.
      path: '/:mediaType(movie|tv)/:id(\\d+)',
      name: 'details',
      component: () => import('@/pages/MediaDetailsPage.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/pages/NotFoundPage.vue'),
    },
  ],

  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

export default router
