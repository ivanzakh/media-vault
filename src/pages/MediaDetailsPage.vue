<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, onScopeDispose, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { mdiAccountOutline, mdiStar } from '@mdi/js'

import { isAbortError, TmdbError } from '@/api/client'
import { getDetails, imageUrl } from '@/api/media'
import type { MediaDetails, MediaType } from '@/api/types'
import FavoriteButton from '@/components/FavoriteButton.vue'
import MediaPoster from '@/components/MediaPoster.vue'
import {
  detailsToMediaItem,
  formatNumber,
  formatRating,
  formatRuntime,
  plural,
} from '@/utils/format'
import NotFoundPage from './NotFoundPage.vue'

/** Больше шести лиц в ряд уже не читаются как «главные роли». */
const CAST_LIMIT = 6

const route = useRoute()

const details = ref<MediaDetails | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const notFound = ref(false)

// Маршрут ограничен регуляркой `(movie|tv)`, поэтому другого значения тут не будет.
const mediaType = computed(() => route.params.mediaType as MediaType)
const id = computed(() => Number(route.params.id))

let controller: AbortController | undefined

async function load() {
  controller?.abort()
  const current = new AbortController()
  controller = current

  loading.value = true
  error.value = null
  notFound.value = false

  try {
    const data = await getDetails(mediaType.value, id.value, current.signal)
    if (controller !== current) return
    details.value = data
  } catch (e) {
    if (controller !== current || isAbortError(e)) return
    details.value = null
    // Несуществующий id — не поломка, а обычная страница «не найдено».
    if (e instanceof TmdbError && e.status === 404) {
      notFound.value = true
      return
    }
    console.error(e)
    error.value = 'Не удалось загрузить страницу тайтла'
  } finally {
    if (controller === current) loading.value = false
  }
}

/*
  Переход между тайтлами меняет параметры того же маршрута, а не сам маршрут,
  поэтому загрузку вешаем на параметры, а не на монтирование компонента.

  Проверка имени маршрута обязательна: при уходе на другую страницу route
  обновляется раньше, чем компонент размонтируется, и вотчер успевает сработать
  уже с чужими параметрами — то есть на запрос вида `/undefined/NaN`.
*/
watch(
  () => (route.name === 'details' ? `${route.params.mediaType}/${route.params.id}` : null),
  (key) => {
    if (key) load()
  },
  { immediate: true },
)
onScopeDispose(() => controller?.abort())

const backdropUrl = computed(() => imageUrl(details.value?.backdropPath ?? null, 'w1280'))
const cast = computed(() =>
  (details.value?.cast ?? []).slice(0, CAST_LIMIT).map((person) => ({
    id: person.id,
    name: person.name,
    character: person.character,
    photo: imageUrl(person.profile_path, 'w185') ?? undefined,
  })),
)

/** У фильма хронометраж, у сериала — сезоны и серии. */
const lengthText = computed(() => {
  const data = details.value
  if (!data) return null

  if (data.mediaType === 'movie') return formatRuntime(data.runtime)

  const parts: string[] = []
  if (data.seasons) {
    parts.push(`${data.seasons} ${plural(data.seasons, ['сезон', 'сезона', 'сезонов'])}`)
  }
  if (data.episodes) {
    parts.push(`${data.episodes} ${plural(data.episodes, ['серия', 'серии', 'серий'])}`)
  }
  return parts.join(', ') || null
})

/*
  На узких экранах состав прокручивается вбок, и это нужно как-то показать.
  Растушёвка у правого края — подсказка на старте: она висит, пока ленту не
  тронули, и снимается с первым же движением, дальше не мешая смотреть портреты.
*/
const castStrip = ref<HTMLElement | null>(null)
const castHint = ref(false)

function updateCastScroll() {
  const el = castStrip.value
  castHint.value = !!el && el.scrollLeft < 1 && el.clientWidth < el.scrollWidth
}

watch(
  cast,
  async () => {
    await nextTick()
    updateCastScroll()
  },
  { immediate: true },
)

// Поворот экрана меняет ширину ленты, а вместе с ней и наличие прокрутки.
onMounted(() => window.addEventListener('resize', updateCastScroll))
onBeforeUnmount(() => window.removeEventListener('resize', updateCastScroll))

/** Снимок для избранного: в стор уезжает та же форма, что рисует сетка. */
const favoriteItem = computed(() => (details.value ? detailsToMediaItem(details.value) : null))

