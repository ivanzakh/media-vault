# media-vault

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

## Деплой

При пуше в `main` GitHub Actions ([.github/workflows/deploy.yml](.github/workflows/deploy.yml))
собирает проект и пушит `dist/` в `projects/media-vault` репозитория
[ivanzakh.github.io](https://github.com/ivanzakh/ivanzakh.github.io) (классические GitHub Pages,
раздаётся напрямую из ветки `master` этого репозитория).

**Никогда не ставить `force_orphan: true`** на шаге `peaceiris/actions-gh-pages`. Если клонирование
целевого репозитория провалится (истёкший `PAGES_DEPLOY_TOKEN`, опечатка в `publish_branch`,
сетевой сбой), экшен не падает — он молча создаёт orphan-ветку. Без `force_orphan` такой пуш
просто отклоняется как non-fast-forward (красный CI, ничего не потеряно). С `force_orphan: true`
он форсированно запушится и снесёт **весь** сайт ivanzakh.github.io, заменив его веткой с
единственным содержимым — `projects/media-vault`.
