import { ref } from 'vue'

import type { MediaItem } from '@/api/types'

/*
  Состояние живёт в модуле, а не внутри компонента, поэтому лист один на всё
  приложение. Класть `<v-bottom-sheet>` внутрь `FavoriteButton` нельзя: на
  странице каталога двадцать карточек, и это были бы двадцать телепортов в
  `<body>` — по одному на кнопку. Вместо этого лист смонтирован единожды в
  `App.vue`, а кнопки только сообщают ему, какой тайтл показывать.

  Композабл, а не Pinia-стор: в `src/stores/` по сложившемуся в проекте
  разделению лежат данные, а это состояние интерфейса.
*/
const item = ref<MediaItem | null>(null)
const isOpen = ref(false)

export function useCategorySheet() {
  function open(target: MediaItem): void {
    item.value = target
    isOpen.value = true
  }

  function close(): void {
    isOpen.value = false
    // Сам тайтл не сбрасываем: лист закрывается с анимацией, и обнуление на
    // этом кадре выдернуло бы из-под неё название с постером.
  }

  return { item, isOpen, open, close }
}
