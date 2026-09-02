<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  mdiChevronLeft,
  mdiChevronRight,
  mdiUnfoldLessHorizontal,
  mdiUnfoldMoreHorizontal,
} from '@mdi/js'
import { useDisplay } from 'vuetify'

import { useFavoritesStore } from '@/stores/favorites'
import { UNTAGGED } from '@/utils/favorites'

/** Насколько уезжает полоса по нажатию стрелки — почти экран, но с нахлёстом. */
const SCROLL_STEP_RATIO = 0.8

/** Столько же стоит в `move-class`; держим числа рядом, чтобы не разъезжались. */
const COLLAPSE_DURATION = 260

const props = defineProps<{ tagIds: string[] }>()

/**
 * Компонент ничего не решает сам: он отдаёт наверх новый набор меток, а всю
 * запись в URL делает страница. Так источник правды остаётся один.
 */
const emit = defineEmits<{ change: [tagIds: string[]] }>()

const favorites = useFavoritesStore()
const { mobile } = useDisplay()

interface Entry {
  id: string
  name: string
  count: number
}

const selected = computed(() => new Set(props.tagIds))

/**
 * Активные метки идут первыми: в свёрнутом режиме иначе пришлось бы листать до
 * той, которую только что выбрали. Внутри каждой половины сохраняется порядок
 * реестра, заданный в диалоге управления.
 */
const ordered = computed<Entry[]>(() => {
  const entries: Entry[] = favorites.tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    count: favorites.tagCounts.get(tag.id) ?? 0,
  }))

  // «Без меток» — последней в общем ряду: это не метка, а способ найти
  // неразобранное, и в начале списка она отвлекала бы от настоящих.
  // Показываем, только если такие тайтлы есть или фильтр уже стоит по ней.
  if (favorites.untaggedCount > 0 || selected.value.has(UNTAGGED)) {
    entries.push({ id: UNTAGGED, name: 'Без меток', count: favorites.untaggedCount })
  }

  return [
    ...entries.filter((entry) => selected.value.has(entry.id)),
    ...entries.filter((entry) => !selected.value.has(entry.id)),
  ]
})

/*
  `null` — режим определяется автоматически: обзор, пока фильтр не задан, и
  строка, как только выбрана метка. Логика в том, что до выбора ценность в
  полном списке вариантов, а после — в месте под сетку. Клик по кнопке
  фиксирует режим руками и перебивает автоматику до ухода со страницы.
*/
const manualExpanded = ref<boolean | null>(null)

const collapsed = computed(() =>
  manualExpanded.value === null ? props.tagIds.length > 0 : !manualExpanded.value,
)

function toggleCollapsed(): void {
  manualExpanded.value = collapsed.value
}

const scrollerEl = ref<HTMLElement | null>(null)

/** Полоса не помещается: в строку — по ширине, в обзоре — по числу строк. */
const overflowing = ref(false)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

function measure(): void {
  const el = scrollerEl.value
  if (!el) return

  if (collapsed.value) {
    overflowing.value = el.scrollWidth > el.clientWidth + 1
    canScrollLeft.value = el.scrollLeft > 1
    canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
    return
  }

  // В обзоре сворачивать есть смысл, только если чипы реально перенеслись на
  // вторую строку: при трёх метках кнопка была бы кнопкой в никуда.
  const rowHeight = (el.querySelector('.tag-chip') as HTMLElement | null)?.offsetHeight ?? 0
  overflowing.value = rowHeight > 0 && el.scrollHeight > rowHeight + 1
  canScrollLeft.value = false
  canScrollRight.value = false
}

function scrollBy(direction: -1 | 1): void {
  const el = scrollerEl.value
  if (!el) return

  el.scrollBy({ left: direction * el.clientWidth * SCROLL_STEP_RATIO, behavior: 'smooth' })
}

/*
  Анимации здесь три, и все они — про одно движение: выбранная метка уезжает
  влево, соседи расступаются, полоса схлопывается в строку. Перестановку чипов
  и перенос строк доигрывает `<TransitionGroup>` (он сам меряет позиции до и
  после и доводит разницу через transform), а вручную остаётся высота
  контейнера и две прокрутки — их FLIP не покрывает.
*/
const reducedMotion =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null