const votesText = computed(() => {
  const count = details.value?.voteCount ?? 0
  if (!count) return null
  return `${formatNumber(count)} ${plural(count, ['оценка', 'оценки', 'оценок'])}`
})
</script>

<template>
  <NotFoundPage v-if="notFound" />

  <v-container v-else-if="error" class="py-8">
    <v-alert type="error" variant="tonal" :text="error ?? ''">
      <template #append>
        <v-btn variant="text" @click="load">Повторить</v-btn>
      </template>
    </v-alert>
  </v-container>

  <!--
    Скелетон живёт в той же сетке и в том же контейнере, что и загруженная
    страница: иначе после загрузки съезжают и отступы секции, и сам постер.
  -->
  <div v-else-if="loading" class="hero">
    <v-container class="hero__content">
      <div class="details-layout">
        <v-skeleton-loader class="details-poster-skeleton" type="image" />
        <v-skeleton-loader
          class="details-title details-skeleton details-skeleton--title"
          type="heading, text"
        />
        <v-skeleton-loader
          class="details-meta details-skeleton details-skeleton--meta"
          type="chip, chip"
        />
        <v-skeleton-loader
          class="details-body details-skeleton details-skeleton--body"
          type="chip, text, heading, paragraph"
        />
      </div>
    </v-container>
  </div>

  <template v-else-if="details">
    <div class="hero">
      <!--
        Бэкдроп идёт фоном под приглушённой прозрачностью, а не подложкой под
        текст: тогда подписи остаются обычным цветом темы и одинаково читаются
        и в светлой, и в тёмной, без подбора цвета под конкретную картинку.
      -->
      <div
        v-if="backdropUrl"
        class="hero__backdrop"
        :style="{ backgroundImage: `url(${backdropUrl})` }"
        aria-hidden="true"
      />
      <div v-if="backdropUrl" class="hero__fade" aria-hidden="true" />

      <v-container class="hero__content">
        <div class="details-layout">
          <MediaPoster
            class="details-poster"
            :path="details.posterPath"
            :alt="`Постер: ${details.title}`"
          />

          <div class="details-title">
            <h1 class="text-headline-small">{{ details.title }}</h1>
            <p
              v-if="details.originalTitle && details.originalTitle !== details.title"
              class="text-body-medium text-medium-emphasis mt-1"
            >
              {{ details.originalTitle }}
            </p>
          </div>

          <div class="details-meta">
            <div class="d-flex flex-wrap align-center ga-3 text-body-medium">
              <v-chip size="small" variant="tonal">
                {{ details.mediaType === 'movie' ? 'Фильм' : 'Сериал' }}
              </v-chip>
              <span v-if="details.year">{{ details.year }}</span>
              <span v-if="lengthText">{{ lengthText }}</span>
              <span v-if="formatRating(details.voteAverage)" class="d-inline-flex align-center ga-1">
                <v-icon :icon="mdiStar" size="16" color="amber-darken-2" />
                {{ formatRating(details.voteAverage) }}
                <span v-if="votesText" class="text-medium-emphasis">({{ votesText }})</span>
              </span>
            </div>

            <div v-if="details.genres.length" class="d-flex flex-wrap ga-2 mt-4">
              <v-chip
                v-for="genre in details.genres"
                :key="genre.id"
                size="small"
                variant="outlined"
              >
                {{ genre.name }}
              </v-chip>
            </div>
          </div>

          <div class="details-body">
            <FavoriteButton v-if="favoriteItem" :item="favoriteItem" with-label class="mb-6" />

            <p v-if="details.tagline" class="text-body-large font-italic text-medium-emphasis">
              {{ details.tagline }}
            </p>

            <h2 class="text-title-medium mt-6 mb-2">Описание</h2>
            <p class="details-overview text-body-medium">
              {{ details.overview || 'Описание пока не добавлено.' }}
            </p>
          </div>
        </div>
      </v-container>
    </div>

    <v-container v-if="cast.length" class="cast-section">
      <h2 class="text-title-large mb-4">В ролях</h2>
      <div
        ref="castStrip"
        class="cast-grid"
        :class="{ 'cast-grid--fade': castHint }"
        @scroll.passive="updateCastScroll"
      >
        <div v-for="person in cast" :key="person.id" class="cast-person text-center">
          <!--
            Без дефолтного слота: VAvatar рисует `image` только когда слота нет,
            причём наличие слота проверяется до v-if внутри него. Поэтому
            заглушка приходит пропом `icon`, а не разметкой.
          -->
          <v-avatar
            :image="person.photo"
            :icon="person.photo ? undefined : mdiAccountOutline"
            size="96"
            color="surface-light"
            class="mb-2"
          />
          <div class="text-body-small font-weight-medium">{{ person.name }}</div>
          <div
            v-if="person.character"
            class="cast-role text-body-small text-medium-emphasis"
            :title="person.character"
          >
            {{ person.character }}
          </div>
        </div>
      </div>
    </v-container>
  </template>
