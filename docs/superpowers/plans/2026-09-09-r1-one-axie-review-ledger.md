# SDD ledger — plan: docs/superpowers/plans/2026-09-09-r1-one-axie.md
Branch: r1-one-axie (in-place checkout; mixer pack is git-ignored so no worktree). Baseline: 20 tests green at 7ffbb86.
Task 1: minor (deferred): partCatalogue.json lacks trailing newline; magic 10 threshold; minified JSON
Task 1: complete (commits 7ffbb86..41dd8ef, review clean)
Task 2: fix round 1/5 (2 addressed, 0 open — mystic slot additive to rares + Fisher-Yates slots; commits a0651a7..4632559)
Task 2: minor (deferred): rollWild silently falls back to normal pool if a rare/mystic bucket is empty; wishForToday last-resort fallback may repeat a done wish; place bonus counts places-1 (matches test)
Task 2: complete (commits 41dd8ef..4632559, review clean after 1 fix round). NOTE: rollWild now returns { descriptor, class, rareIds, mysticId, mystic }.
Task 3: fix round 1/5 (1 addressed, 0 open — pickLine fallback templates-only; commits a01c1a2..116d181)
Task 3: minor (deferred): EMOJI regex misses flag emoji; 14-word rule allows exactly 14; six lines condensed lossy (Foodie hatch/return, Goofball hatch, Show-off hatch/before, Shy hatch)
Task 3: complete (commits 4632559..116d181, review clean after 1 fix round)
Task 4: minor (deferred): ownerKeyFrom computed twice in handleCreatePost; no tests for wish/done, wear, before; verifySession dead until Task 7
Task 4: fix round 1/5 (2 addressed, 0 open — keep bondByDay through hatch; cast gate reverted to kotaro-only; commits 059905e..1d7a50f)
Task 4: complete (commits 116d181..1d7a50f, review clean after 1 fix round)
PLAN NOTE for Task 13: MAX_POSTS_PER_HOUR=10 per device (core.mjs:1279) equals the daily bond cap and will 429 real players who shoot more than 10 photos in an hour; raise for buddy posts (e.g. 40/hour) in Task 13.
Task 5: minor (deferred): ladder `you` is null for an active buddy with no bond yet this month (matches plan); moment "hundredth" title/line spell a number in words (bible rule 7 grey area)
Task 5: complete (commits 1d7a50f..db70c92, review clean)
Task 6: fix round 1/5 (1 addressed, 0 open — exact pins; commits c324c82..fc23893)
Task 6: complete (commits db70c92..fc23893, review clean after 1 fix round)
Task 7: minor (deferred): nonces for never-verifying addresses accumulate; bad-signature test is not isolated from nonce liveness; owned rarity boolean-derived (0.03/0.5); claim discards a pending unhatched egg
Task 7: fix round 1/5 (1 addressed, 0 open — recovery guest-only, self-redeem not burned; commits 1aef64b..031f4fa)
Task 7: complete (commits fc23893..031f4fa, review clean after 1 fix round)
Task 8: minor (deferred): snapContext placeType/district typed but never set
Task 8: fix round 1/5 (2 addressed, 0 open — wish.id nullable, localStorage guarded; commits 3fcf5db..cc22c99)
Task 8: complete (commits 031f4fa..cc22c99, review clean after 1 fix round)
Task 9: RATIFIED deviation: hatch reveal uses a tap-through button (no 4.5 s auto-advance) — better than the plan.
Task 9: minor (deferred): numeric fields unescaped in monthlyHtml (typed numbers); `switch` action wired without UI; chipHtml/wishPillHtml naming vs Task 10 brief (Task 10 must add vfChipHtml instead); scrapbook thumbnails placeholder until photos carry imagePath; claimed Axies have no descriptor (server) so no part chips
Task 9: complete (commits cc22c99..8efbedf, review clean)
Task 10: minor (deferred): before-shot bubble inside aria-hidden sticker layer; diary thumbnails fall back to placeholder beyond the 60-photo cap; no unit tests for syncQuestHud/showViewfinderFromFeed gating
Task 10: fix round 1/5 (2 addressed + bonus X-Buddy-Session on posts, 0 open; commits e720a18..7f97235)
Task 10: minor (deferred): stale body.address after the kotaro retry (no effect); spark-victory modal not shown under the flag; owned-post retry path untested end-to-end (needs chain)
Task 10: complete (commits 8efbedf..7f97235, review clean after 1 fix round)
PLAN NOTE for Task 13 (seen in browser 2026-09-09): under the flag the camera still shows the legacy YOUR CREW cast tray (Kotaro + locked Lv slots) and "Bring my Axies"; hide #cast-tray, prop tray and inventory tray under buddyEnabled. Wardrobe overlay canvas is hidden while the camera gate is up (expected). Before-shot line, chip and wish pill render correctly.
Task 11: minor (deferred): resize() vs syncOverlaySize measure sources may differ sub-pixel; no DOM test for overlay visibility path; anchor offsets retuned by calculation, need one visual look
Task 11: fix round 1/5 (1 addressed, 0 open — overlay show-before-measure; commits 89d66ba..7e3d1b8). Controller browser check: hat renders on Home hero and camera overlay paints (4104 px).
Task 11: minor (deferred): stale overlay frame if clientWidth transiently <8 px; hero clips tall headwear (116 px box); frames stretch on non-3:4 captures
Task 11: complete (commits 7f97235..7e3d1b8, review clean after 1 fix round)
Task 12: controller browser check: diary, monthly ladder and talk render with real data. minor (deferred): monthly header shows "2026-09 IDOLS" (should be the month name); memoryLine picks a variant by rng so "where you hatched" can answer with the places line; NOTE dist/ was missing before Task 12 visual check (rebuilt with vite build).
Task 12: minor (deferred): no test for the 200-char talk truncation; empty talk submit is silent
Task 12: fix round 1/5 (2 addressed, 0 open — talk always reachable, memoryLine text-aware; commits be6063d..034a9fb)
Task 12: complete (commits 7e3d1b8..034a9fb, review clean after 1 fix round)
Task 13: controller browser check: camera shows wardrobe tray (Hat worn, Bond 2/3/5/7 locked), no crew/prop/inventory tray, no tab bar, feed not active, onboard/board/profile hidden.
Task 13: minor (deferred): brief blank frame at boot before the buddy screen paints; report undercounted endpoints (17 in README table)
Task 13: fix round 1/5 (1 addressed, 0 open — admin seed-bond hook + device persistence; commits 353bb82..df123d4)
Task 13: minor (deferred): admin key compare not constant-time; PODIUM fixed at 8; hook writes absolute bond
Task 13: complete (commits 034a9fb..df123d4, review clean after 1 fix round)
FINAL REVIEW (opus): with fixes — 1 Critical (unlimited writes / nonce creates accounts) + 7 Important (Worker env flags, template digits, dropped glow + earned trait, session in query, Math.random recovery codes, unbounded photoIds, blank boot on failure). Fix wave commits 3abf6c0..6964f13 (109 tests). Deviation recorded: ladder levels 4/6/8/9 rewards are label-only in R1 (poses/tricks/trail land in R2); glow implemented as CSS/canvas effect, not the mixer addon.
FINAL minor (deferred): fallback morning template fills weather with "fine" ("It's fine. Good. Let's go anyway."), use "a good day"; seed hook does not award earnedTrait; claim confirm untested.
FINAL fix wave re-review: all findings addressed. parked: diaryFor hatch-day photo index can drift after 65+ snaps when the egg took >5 snaps (cosmetic); castCrew skip still keyed on raw body.buddy; flag-off test covers Node host only.
BRANCH COMPLETE 2026-09-09: 32 commits, 109 tests green, tsc clean, vite build OK. Not merged, not deployed.
