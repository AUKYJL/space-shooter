/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly ENV?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
