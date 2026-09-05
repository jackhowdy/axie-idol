/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WAYPOINT_CLIENT_ID?: string
  /** Ronin chain id — default 2020 (mainnet). Saigon testnet: 2021. */
  readonly VITE_WAYPOINT_CHAIN_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
