/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WAYPOINT_CLIENT_ID?: string
  /** Ronin chain id — default 2020 (mainnet). Saigon testnet: 2021. */
  readonly VITE_WAYPOINT_CHAIN_ID?: string
  /** One-Axie R1 buddy loop client flag (baked at build time). '1' to enable. */
  readonly VITE_BUDDY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