function prefersReducedMotion(): boolean {
  return reducedMotion?.matches ?? false
}

function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth'
}

let heightTimer: ReturnType<typeof setTimeout> | undefined

/**
 * FLIP двигает детей, но высота родителя меняется скачком, и сетка под полосой
 * дёргается. Замеряем высоту до перестроения, ставим её жёстко, после
 * перерисовки переезжаем на новую и снимаем фиксацию.
 */
async function animateHeight(): Promise<void> {
  const el = scrollerEl.value
  if (!el) return

  if (prefersReducedMotion()) {
    await nextTick()
    measure()
    return
  }

  // Вотчер с flush: 'pre' — класс режима ещё не применён, высота старая.
  const from = el.offsetHeight

  await nextTick()

  const to = el.offsetHeight
  if (from === to) {
    measure()
    return
  }

  clearTimeout(heightTimer)
  el.style.transition = 'none'
  el.style.height = `${from}px`
  // Принудительный reflow: без него браузер склеит оба присваивания в одно
  // и перехода не будет вовсе.
  void el.offsetHeight
  el.style.transition = `height ${COLLAPSE_DURATION}ms cubic-bezier(0.2, 0, 0, 1)`
  el.style.height = `${to}px`

  // По таймеру, а не по transitionend: событие не приходит, если переход
  // прервали новым кликом, и высота осталась бы зафиксированной навсегда.
  heightTimer = setTimeout(() => {
    el.style.transition = ''
    el.style.height = ''
    measure()
  }, COLLAPSE_DURATION)
}

watch(collapsed, (isCollapsed) => {
  void animateHeight()

  if (!isCollapsed) return

  // Свёрнутая полоса могла остаться прокрученной вправо, а активная метка
  // уезжает в начало — без этого она приземлилась бы за левым краем.
  scrollerEl.value?.scrollTo({ left: 0, behavior: scrollBehavior() })

  // Автоматическое сворачивание случается после выбора метки, а её могли
  // выбрать, прокрутив длинный обзор вниз: тогда человек остался бы посреди
  // сетки. Ручное сворачивание страницу не трогает — позиция выбрана осознанно.
  if (manualExpanded.value === null) {
    window.scrollTo({ top: 0, behavior: scrollBehavior() })
  }
})

let observer: ResizeObserver | undefined

