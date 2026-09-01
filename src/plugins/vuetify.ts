import 'vuetify/styles'

import { createVuetify } from 'vuetify'
import { ru } from 'vuetify/locale'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'

export default createVuetify({
  locale: { locale: 'ru', fallback: 'en', messages: { ru } },

  // mdi-svg: иконки приходят строками с SVG-путями из @mdi/js,
  // иконочный шрифт не загружается вообще.
  icons: { defaultSet: 'mdi', aliases, sets: { mdi } },

  theme: {
    // 'system' опирается на prefers-color-scheme и пересчитывается в рантайме,
    // поэтому смена темы в настройках ОС видна без перезагрузки страницы.
    defaultTheme: 'system',
    themes: {
      light: {
        dark: false,
        colors: {
          background: '#F4F5F7',
          surface: '#FFFFFF',
          primary: '#1B5E9E',
          secondary: '#546E7A',
        },
      },
      dark: {
        dark: true,
        colors: {
          background: '#101215',
          surface: '#181B1F',
          primary: '#69A9E8',
          secondary: '#90A4AE',
        },
      },
    },
  },
})
