/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** TMDB API Read Access Token (v4), начинается с `eyJ`. Задаётся в `.env.local`. */
  readonly VITE_TMDB_TOKEN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