onMounted(() => {
  measure()

  // Ширина полосы меняется и от размера окна, и от появления новых меток —
  // наблюдаем за элементом, а не подписываемся на resize окна.
  if (!scrollerEl.value) return

  observer = new ResizeObserver(measure)
  observer.observe(scrollerEl.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  clearTimeout(heightTimer)
})

// Состав меток меняет обе метрики, а ResizeObserver на это не сработает:
// внешние размеры полосы при перестановке чипов те же.
watch(ordered, () => requestAnimationFrame(measure))

/**
 * Свёрнутая полоса прокручивается, а Tab по чипам об этом не знает: фокус
 * уезжает за видимый край, и человек ведёт по невидимым кнопкам. Браузер сам
 * подкручивает только тот контейнер, который считает прокручиваемым в момент
 * фокуса, — в горизонтальной полосе на это полагаться нельзя.
 */
function onFocusIn(event: FocusEvent): void {
  if (!collapsed.value) return

  const target = event.target as HTMLElement | null
  target?.closest('.tag-chip')?.scrollIntoView({
    inline: 'nearest',
    block: 'nearest',
    behavior: scrollBehavior(),
  })
}

function onToggle(id: string): void {
  emit(
    'change',
    selected.value.has(id) ? props.tagIds.filter((tagId) => tagId !== id) : [...props.tagIds, id],
  )
}
</script>

<template>
  <div v-if="ordered.length" class="d-flex align-center ga-2">
    <!--
      «Все» закреплён вне прокручиваемой области: сброс должен быть под рукой
      всегда, а не уезжать за левый край вместе с остальными чипами. Пока ничего
      не выбрано, сбрасывать нечего — чип не показываем.
    -->
    <v-chip v-if="tagIds.length" variant="tonal" class="flex-shrink-0" @click="emit('change', [])">
      Все
    </v-chip>

    <v-btn
      v-if="!mobile && canScrollLeft"
      :icon="mdiChevronLeft"
      variant="text"
      size="small"
      aria-label="Прокрутить метки влево"
      @click="scrollBy(-1)"
    />

    <!-- Стрелки прячутся у краёв, а прокрутить можно ещё свайпом и колесом —
         поэтому их видимость пересчитываем на самом событии прокрутки. -->
    <div
      ref="scrollerEl"
      class="tag-scroller"
      :class="{ 'tag-scroller--collapsed': collapsed }"
      @scroll.passive="measure"
      @focusin="onFocusIn"
    >
      <TransitionGroup tag="div" move-class="tag-move" class="tag-row">
        <v-chip
          v-for="entry in ordered"
          :key="entry.id"
          :color="selected.has(entry.id) ? 'primary' : undefined"
          :variant="selected.has(entry.id) ? 'flat' : 'tonal'"
          :class="{ 'tag-chip--active': selected.has(entry.id) }"
          :title="entry.name"
          :aria-pressed="selected.has(entry.id)"
          class="tag-chip"
          @click="onToggle(entry.id)"
        >
          {{ entry.name }}
          <span class="tag-chip__count">{{ entry.count }}</span>
        </v-chip>
      </TransitionGroup>
    </div>

    <v-btn
      v-if="!mobile && canScrollRight"
      :icon="mdiChevronRight"
      variant="text"
      size="small"
      aria-label="Прокрутить метки вправо"
      @click="scrollBy(1)"
    />

    <v-btn
      v-if="overflowing"
      :icon="collapsed ? mdiUnfoldMoreHorizontal : mdiUnfoldLessHorizontal"
      :aria-label="collapsed ? 'Показать все метки' : 'Свернуть метки в строку'"
      :aria-expanded="!collapsed"
      variant="text"
      size="small"
      class="flex-shrink-0"
      @click="toggleCollapsed"
    />
  </div>
</template>

<style scoped>
.tag-scroller {
  /* min-width: 0 обязателен: иначе флекс-элемент не даёт себя сжать ниже
     ширины содержимого, и вместо прокрутки внутри полосы горизонтальную
     прокрутку получает вся страница. */
  min-width: 0;
  flex-grow: 1;
  /* Высотой управляет animateHeight на время перехода; overflow-y скрыт, чтобы
     на промежуточных кадрах не выскакивала вертикальная полоса прокрутки. */
  overflow-y: hidden;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-scroller--collapsed {
  overflow-x: auto;
  /* Своя полоса прокрутки здесь только мешает: ряд низкий, и она съедает
     половину его высоты. Прокрутка остаётся свайпом, колесом и стрелками. */
  scrollbar-width: none;
}

.tag-scroller--collapsed::-webkit-scrollbar {
  display: none;
}

.tag-scroller--collapsed .tag-row {
  flex-wrap: nowrap;
}

.tag-scroller--collapsed .tag-chip {
  flex: 0 0 auto;
}

/*
  Многоточие только в свёрнутой строке и только у невыбранных: «Фильмы на
  Рождество» иначе съедает половину полосы. Что именно применено, человек
  должен читать целиком, поэтому активные чипы не режем — их немного, и они
  стоят первыми.
*/
.tag-scroller--collapsed .tag-chip:not(.tag-chip--active) {
  max-width: 12rem;
}

.tag-scroller--collapsed .tag-chip:not(.tag-chip--active) :deep(.v-chip__content) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/*
  Приглушаем прозрачностью, а не text-medium-emphasis: у активного чипа фон
  залит primary, и токен приглушённого текста на нём почти не читается.
*/
.tag-chip__count {
  margin-left: 6px;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}

/* Класс от TransitionGroup: он вешает его на чипы, доезжающие на новое место. */
.tag-move {
  transition: transform 260ms cubic-bezier(0.2, 0, 0, 1);
}

@media (prefers-reduced-motion: reduce) {
  .tag-move {
    transition: none;
  }
}
</style>
