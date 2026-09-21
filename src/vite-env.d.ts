/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** One-Axie R1 buddy loop client flag (baked at build time). '1' to enable. */
  readonly VITE_BUDDY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
