# Axie Idol — SLP prestige burns (Round 1)

**Mode:** `ledger` (“Demo burn (ledger)”) — app records burns only. No Solidity deploy, no Ronin RPC SLP transfers in R1. Later `IdolBurnSink` can settle `pending` records with `txHash`.

**UI gated for R2; enable with `?burns=1`.**

## Constants (`server.mjs`)

| Constant | Value | Role |
|----------|------:|------|
| `DAILY_POT_SLP` | 10000 | Manila-day treasury pot for crown (after sparks) |
| `SPARK_SLP` | 50 | Instant burn on successful **owned** numeric post |
| Fan boost | 1–10000 | Fan-funded ledger burn (sponsorship OK) |
| Spark rate | 1 / address / hour | Separate from post rate limit |
| Boost rate | 10 / address / hour | Registered address required |

## Product locks

- Prestige **burn** (destroy / record burn in Axie’s name) — **not** payout SLP to owners.
- **Spark:** registered owner posts as owned numeric Axie → `SPARK_SLP` to that `axieId`. Free-cast → **no** spark.
- **Crown:** at Manila day end, remaining pot (`DAILY_POT − sparks that day`) splits by that day’s Idol Points for **numeric** axieIds only. Free-cast mascots excluded.
- **Fan boost:** any registered address can boost any numeric `axieId` (ledger debit from fan).
- **Projected crown:** live “if day ended now” split of `potRemaining` by today’s numeric points.

## Ledger (`data/burns.json`)

```json
{
  "mode": "ledger",
  "settledDays": ["2026-09-03"],
  "records": [{
    "id": "uuid",
    "dayKey": "2026-09-04",
    "axieId": "90",
    "amount": 50,
    "kind": "spark|crown|fan",
    "funder": "treasury|0x…",
    "status": "pending",
    "txHash": null,
    "createdAt": 0,
    "mode": "ledger"
  }]
}
```

## APIs

- `GET /api/burns/today` → `{ dayKey, pot, sparkAmount, committed.byAxie, projectedCrown, potRemaining, mode, modeLabel }`
- Also embedded as `burns` on `/api/feed`, `/api/board`, `/api/profile`, post/like/comment responses.
- `POST /api/burns/boost` `{ address, axieId, amount }` → fan ledger burn.
- `POST /api/burns/settle-day` `{ dayKey? }` or `{ all: true }` — crowns for past Manila days. **Auto-settles** on feed/board/burns reads when the day rolls.

## Chain next

Wire `IdolBurnSink` to batch `pending` by `{ dayKey, axieId, amount, kind }` and set `txHash` / `status: "settled"`.