</template>

<style scoped>
/*
  Ширина растушёвки у ленты состава. Регистрация нужна ровно ради перехода:
  незарегистрированное свойство браузер считает набором токенов и анимировать
  не умеет. @property глобален и вне scoped-механики, поэтому имя с префиксом.
*/
@property --cast-fade {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

/*
  Раскладка собрана на именованных областях, а не на порядке блоков: на широком
  экране постер стоит слева и держит все три текстовых блока, а на узком уходит
  под заголовок и делит строку с метаданными. Порядок в разметке при этом один
  и тот же, меняется только карта областей.
*/
.details-layout {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  grid-template-areas:
    'poster title'
    'poster meta'
    'poster body';
  grid-template-rows: auto auto 1fr;
  align-content: start;
  column-gap: 32px;
  row-gap: 16px;
}

.details-poster,
.details-poster-skeleton {
  grid-area: poster;
  /* Без этого растянутая строка сетки переопределила бы высоту от aspect-ratio. */
  align-self: start;
}

.details-title {
  grid-area: title;
}

.details-meta {
  grid-area: meta;
}

.details-body {
  grid-area: body;
}

/*
  Длина строки, а не ширина колонки: на широком экране описание растянулось бы
  строк по 150 символов, которые тяжело читать — глаз теряет начало следующей.
*/
.details-overview {
  max-width: 68ch;
}

.details-poster-skeleton {
  aspect-ratio: 2 / 3;
  background: transparent;
}

.details-poster-skeleton :deep(.v-skeleton-loader__image) {
  height: 100%;
  border-radius: 8px;
}

/*
  Кости приводим к геометрии реальных блоков. Блочный поток вместо флекса —
  чтобы каждая кость занимала свою строку независимо от собственной ширины:
  у Vuetify соседние кости получают max-width в 50–70%, и во флексе две узкие
  укладываются в одну строку.
*/
.details-skeleton {
  display: block;
  background: transparent;
}

.details-skeleton :deep(.v-skeleton-loader__bone) {
  display: block;
  margin: 0;
}

/*
  Заголовок — 98px: к строке названия (32px) и оригинальному названию (20px)
  добавляются собственные поля h1 и p, которые Vuetify не сбрасывает: 16px
  сверху и снизу у заголовка (0.67em от 24px) и 14px снизу у абзаца.
  Кости стоят по центру своих строк, отсюда и несимметричные отступы.
*/
.details-skeleton--title :deep(.v-skeleton-loader__heading) {
  height: 24px;
  margin-top: 20px;
  max-width: 65%;
}

.details-skeleton--title :deep(.v-skeleton-loader__text) {
  height: 12px;
  margin-top: 24px;
  margin-bottom: 18px;
  max-width: 35%;
}

/* Метаданные: строка с типом и рейтингом плюс строка жанров — 80px. */
.details-skeleton--meta :deep(.v-skeleton-loader__chip) {
  height: 28px;
  max-width: 180px;
}

.details-skeleton--meta :deep(.v-skeleton-loader__chip + .v-skeleton-loader__chip) {
  margin-top: 24px;
  max-width: 240px;
}

/* Кость под кнопку избранного: её высота (40px) плюс mb-6 у самой кнопки. */
.details-skeleton--body :deep(.v-skeleton-loader__chip) {
  height: 40px;
  max-width: 180px;
  border-radius: 20px;
  margin-bottom: 24px;
}

/* Слоган, подзаголовок «Описание» и сам текст. */
.details-skeleton--body :deep(.v-skeleton-loader__text) {
  height: 12px;
  margin-top: 12px;
  max-width: 100%;
}

.details-skeleton--body :deep(.v-skeleton-loader__heading) {
  height: 20px;
  margin-top: 28px;
  max-width: 30%;
}

.hero {
  position: relative;
  isolation: isolate;
}

/*
  Вертикальные отступы секций заданы здесь, а не утилитами py-* в разметке:
  они меняются на узких экранах, и утилита пришлось бы перебивать отсюда же —
  значение жило бы в двух местах сразу. Горизонтальные остаются от v-container.
*/
.hero__content,
.cast-section {
  padding-top: 32px;
  padding-bottom: 32px;
}

.hero__backdrop,
.hero__fade {
  position: absolute;
  inset: 0;
  z-index: -1;
}

.hero__backdrop {
  background-position: center 20%;
  background-size: cover;
  /* Картинка остаётся фактурой, а не фоном под текст. */
  opacity: 0.18;
}

/*
  Растушёвка отдельным слоем, а не через ::after у бэкдропа: иначе она получила
  бы ту же прозрачность 0.18 и перестала бы стыковать картинку с фоном страницы.
*/
.hero__fade {
  background: linear-gradient(to bottom, transparent 30%, rgb(var(--v-theme-background)));
}

.cast-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 20px 16px;
}

