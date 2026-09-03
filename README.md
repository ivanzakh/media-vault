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
собирает проект и публикует `dist/` как **project site** этого же репозитория —
https://ivanzakh.github.io/media-vault/. Источник публикации в настройках репозитория должен
быть выставлен в «GitHub Actions», отдельная ветка `gh-pages` при этом не используется.

Project site всегда раздаётся по имени репозитория, поэтому `base` в
[vite.config.ts](vite.config.ts) прибит к `/media-vault/`: переименование репозитория ломает
пути к ассетам, менять нужно вместе.

Репозиторий обязан оставаться **публичным** — Pages из приватного репозитория доступны только
на платных тарифах.

### Глубокие ссылки (F5 на `/favorites` и деталке)

Pages не умеет rewrite: файла `/media-vault/favorites` на диске нет, и вернуть вместо него
`index.html` нечем. Единственная точка, куда можно вклиниться, — `404.html`, который project
site отдаёт на любой несуществующий путь внутри `/media-vault/`. Поэтому скрипт `postbuild` в
[package.json](package.json) кладёт в `dist/404.html` копию `index.html`: браузер получает то
же приложение, роутер видит настоящий адрес и открывает нужную страницу.

Цена решения — HTTP-статус 404 на первом ответе, хотя страница рендерится нормально.
Пользователю это незаметно, поисковым роботам — нет.

Важно: это работает **только** пока приложение является отдельным сайтом. Раньше оно
публиковалось в подкаталог `projects/media-vault` сайта-портфолио, и там тот же `404.html` не
срабатывал вовсе: у подкаталогов нет своей 404-области, Pages берёт кастомный 404 только из
корня сайта.
