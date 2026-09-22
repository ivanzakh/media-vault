<template>
  <!--
    Обычный <header>, а не v-toolbar: у тулбара фиксированная высота и
    overflow: hidden, а шапка на узком экране переносится на вторую строку,
    которую он бы обрезал. Внутри <main> тег не становится ориентиром banner
    и с шапкой сайта не спорит.
  -->
  <header class="d-flex align-center flex-wrap ga-3 mb-4">
    <slot name="prepend" />

    <!--
      Заголовок и подпись к нему выравниваются по базовой линии: при разных
      размерах шрифта центровка сажает мелкий текст заметно выше строки заголовка.
      Кнопки снаружи группы остаются по центру ряда.
    -->
    <div class="d-flex align-baseline flex-wrap ga-3">
      <h1 class="text-headline-small">{{ title }}</h1>
      <slot name="meta" />
    </div>

    <template v-if="$slots.actions">
      <v-spacer />
      <slot name="actions" />
    </template>
  </header>
</template>

<script setup lang="ts">
defineProps<{ title: string }>()

defineSlots<{
  /** Перед заголовком — например, кнопка «назад». */
  prepend?: () => unknown
  /** Сразу после заголовка: счётчик результатов или его скелетон. */
  meta?: () => unknown
  /** Прижаты к правому краю. */
  actions?: () => unknown
}>()
</script>