/* Длинные роли вроде «Steve Rogers / Captain America» иначе разъезжаются
   на три строки и делают ряд неровным; полный текст остаётся в title. */
.cast-role {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
}

/*
  Мобильный блок держим в конце таблицы. Специфичность у медиазапроса та же, что
  у обычного правила, поэтому побеждает то, что ниже по файлу: стоя выше, эти
  правила молча проигрывали бы базовым .cast-grid и .details-layout.
*/
@media (max-width: 760px) {
  .details-layout {
    /* Постеру 42%: у метаданных остаётся достаточно, чтобы рейтинг с числом
       оценок не разваливался на четыре строки. */
    grid-template-columns: minmax(0, 42%) minmax(0, 1fr);
    /*
      Название остаётся первым: метаданные описывают тайтл, и без названия над
      ними шапка читается как набор атрибутов без подлежащего. Заодно порядок
      на экране совпадает с порядком в разметке.
    */
    grid-template-areas:
      'title title'
      'poster meta'
      'body body';
    grid-template-rows: auto auto auto;
    column-gap: 16px;
    row-gap: 12px;
  }

  /*
    Всё вертикальное ужимается: 32px от шапки и 64px между секциями (32 снизу
    у hero плюс 32 сверху у состава) на экране в 844px по высоте — это заметная
    часть первого экрана, потраченная на пустоту.
  */
  .hero__content {
    padding-top: 16px;
    padding-bottom: 16px;
  }

  .cast-section {
    padding-top: 8px;
    padding-bottom: 24px;
  }

  /*
    Состав уезжает в горизонтальную прокрутку: шесть портретов в две колонки
    занимали бы почти весь экран по вертикали, а здесь это одна строка.
  */
  .cast-grid {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    overflow-x: auto;
    /*
      Лента шире контейнера на его поля, а внутренний отступ возвращает крайние
      портреты на место. В прокручиваемом блоке padding едет вместе с
      содержимым: в покое лента выровнена по тексту, при прокрутке портреты
      уходят под самый край экрана.

      Здесь не должно быть scroll-snap: блок с привязкой выравнивается по
      ближайшей точке сразу после раскладки, а первая точка — левый край первого
      портрета. Браузер подматывал ленту на те самые 16px и съедал отступ ещё
      до первого жеста.
    */
    margin-inline: -16px;
    padding-inline: 16px;

    /*
      Растушёвка маской, а не накладкой сверху: она гасит сам контент и потому
      не зависит от того, что под лентой.

      Плавность даёт анимация ширины растушёвки: у `mask-image` переходов нет,
      а зарегистрированная через @property длина анимируется как обычное число.
      Где @property не поддержан, растушёвка просто исчезает сразу.
    */
    -webkit-mask-image: linear-gradient(to right, #000 calc(100% - var(--cast-fade)), transparent);
    mask-image: linear-gradient(to right, #000 calc(100% - var(--cast-fade)), transparent);
    transition: --cast-fade 0.25s ease;
  }

  .cast-grid--fade {
    --cast-fade: 56px;
  }

  .cast-person {
    /* Ширина ровно по портрету: тогда его край совпадает с краем текста,
       а не отступает от него на половину лишнего места в ячейке. */
    flex: 0 0 96px;
  }
}
</style>
