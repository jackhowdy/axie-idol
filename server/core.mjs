/**
 * Axie Idol API core — runtime-agnostic (Node host: ../server.mjs, Worker host: ../worker/).
 * Storage adapter: storage.get(name, makeEmpty) / storage.set(name, obj) for
 * 'posts' | 'castCrew' | 'follows' | 'notifications' | 'owners' | 'burns'.
 * Blob adapter: blobs.put(filename, bytes, mime); blobs are served by the host at /uploads/<filename>.
 * Generated from the original server.mjs on 2026-09-06; handler logic unchanged.
 */
import { Buffer } from 'node:buffer'
import { ResponseShim } from './shim.mjs'

const randomUUID = () => crypto.randomUUID()

export function createCore({ storage, blobs, env = {}, log = console }) {
const WAYPOINT_PROFILE_URL = 'https://waypoint.roninchain.com/api/public/get-profile'
const METADATA_BASE = 'https://metadata.axieinfinity.com'
const AXIE_CDN_PNG = (id) =>
  `https://axiecdn.axieinfinity.com/axies/${id}/axie/axie-full-transparent.png`

/** Kit mascots used for seed pack (7). */
const KIT_CAST = [
  { id: 'kotaro', label: 'Kotaro', preview: '/previews/kotaro.png' },
  { id: 'bing', label: 'Bing', preview: '/previews/bing.png' },
  { id: 'kibo', label: 'Kibo', preview: '/previews/kibo.png' },
  { id: 'paladill', label: 'Paladill', preview: '/previews/paladill.png' },
  { id: 'pomodoro', label: 'Pomodoro', preview: '/previews/pomodoro.png' },
  { id: 'tripp', label: 'Tripp', preview: '/previews/tripp.png' },
  { id: 'xia', label: 'Xia', preview: '/previews/xia.png' },
]
const KIT_CAST_IDS = new Set(KIT_CAST.map((c) => c.id))

/** Full R1 quest cast pool (18 faces). */
const FREE_CAST = [
  ...KIT_CAST,
  { id: 'buba', label: 'Buba', preview: '/previews/buba.png' },
  { id: 'olek', label: 'Olek', preview: '/previews/olek.png' },
  { id: 'puffy', label: 'Puffy', preview: '/previews/puffy.png' },
  { id: '4154', label: 'Axie #4154', preview: AXIE_CDN_PNG('4154') },
  { id: '4155', label: 'Axie #4155', preview: AXIE_CDN_PNG('4155') },
  { id: '4156', label: 'Axie #4156', preview: AXIE_CDN_PNG('4156') },
  { id: '991', label: 'Axie #991', preview: AXIE_CDN_PNG('991') },
  { id: '35', label: 'Axie #35', preview: AXIE_CDN_PNG('35') },
  { id: '1367', label: 'Axie #1367', preview: AXIE_CDN_PNG('1367') },
  { id: '2660', label: 'Axie #2660', preview: AXIE_CDN_PNG('2660') },
  { id: 'agonia-echo', label: 'Agonia Echo', preview: '/previews/agonia-echo.png' },
  // Secret: unlocked only by finding the Golden Axie (server roll on post)
  { id: 'golden', label: 'Golden Axie', preview: '/previews/golden.png' },
]
const GOLDEN_ID = 'golden'
const FREE_CAST_IDS = new Set(FREE_CAST.map((c) => c.id))
const QUEST_PROP_IDS = new Set([
  'kotaro-sword',
  'bing-cannon',
  'kibo-hammer',
  'paladill-axe',
  'pomodoro-staff',
  'tripp-sword',
  'xia-axe',
])
const QUEST_PROP_LABEL = {
  'kotaro-sword': "Kotaro's sword",
  'bing-cannon': "Bing's cannon",
  'kibo-hammer': "Kibo's hammer",
  'paladill-axe': "Paladill's axe",
  'pomodoro-staff': "Pomodoro's staff",
  'tripp-sword': "Tripp's sword",
  'xia-axe': "Xia's axe",
}

/** Kid-friendly Global empty-room seed pack (cast featured posts). */
const SEED_MIN_LIVE = 8
/** R1: pause cast seed/demo posts while building. Enable with SEED_POSTS=1 */
const SEED_ENABLED = env.SEED_POSTS === '1' || env.SEED_POSTS === 'true'
/** 1-in-N chance that a post contains the Golden Axie. Set GOLDEN_ODDS=1 to force it (demo/tests). */
const GOLDEN_ODDS = Math.max(1, Math.floor(Number(env.GOLDEN_ODDS) || 5000))
const MAX_SHINY = 3
const SEED_CAPTIONS = {
  // Lifestyle AR composites: 2 each for first five casts, 1 each for tripp + xia → 12 pack ids
  kotaro: ['Park day with Kotaro! ⚔️', 'Cafe flex with Kotaro ☕'],
  bing: ['Street vibes with Bing 💥', 'Bedroom boom — Bing says hi!'],
  kibo: ['Desk build sesh with Kibo 🛠️', 'Kitchen snack break — Kibo!'],
  paladill: ['Balcony guard duty 🛡️', 'Mall stroll with Paladill ✨'],
  pomodoro: ['Playground tomato time! 🍅', 'Beach timer — Pomodoro chill 🏖️'],
  tripp: ['Field day — Tripp rolling 🛹'],
  xia: ['City sparkle check — Xia ✨'],
}

function seedPackDefs() {
  const out = []
  let i = 0
  for (const cast of KIT_CAST) {
    const caps = SEED_CAPTIONS[cast.id] || [`${cast.label} says hello!`]
    for (const caption of caps) {
      out.push({
        id: `seed-${cast.id}-${i}`,
        castId: cast.id,
        label: cast.label,
        preview: cast.preview,
        caption,
      })
      i += 1
      if (out.length >= 12) return out
    }
  }
  return out
}

/**
 * Durable seed: if live (non-seed) posts are thin, upsert ~8–12 cast featured posts.
 * Marked seed:true so clients can distinguish; Global warm-rank includes them.
 * Prefer AR composites under data/uploads/seed-*.png; fall back to sticker art.
 */
function seedCompositeImagePath(_seedId, castId) {
  return `/stickers/${castId}.png`
}


function filterSeedPosts(posts) {
  if (SEED_ENABLED) return posts
  return (posts || []).filter((p) => !p?.seed && !String(p?.id || '').startsWith('seed-'))
}

function ensureSeedPosts(store) {
  if (!SEED_ENABLED) return false

  if (!store || typeof store !== 'object') return false
  if (!Array.isArray(store.posts)) store.posts = []
  const live = store.posts.filter((p) => !p?.seed)
  // Always keep the cast seed pack present for demo life — even when live posts are plentiful.
  // (Previously skipped when live >= SEED_MIN_LIVE, which left only 1×1 smoke uploads on top.)

  const now = Date.now()
  const pack = seedPackDefs()
  let changed = false
  const byId = new Map(store.posts.map((p) => [String(p.id), p]))

  for (let idx = 0; idx < pack.length; idx++) {
    const def = pack[idx]
    const existing = byId.get(def.id)
    if (existing) {
      let touched = false
      if (!existing.seed) {
        existing.seed = true
        touched = true
      }
      const preferred = seedCompositeImagePath(def.id, def.castId)
      if (existing.imagePath !== preferred) {
        existing.imagePath = preferred
        touched = true
      }
      if (typeof def.caption === 'string' && def.caption && existing.caption !== def.caption) {
        existing.caption = def.caption
        touched = true
      }
      if (!existing.castAuthor) {
        existing.castAuthor = true
        touched = true
      }
      if (touched) changed = true
      continue
    }
    const welcome =
      (CAST_WELCOME_LINES[def.castId] && CAST_WELCOME_LINES[def.castId][0]) ||
      'Cast crew checking in!'
    const post = {
      id: def.id,
      createdAt: now - (idx + 1) * 90_000,
      axieId: def.castId,
      axieLabel: def.label,
      caption: def.caption,
      authorGuestId: `cast:${def.castId}`,
      authorLabel: def.label,
      imagePath: seedCompositeImagePath(def.id, def.castId),
      likes: 1 + (idx % 4),
      likedByDevice: [],
      comments: [
        {
          id: `${def.id}-c0`,
          createdAt: now - (idx + 1) * 90_000 + 1000,
          authorGuestId: `cast:${def.castId}`,
          authorLabel: def.label,
          text: welcome,
          cast: true,
          castId: def.castId,
        },
      ],
      seed: true,
      castAuthor: true,
    }
    store.posts.push(post)
    byId.set(def.id, post)
    changed = true
  }

  if (changed) {
    // Keep seeds slightly older than brand-new user posts but still recent for warm rank
    saveStore(store)
    console.log(`[axie-idol] seed pack upserted (${pack.length} cast posts; live=${live.length})`)
  }
  return changed
}


const CAST_WELCOME_LINES = {
  kotaro: [
    'First post! I’m following you — keep the vibes coming ⚔️',
    'Yo! Kotaro hopped on your crew. Let’s go!',
    'Locked in — I’m following your feed from here ⚔️',
    'New poster alert! Sword’s up — I’m on your crew.',
    'Hey hey! First drop looks fun. Following you now.',
    'Welcome to Idol! Kotaro’s got your back.',
    'Boom — first post unlocked me. Let’s climb that board!',
    'Fresh feed energy! I’m riding with you from post #1.',
    'Nice opener! I’ll be cheering in the comments ⚔️',
    'Crew seat taken by Kotaro. Keep posting, champ.',
    'First snap? Love it. Consider me glued to your Axie.',
    'Sword salute for your debut! I’m following.',
    'You posted — I followed. That’s the deal ⚔️',
    'Kotaro here! Your feed just got a little louder.',
    'Welcome aboard… wait, I’m boarding YOUR crew. Let’s play!',
    'Debut looks clean. I’m in — don’t leave me hanging on post #2.',
  ],
  bing: [
    'Boom. I’m on your crew now.',
    'Bing reporting for duty — nice post!',
    'Crew unlocked. Let’s make some noise 💥',
    'Cannon’s warm — Bing joined your cast!',
    'Loud and proud: I’m following you now.',
    'Post count hit my unlock — boom, crew time!',
    'Bing in the house. Keep the bangs coming.',
    'Unlocked! I’ll bring the hype volume up.',
    'That’s a wrap on quiet mode — Bing follows.',
    'Crew stamp from Bing. More posts = more boom.',
  ],
  kibo: [
    'Kibo here! Following you for the good vibes.',
    'Hammer ready — I’m on your cast crew now.',
    'Nice one! I’ll be cheering from the crew bench.',
    'Thunk! Kibo unlocked. Building with you from here.',
    'Solid post — hammer says follow.',
    'Kibo clocked in. Let’s stack those Idol Points.',
    'Crew bench just got heavier (in a good way).',
    'Following you! Smash that next capture too.',
    'Hammer high-five — I’m on your team.',
    'Unlocked Kibo. Steady hype, steady posts.',
  ],
  paladill: [
    'Paladill joined your crew — stay shiny!',
    'Shield up! I’m following your posts.',
    'Honor to the poster — I’m on your crew.',
    'Gleam check passed. Paladill follows you now.',
    'Shell polish complete — crew seat claimed.',
    'Protecting the vibes. Following you!',
    'Paladill reporting: your feed is under my wing.',
    'Shiny unlock! I’ll guard your comment section kindly.',
    'Crew oath sworn. Keep the posts sparkling.',
    'Shield bump — Paladill is in.',
  ],
  pomodoro: [
    'Pomodoro hopped aboard — keep posting!',
    'Fresh crew energy! I’m following you 🍅',
    'Timer’s set — I’ll hype your next posts.',
    'Ding! Pomodoro unlocked. Focus… then post again.',
    'Tomato stamp of approval — I’m on your crew.',
    'Kitchen’s open. Following your feed 🍅',
    'Fresh batch energy. Crew seat: Pomodoro.',
    'Unlocked! Don’t burn the next snap — cook it.',
    'Pomodoro says: short sessions, big vibes. Following!',
    'Timer started. I’ll check in on your posts.',
  ],
  tripp: [
    'Tripp unlocked! Riding with your crew now.',
    'Zoom — I’m following you. Keep it fun!',
    'Crew check: Tripp is in. Nice post!',
    'Fast follow! Tripp just tagged onto your crew.',
    'Whoosh — unlocked and already scrolling your feed.',
    'Speed run: follow complete. Post more!',
    'Tripp hopped the rail onto your cast.',
    'Quick unlock, long hype. I’m with you.',
    'Trail’s lit — Tripp follows from here.',
    'Unlocked Tripp. Let’s keep moving 🛹',
  ],
  xia: [
    'Xia joined! Whole free cast almost complete ✨',
    'I’m on your crew — let’s finish strong!',
    'Xia here. Following you all the way.',
    'Sparkle unlock — Xia is on your cast ✨',
    'Elegant entrance: I’m following you now.',
    'Full-crew energy incoming. Xia locked in.',
    'Soft glow, hard hype. Following your posts.',
    'Xia’s seat taken. Keep the magic coming.',
    'You earned me — I’ll shine on your feed ✨',
    'Final free-cast vibes. Xia follows with style.',
  ],
  buba: [
    'Buba bounced onto your crew!',
    'Soft landing — Buba is following you now.',
    'Buba says hi! Keep the posts coming.',
  ],
  olek: [
    'Olek joined your cast crew!',
    'Olek’s in — let’s keep climbing those quests.',
    'Crew check: Olek following you.',
  ],
  puffy: [
    'Puffy puffed onto your crew!',
    'Puffy unlocked — cute hype incoming.',
    'Following you with maximum fluff.',
  ],
  '4154': ['Axie #4154 hopped on your crew!', 'Low-id legend following you now.'],
  '4155': ['Axie #4155 joined your crew!', 'Classic Axie vibes — I’m following.'],
  '4156': ['Axie #4156 is on your crew!', 'Another idol face following you.'],
  '991': ['Axie #991 unlocked — following you!', 'Nine-nine-one in the house.'],
  '35': ['Axie #35 joined your crew!', 'OG energy on your feed.'],
  '1367': ['Axie #1367 is following you!', 'Crew just got rarer.'],
  '2660': ['Axie #2660 unlocked — I’m with you!', 'Almost at the finale…'],
  'agonia-echo': [
    'Agonia Echo steps from the Blood Moon… and cheers for YOU.',
    'Capstone! Agonia Echo joined your crew from the shadows.',
    'Moon cracked, crew complete — Agonia Echo follows.',
  ],
}

const CAST_HYPE_LINES = {
  kotaro: [
    'Sword salute! This post slaps ⚔️',
    'Crew hype from Kotaro!',
    'Keep the vibes rolling!',
    'Another banger — sword up!',
    'I’m still following and still hyped ⚔️',
    'Capture looks alive. Love it!',
    'Board fuel! Great drop.',
    'Kotaro stamp: approved.',
    'This is the energy. More please!',
    'Clean frame — crew loves it.',
    'You’re cooking. Don’t stop posting.',
    'Sword twirl for this one ⚔️',
    'Feed’s better with this in it.',
    'Hype comment deployed. Carry on, hero.',
  ],
  bing: [
    'Boom — liked and locked.',
    'Bing says: more of this!',
    'Loud and proud for this post 💥',
    'Cannon clap! Great snap.',
    'Volume up — this slap.',
    'Bing hype incoming… boom.',
    'Noise complaint pending (worth it).',
    'Keep blasting posts like this.',
    'Crew cheer, max loudness.',
    'That caption + photo? Fire.',
  ],
  kibo: [
    'Hammer tap of approval!',
    'Kibo likes this energy.',
    'Solid post — crew approved.',
    'Built different. Nice work.',
    'Thunk of respect for this drop.',
    'Stacking points starts with posts like this.',
    'Hammer says yes.',
    'Steady. Strong. Good post.',
    'Kibo’s cheering from the bench.',
    'Another brick in the Idol wall.',
  ],
  paladill: [
    'Shiny post! Paladill likes it.',
    'Shield high for this one.',
    'Crew cheer from Paladill!',
    'Gleam detected — excellent.',
    'Protect this vibe at all costs.',
    'Shell sparkle for your snap.',
    'Honor to the photographer!',
    'Polished frame. Love it.',
    'Paladill nods solemnly (and hyped).',
    'Shine on — great post.',
  ],
  pomodoro: [
    'Fresh! Pomodoro stamped this 🍅',
    'Timer says: great post.',
    'Crew likes unlocked ✨',
    'Cooked perfectly. Serve another!',
    'Ding ding — tasty drop.',
    'Focus rewarded. Nice snap.',
    'Tomato of approval 🍅',
    'Fresh out the oven.',
    'Short break… okay back to hyping you.',
    'This one’s ripe. Love it.',
  ],
  tripp: [
    'Tripp zoomed by with a like!',
    'Speed hype — love this.',
    'Quick cheer from Tripp!',
    'Whoosh — saw it, loved it.',
    'Fast scroll stopped here. Good sign.',
    'Trail marker dropped on this post.',
    'Keep moving AND keep posting.',
    'Tripp double-takes — clean!',
    'Zoomies approved.',
    'Catch you on the next drop!',
  ],
  xia: [
    'Xia sparkles for this post ✨',
    'Elegant hype from Xia.',
    'Crew love from Xia!',
    'Soft glow, strong post.',
    'This frame has magic ✨',
    'Xia’s gentle cheer: beautiful.',
    'Sparkle stamped.',
    'Graceful drop — more please.',
    'Your feed is glowing.',
    'Xia whispers: this one’s a keeper.',
  ],
}

/** R1 quest ladder — sequential L1–L24 unlocks (cast faces + equipment props). */
const CAST_CREW_LABEL = Object.fromEntries(FREE_CAST.map((c) => [c.id, c.label]))
const CAST_CREW_MAX_COMMENTS_PER_POST = 2
const CAST_CREW_ENGAGE_CHANCE = 0.55

const QUEST_DEFS = [
  {
    level: 1,
    unlock: { type: 'cast', id: 'bing' },
    description: 'Make your first post',
    target: 1,
    progress: (s) => s.posts,
    check: (s) => s.posts >= 1,
  },
  {
    level: 2,
    unlock: { type: 'prop', id: 'kotaro-sword' },
    description: 'Leave 1 comment',
    target: 1,
    progress: (s) => s.commentsGiven,
    check: (s) => s.commentsGiven >= 1,
  },
  {
    level: 3,
    unlock: { type: 'cast', id: 'kibo' },
    description: 'Give 10 likes',
    target: 10,
    progress: (s) => s.likesGiven,
    check: (s) => s.likesGiven >= 10,
  },
  {
    level: 4,
    unlock: { type: 'prop', id: 'bing-cannon' },
    description: 'Make 3 posts',
    target: 3,
    progress: (s) => s.posts,
    check: (s) => s.posts >= 3,
  },
  {
    level: 5,
    unlock: { type: 'cast', id: 'paladill' },
    description: 'Make 5 posts',
    target: 5,
    progress: (s) => s.posts,
    check: (s) => s.posts >= 5,
  },
  {
    level: 6,
    unlock: { type: 'prop', id: 'kibo-hammer' },
    description: 'Follow 1 Axie',
    target: 1,
    progress: (s) => s.followsGiven,
    check: (s) => s.followsGiven >= 1,
  },
  {
    level: 7,
    unlock: { type: 'cast', id: 'pomodoro' },
    description: 'Make 10 posts',
    target: 10,
    progress: (s) => s.posts,
    check: (s) => s.posts >= 10,
  },
  {
    level: 8,
    unlock: { type: 'prop', id: 'paladill-axe' },
    description: 'Get 1 like from a human',
    target: 1,
    progress: (s) => s.likesReceivedHuman,
    check: (s) => s.likesReceivedHuman >= 1,
  },
  {
    level: 9,
    unlock: { type: 'cast', id: 'tripp' },
    description: 'Leave 5 comments',
    target: 5,
    progress: (s) => s.commentsGiven,
    check: (s) => s.commentsGiven >= 5,
  },
  {
    level: 10,
    unlock: { type: 'prop', id: 'pomodoro-staff' },
    description: 'Follow 3 Axies',
    target: 3,
    progress: (s) => s.followsGiven,
    check: (s) => s.followsGiven >= 3,
  },
  {
    level: 11,
    unlock: { type: 'cast', id: 'xia' },
    description: 'Make 15 posts',
    target: 15,
    progress: (s) => s.posts,
    check: (s) => s.posts >= 15,
  },
  {
    level: 12,
    unlock: { type: 'prop', id: 'tripp-sword' },
    description: 'Give 25 likes',
    target: 25,
    progress: (s) => s.likesGiven,
    check: (s) => s.likesGiven >= 25,
  },
  {
    level: 13,
    unlock: { type: 'prop', id: 'xia-axe' },
    description: 'Get 10 likes from humans',
    target: 10,
    progress: (s) => s.likesReceivedHuman,
    check: (s) => s.likesReceivedHuman >= 10,
  },
  {
    level: 14,
    unlock: { type: 'cast', id: 'buba' },
    description: 'Post on 3 different days',
    target: 3,
    progress: (s) => (Array.isArray(s.distinctPostDays) ? s.distinctPostDays.length : 0),
    check: (s) => (Array.isArray(s.distinctPostDays) ? s.distinctPostDays.length : 0) >= 3,
  },
  {
    level: 15,
    unlock: { type: 'cast', id: 'olek' },
    description: 'Follow 5 Axies',
    target: 5,
    progress: (s) => s.followsGiven,
    check: (s) => s.followsGiven >= 5,
  },
  {
    level: 16,
    unlock: { type: 'cast', id: 'puffy' },
    description: 'Leave 10 comments',
    target: 10,
    progress: (s) => s.commentsGiven,
    check: (s) => s.commentsGiven >= 10,
  },
  {
    level: 17,
    unlock: { type: 'cast', id: '4154' },
    description: 'Get 25 likes from humans',
    target: 25,
    progress: (s) => s.likesReceivedHuman,
    check: (s) => s.likesReceivedHuman >= 25,
  },
  {
    level: 18,
    unlock: { type: 'cast', id: '4155' },
    description: 'Make 25 posts',
    target: 25,
    progress: (s) => s.posts,
    check: (s) => s.posts >= 25,
  },
  {
    level: 19,
    unlock: { type: 'cast', id: '4156' },
    description: 'Have 3 cast Axies follow you',
    target: 3,
    progress: (s) => s.crewCastFollowers,
    check: (s) => s.crewCastFollowers >= 3,
  },
  {
    level: 20,
    unlock: { type: 'cast', id: '991' },
    description: 'Give 50 likes',
    target: 50,
    progress: (s) => s.likesGiven,
    check: (s) => s.likesGiven >= 50,
  },
  {
    level: 21,
    unlock: { type: 'cast', id: '35' },
    description: 'Leave 20 comments',
    target: 20,
    progress: (s) => s.commentsGiven,
    check: (s) => s.commentsGiven >= 20,
  },
  {
    level: 22,
    unlock: { type: 'cast', id: '1367' },
    description: 'Follow 10 Axies',
    target: 10,
    progress: (s) => s.followsGiven,
    check: (s) => s.followsGiven >= 10,
  },
  {
    level: 23,
    unlock: { type: 'cast', id: '2660' },
    description: 'Make 40 posts',
    target: 40,
    progress: (s) => s.posts,
    check: (s) => s.posts >= 40,
  },
  {
    level: 24,
    unlock: { type: 'cast', id: 'agonia-echo' },
    description: 'Hit 50 on every human social counter',
    target: 50,
    progress: (s) =>
      Math.min(
        s.posts,
        s.likesGiven,
        s.commentsGiven,
        s.followsGiven,
        s.likesReceivedHuman,
        s.commentsReceivedHuman,
        s.followsReceivedHuman,
      ),
    check: (s) =>
      s.posts >= 50 &&
      s.likesGiven >= 50 &&
      s.commentsGiven >= 50 &&
      s.followsGiven >= 50 &&
      s.likesReceivedHuman >= 50 &&
      s.commentsReceivedHuman >= 50 &&
      s.followsReceivedHuman >= 50,
  },
]

function emptyQuestStats() {
  return {
    posts: 0,
    likesGiven: 0,
    commentsGiven: 0,
    followsGiven: 0,
    likesReceivedHuman: 0,
    commentsReceivedHuman: 0,
    followsReceivedHuman: 0,
    distinctPostDays: [],
    crewCastFollowers: 0,
  }
}

function utcDayKey(ms = Date.now()) {
  return new Date(ms).toISOString().slice(0, 10)
}

function syncCrewCastFollowers(entry) {
  const unlocked = Array.isArray(entry.unlockedCast) ? entry.unlockedCast : []
  entry.stats.crewCastFollowers = unlocked.filter((id) => id && id !== 'kotaro').length
  return entry.stats.crewCastFollowers
}

function rewardLabel(unlock) {
  if (!unlock) return ''
  if (unlock.type === 'prop') return QUEST_PROP_LABEL[unlock.id] || unlock.id
  return CAST_CREW_LABEL[unlock.id] || unlock.id
}

function nextQuestPayload(entry) {
  const level = Math.max(0, Math.min(24, Math.floor(Number(entry.level) || 0)))
  if (level >= 24) return null
  const def = QUEST_DEFS[level]
  if (!def) return null
  const current = Math.max(0, Math.floor(Number(def.progress(entry.stats)) || 0))
  return {
    level: def.level,
    description: def.description,
    progress: current,
    target: def.target,
    unlock: def.unlock,
    unlockLabel: rewardLabel(def.unlock),
  }
}

/** Sequential quest evaluate: grant rewards for each completed next level. */
function evaluateQuests(entry) {
  const newlyCast = []
  const newlyProps = []
  if (!entry.stats) entry.stats = emptyQuestStats()
  if (!Array.isArray(entry.unlockedCast)) entry.unlockedCast = ['kotaro']
  if (!entry.unlockedCast.includes('kotaro')) entry.unlockedCast.unshift('kotaro')
  if (!Array.isArray(entry.unlockedProps)) entry.unlockedProps = []
  entry.level = Math.max(0, Math.min(24, Math.floor(Number(entry.level) || 0)))
  syncCrewCastFollowers(entry)

  let guard = 0
  while (entry.level < 24 && guard < 30) {
    guard += 1
    const def = QUEST_DEFS[entry.level]
    if (!def || !def.check(entry.stats)) break
    entry.level = def.level
    const u = def.unlock
    if (u.type === 'cast' && FREE_CAST_IDS.has(u.id)) {
      if (!entry.unlockedCast.includes(u.id)) {
        entry.unlockedCast.push(u.id)
        newlyCast.push(u.id)
      }
    } else if (u.type === 'prop' && QUEST_PROP_IDS.has(u.id)) {
      if (!entry.unlockedProps.includes(u.id)) {
        entry.unlockedProps.push(u.id)
        newlyProps.push(u.id)
      }
    }
    syncCrewCastFollowers(entry)
  }
  entry.updatedAt = new Date().toISOString()
  return { newlyCast, newlyProps }
}

function normalizeQuestEntry(raw) {
  // New format
  if (raw && (Array.isArray(raw.unlockedCast) || raw.stats)) {
    const stats = { ...emptyQuestStats(), ...(raw.stats || {}) }
    stats.posts = Math.max(0, Math.floor(Number(stats.posts) || 0))
    stats.likesGiven = Math.max(0, Math.floor(Number(stats.likesGiven) || 0))
    stats.commentsGiven = Math.max(0, Math.floor(Number(stats.commentsGiven) || 0))
    stats.followsGiven = Math.max(0, Math.floor(Number(stats.followsGiven) || 0))
    stats.likesReceivedHuman = Math.max(0, Math.floor(Number(stats.likesReceivedHuman) || 0))
    stats.commentsReceivedHuman = Math.max(0, Math.floor(Number(stats.commentsReceivedHuman) || 0))
    stats.followsReceivedHuman = Math.max(0, Math.floor(Number(stats.followsReceivedHuman) || 0))
    stats.distinctPostDays = Array.isArray(stats.distinctPostDays)
      ? [...new Set(stats.distinctPostDays.map(String))].slice(0, 400)
      : []
    const remappedCast = (Array.isArray(raw.unlockedCast) ? raw.unlockedCast : []).map((id) =>
      String(id) === 'villain' ? 'agonia-echo' : String(id),
    )
    const unlockedCast = [
      ...new Set(
        ['kotaro', ...remappedCast].filter((id) => FREE_CAST_IDS.has(String(id))),
      ),
    ]
    const unlockedProps = [
      ...new Set(
        (Array.isArray(raw.unlockedProps) ? raw.unlockedProps : []).filter((id) =>
          QUEST_PROP_IDS.has(String(id)),
        ),
      ),
    ]
    const entry = {
      level: Math.max(0, Math.min(24, Math.floor(Number(raw.level) || 0))),
      unlockedCast,
      unlockedProps,
      stats,
      updatedAt: raw.updatedAt || null,
    }
    // Catch up any levels that counters already satisfy
    evaluateQuests(entry)
    return entry
  }

  // Legacy { postCount, unlocked } → migrate
  const prevUnlocked = Array.isArray(raw?.unlocked) ? raw.unlocked : []
  const stats = emptyQuestStats()
  stats.posts = Math.max(0, Math.floor(Number(raw?.postCount) || 0))
  const entry = {
    level: 0,
    unlockedCast: ['kotaro'],
    unlockedProps: [],
    stats,
    updatedAt: raw?.updatedAt || null,
  }
  evaluateQuests(entry)
  for (const id of prevUnlocked) {
    const sid = String(id)
    if (FREE_CAST_IDS.has(sid) && !entry.unlockedCast.includes(sid)) {
      entry.unlockedCast.push(sid)
    }
  }
  syncCrewCastFollowers(entry)
  entry.updatedAt = new Date().toISOString()
  return entry
}

function defaultQuestEntry() {
  return {
    level: 0,
    unlockedCast: ['kotaro'],
    unlockedProps: [],
    stats: emptyQuestStats(),
    updatedAt: null,
  }
}

function castPublicPayload(entry, extras = {}) {
  const e = normalizeQuestEntry(entry || defaultQuestEntry())
  const unlockedCast = e.unlockedCast.filter((id) => FREE_CAST_IDS.has(id))
  const unlockedProps = e.unlockedProps.filter((id) => QUEST_PROP_IDS.has(id))
  const nextQuest = nextQuestPayload(e)
  const newlyUnlocked = Array.isArray(extras.newlyUnlocked)
    ? extras.newlyUnlocked
    : [...(extras.newlyUnlockedCast || []), ...(extras.newlyUnlockedProps || [])]
  return {
    level: e.level,
    stats: { ...e.stats, distinctPostDays: [...(e.stats.distinctPostDays || [])] },
    unlockedCast,
    unlockedProps,
    // Back-compat fields for older clients
    unlocked: unlockedCast,
    postCount: e.stats.posts,
    newlyUnlocked,
    newlyUnlockedCast: extras.newlyUnlockedCast || [],
    newlyUnlockedProps: extras.newlyUnlockedProps || [],
    engagement: extras.engagement || [],
    crewFollowerCount: unlockedCast.length,
    nextQuest,
    nextUnlock: nextQuest
      ? {
          at: nextQuest.target,
          castId: nextQuest.unlock?.type === 'cast' ? nextQuest.unlock.id : '',
          propId: nextQuest.unlock?.type === 'prop' ? nextQuest.unlock.id : '',
          label: nextQuest.unlockLabel,
          remaining: Math.max(0, nextQuest.target - nextQuest.progress),
          description: nextQuest.description,
          level: nextQuest.level,
        }
      : null,
    ladder: QUEST_DEFS.map((def) => ({
      level: def.level,
      description: def.description,
      unlock: def.unlock,
      label: rewardLabel(def.unlock),
      unlocked: e.level >= def.level,
    })),
  }
}


function emptyCastCrew() {
  return { byPoster: {} }
}

function loadCastCrew() {
  const data = storage.get('castCrew', emptyCastCrew)
  if (!data.byPoster || typeof data.byPoster !== 'object') data.byPoster = {}
  return data
}

function saveCastCrew(store) {
  storage.set('castCrew', store)
}

function castCrewPosterKey({ ownerAddress, address, authorGuestId, deviceKey }) {
  const addr = normalizeAddress(ownerAddress || address || '')
  if (addr) return addr
  const guest = typeof authorGuestId === 'string' ? authorGuestId.trim().slice(0, 64) : ''
  if (guest) return `guest:${guest}`
  const dk = typeof deviceKey === 'string' ? deviceKey.trim().slice(0, 128) : ''
  if (dk) return `device:${dk}`
  return ''
}

function getCastCrewForKey(posterKey) {
  if (!posterKey) return castPublicPayload(defaultQuestEntry())
  const store = loadCastCrew()
  const raw = store.byPoster[posterKey]
  const entry = normalizeQuestEntry(raw || defaultQuestEntry())
  // Persist migration if legacy
  if (raw && (!Array.isArray(raw.unlockedCast) || !raw.stats)) {
    store.byPoster[posterKey] = entry
    saveCastCrew(store)
  }
  return castPublicPayload(entry)
}

function loadQuestEntry(posterKey) {
  if (!posterKey) return null
  const store = loadCastCrew()
  const entry = normalizeQuestEntry(store.byPoster[posterKey] || defaultQuestEntry())
  return { store, entry }
}

function saveQuestEntry(store, posterKey, entry) {
  store.byPoster[posterKey] = entry
  saveCastCrew(store)
}

function bumpQuestStats(posterKey, mutator) {
  if (!posterKey) return castPublicPayload(defaultQuestEntry())
  const loaded = loadQuestEntry(posterKey)
  if (!loaded) return castPublicPayload(defaultQuestEntry())
  const { store, entry } = loaded
  mutator(entry.stats, entry)
  const { newlyCast, newlyProps } = evaluateQuests(entry)
  saveQuestEntry(store, posterKey, entry)
  return castPublicPayload(entry, {
    newlyUnlockedCast: newlyCast,
    newlyUnlockedProps: newlyProps,
    newlyUnlocked: [...newlyCast, ...newlyProps],
  })
}

function isCastNpcActor({ deviceKey, authorGuestId, cast, castId }) {
  if (cast) return true
  const dk = typeof deviceKey === 'string' ? deviceKey : ''
  if (dk.startsWith('cast:')) return true
  const gid = typeof authorGuestId === 'string' ? authorGuestId : ''
  if (gid.startsWith('cast:')) return true
  const cid = typeof castId === 'string' ? castId : ''
  if (cid && FREE_CAST_IDS.has(cid)) return true
  return false
}

function posterKeyFromPost(post) {
  if (!post) return ''
  return castCrewPosterKey({
    ownerAddress: post.ownerAddress,
    authorGuestId: post.authorGuestId,
  })
}

function ownerPosterKeyForFollowedAxie(axieId) {
  const id = String(axieId || '').trim()
  if (!id || FREE_CAST_IDS.has(id)) return ''
  try {
    const store = loadStore()
    for (const p of store.posts || []) {
      if (String(p.axieId) !== id) continue
      const addr = normalizeAddress(p.ownerAddress || '')
      if (addr) return addr
    }
  } catch {
    /* ignore */
  }
  return ''
}

function pickLine(pool, castId) {
  const list = (pool && pool[castId]) || null
  if (list && list.length) return list[Math.floor(Math.random() * list.length)]
  const label = CAST_CREW_LABEL[castId] || castId
  return `${label} hopped on your crew — nice!`
}

/**
 * After a successful post: bump post stats, evaluate quests,
 * welcome-comment new cast unlocks, lightly engage unlocked crew.
 */
/** Add a secret cast face to a poster's unlocked set (no level change). */
function grantCast(posterKey, castId) {
  if (!posterKey) return null
  const store = loadCastCrew()
  const entry = normalizeQuestEntry(store.byPoster[posterKey] || defaultQuestEntry())
  if (!entry.unlockedCast.includes(castId)) entry.unlockedCast.push(castId)
  entry.updatedAt = new Date().toISOString()
  store.byPoster[posterKey] = entry
  saveCastCrew(store)
  return castPublicPayload(entry, { newlyUnlockedCast: [castId] })
}

/** Hall of Fame: who has found the Golden Axie (latest first). */
function goldenSummary(postsStore) {
  const finds = (postsStore.posts || [])
    .filter((p) => p && p.golden === true)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  return {
    odds: GOLDEN_ODDS,
    count: finds.length,
    latest: finds[0]
      ? { postId: finds[0].id, label: finds[0].authorLabel || 'A squad', createdAt: finds[0].createdAt }
      : null,
    finders: finds.slice(0, 10).map((p) => ({
      postId: p.id,
      label: p.authorLabel || 'A squad',
      axieId: p.axieId,
      createdAt: p.createdAt,
    })),
  }
}

function applyCastCrewOnPost(postsStore, post, posterKey) {
  const empty = castPublicPayload(defaultQuestEntry())
  if (!posterKey || !post) return empty

  const loaded = loadQuestEntry(posterKey)
  if (!loaded) return empty
  const { store: crewStore, entry } = loaded
  const prevCast = new Set(entry.unlockedCast)
  const prevProps = new Set(entry.unlockedProps)

  entry.stats.posts = Math.max(0, Math.floor(Number(entry.stats.posts) || 0)) + 1
  const day = utcDayKey(post.createdAt || Date.now())
  if (!Array.isArray(entry.stats.distinctPostDays)) entry.stats.distinctPostDays = []
  if (!entry.stats.distinctPostDays.includes(day)) {
    entry.stats.distinctPostDays.push(day)
    if (entry.stats.distinctPostDays.length > 400) {
      entry.stats.distinctPostDays = entry.stats.distinctPostDays.slice(-400)
    }
  }

  const { newlyCast, newlyProps } = evaluateQuests(entry)
  // Also surface any unlocks that evaluate produced (already in newly*)
  let newlyUnlockedCast = newlyCast.filter((id) => !prevCast.has(id))
  const newlyUnlockedProps = newlyProps.filter((id) => !prevProps.has(id))

  const postedCastId = FREE_CAST_IDS.has(String(post.axieId || ''))
    ? String(post.axieId)
    : ''

  // Don't let a cast post get followed/commented by the same cast (no Kotaro→Kotaro).
  if (postedCastId && newlyUnlockedCast.includes(postedCastId)) {
    newlyUnlockedCast = newlyUnlockedCast.filter((id) => id !== postedCastId)
  }

  saveQuestEntry(crewStore, posterKey, entry)

  if (!Array.isArray(post.comments)) post.comments = []
  if (!Array.isArray(post.likedByDevice)) post.likedByDevice = []

  const engagement = []
  let commentsLeft = CAST_CREW_MAX_COMMENTS_PER_POST
  const unlockedCast = entry.unlockedCast.filter((id) => FREE_CAST_IDS.has(id))

  for (const castId of newlyUnlockedCast) {
    if (commentsLeft <= 0) break
    if (postedCastId && castId === postedCastId) continue
    const label = CAST_CREW_LABEL[castId] || castId
    const text = pickLine(CAST_WELCOME_LINES, castId)
    const comment = {
      id: randomUUID(),
      createdAt: Date.now(),
      authorGuestId: `cast:${castId}`,
      authorLabel: label,
      text,
      cast: true,
      castId,
    }
    post.comments.push(comment)
    bumpIdolPoints(postsStore, post.axieId, 3)
    commentsLeft -= 1
    engagement.push({ castId, kind: 'comment', text, commentId: comment.id })
  }

  const already = unlockedCast.filter((id) => !newlyUnlockedCast.includes(id))
  for (let i = already.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[already[i], already[j]] = [already[j], already[i]]
  }

  for (const castId of already) {
    if (postedCastId && castId === postedCastId) continue
    if (Math.random() > CAST_CREW_ENGAGE_CHANCE) continue
    const label = CAST_CREW_LABEL[castId] || castId
    const likeKey = `cast:${castId}`
    const doComment = commentsLeft > 0 && Math.random() < 0.55
    const doLike = !post.likedByDevice.includes(likeKey) && (!doComment || Math.random() < 0.7)

    if (doLike) {
      post.likedByDevice.push(likeKey)
      post.likes = (post.likes || 0) + 1
      bumpIdolPoints(postsStore, post.axieId, 1)
      engagement.push({ castId, kind: 'like' })
    }
    if (doComment) {
      const text = pickLine(CAST_HYPE_LINES, castId)
      const comment = {
        id: randomUUID(),
        createdAt: Date.now(),
        authorGuestId: `cast:${castId}`,
        authorLabel: label,
        text,
        cast: true,
        castId,
      }
      post.comments.push(comment)
      bumpIdolPoints(postsStore, post.axieId, 3)
      commentsLeft -= 1
      engagement.push({ castId, kind: 'comment', text, commentId: comment.id })
    }
    if (engagement.filter((e) => !newlyUnlockedCast.includes(e.castId)).length >= 2 && commentsLeft <= 0) {
      break
    }
  }

  return castPublicPayload(entry, {
    newlyUnlockedCast,
    newlyUnlockedProps,
    newlyUnlocked: [...newlyUnlockedCast, ...newlyUnlockedProps],
    engagement,
  })
}



/** Legacy public gateway (Cloudflare-challenged; curl fallback only). */
const GRAPHQL_URL = 'https://graphql-gateway.axieinfinity.com/graphql'
/** Official Sky Mavis gateway; needs SKYMAVIS_API_KEY (Ronin Developer Console). */
const SKYMAVIS_GRAPHQL_URL = 'https://api-gateway.skymavis.com/graphql/axie-marketplace'
const SKYMAVIS_API_KEY = String(env.SKYMAVIS_API_KEY || '').trim()

/** Normalize Ronin/EVM address: strip ronin: prefix, lowercase. */
function normalizeAddress(raw) {
  if (typeof raw !== 'string') return ''
  let a = raw.trim()
  if (!a) return ''
  if (a.toLowerCase().startsWith('ronin:')) a = '0x' + a.slice(6)
  a = a.toLowerCase()
  if (!/^0x[0-9a-f]{40}$/.test(a)) return ''
  return a
}

/**
 * GraphQL via curl + temp file — Cloudflare challenges Node undici/fetch
 * (403 "Just a moment"); curl from the same host succeeds. Avoid stdin piping
 * (execFile input + curl @- can hang).
 */
async function graphqlRequest(query, variables = {}) {
  const payload = JSON.stringify({ query, variables })
  if (!SKYMAVIS_API_KEY) {
    throw Object.assign(new Error('SKYMAVIS_API_KEY not configured'), { statusCode: 502 })
  }
  return graphqlRequestKeyed(payload)
}

/** Official gateway via fetch + X-API-Key. Throws with statusCode on failure. */
async function graphqlRequestKeyed(payload) {
  let res
  try {
    res = await fetch(SKYMAVIS_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-API-Key': SKYMAVIS_API_KEY,
      },
      body: payload,
      signal: AbortSignal.timeout(25_000),
    })
  } catch (err) {
    throw Object.assign(new Error(err?.message || 'GraphQL fetch failed'), { statusCode: 502 })
  }
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text || '{}')
  } catch {
    throw Object.assign(new Error('Invalid GraphQL JSON response'), { statusCode: 502 })
  }
  if (res.status === 401 || res.status === 403) {
    throw Object.assign(new Error(json?.message || 'Sky Mavis API key rejected'), { statusCode: 502 })
  }
  if (json?.errors?.length) {
    throw Object.assign(new Error(json.errors[0].message || 'GraphQL error'), { statusCode: 502 })
  }
  if (!json?.data) {
    throw Object.assign(new Error('Empty GraphQL data'), { statusCode: 502 })
  }
  return json.data
}

/** Genes/class/name for an Axie, cached forever in the 'axies' store (genes are immutable). */
async function fetchAxieGenes(axieId) {
  const cache = storage.get('axies', () => ({}))
  const hit = cache[axieId]
  if (hit && hit.genes) return hit
  const data = await graphqlRequest(
    `query($axieId: ID!) {
      axie(axieId: $axieId) { id name class newGenes genes bodyShape }
    }`,
    { axieId: String(axieId) },
  )
  const axie = data?.axie
  if (!axie || !axie.id) return null
  const rec = {
    id: String(axie.id),
    name: (axie.name && String(axie.name).trim()) || `Axie #${axie.id}`,
    class: axie.class || null,
    genes: axie.newGenes || axie.genes || '',
    bodyShape: axie.bodyShape || null,
    fetchedAt: Date.now(),
  }
  if (rec.genes) {
    cache[axieId] = rec
    storage.set('axies', cache)
  }
  return rec
}

async function handleAxieGenes(_req, res, id) {
  if (!ID_RE.test(id)) {
    sendJson(res, 400, { error: 'Invalid Axie ID' })
    return
  }
  try {
    const rec = await fetchAxieGenes(id)
    if (!rec) {
      sendJson(res, 404, { error: 'Axie not found' })
      return
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400',
    })
    res.end(JSON.stringify(rec))
  } catch (err) {
    sendJson(res, err?.statusCode || 502, { error: err instanceof Error ? err.message : 'Genes lookup failed' })
  }
}

function axieLabelFrom(name, id) {
  const n = (name && String(name).trim()) || `Axie #${id}`
  // Avoid "Axie #90 #90" when chain name already ends with #id
  if (n === `Axie #${id}` || n.endsWith(` #${id}`) || n.endsWith(`#${id}`)) {
    return n.includes('#') ? n : `${n} #${id}`
  }
  return `${n} #${id}`
}

async function fetchOwnerInventory(owner, from = 0, size = 50) {
  const data = await graphqlRequest(
    `query($owner: String!, $from: Int!, $size: Int!) {
      axies(owner: $owner, from: $from, size: $size) {
        total
        results { id name image class }
      }
    }`,
    { owner, from, size },
  )
  const block = data?.axies || { total: 0, results: [] }
  const results = Array.isArray(block.results) ? block.results : []
  const axies = results.map((r) => {
    const id = String(r.id)
    const name = (r.name && String(r.name).trim()) || `Axie #${id}`
    // GraphQL often returns assets.axieinfinity.com which 403s in <img>; use CDN.
    const image = AXIE_CDN_PNG(id)
    return {
      id,
      name,
      image,
      thumb: '/api/image/' + id,
      class: r.class || null,
      label: axieLabelFrom(name, id),
    }
  })
  return {
    address: owner,
    total: Number(block.total) || axies.length,
    axies,
  }
}

async function fetchAxieOwnership(axieId) {
  const data = await graphqlRequest(
    `query($axieId: ID!) {
      axie(axieId: $axieId) {
        id
        name
        owner
        image
        class
      }
    }`,
    { axieId: String(axieId) },
  )
  const axie = data?.axie
  if (!axie || !axie.id) return null
  return {
    id: String(axie.id),
    name: (axie.name && String(axie.name).trim()) || `Axie #${axie.id}`,
    owner: normalizeAddress(axie.owner || ''),
    image: AXIE_CDN_PNG(String(axie.id)),
    thumb: '/api/image/' + String(axie.id),
    class: axie.class || null,
  }
}


const MAX_POSTS_PER_HOUR = 10
const MAX_LIKES_PER_HOUR = 60
const MAX_COMMENTS_PER_HOUR = 30
const MAX_FOLLOWS_PER_HOUR = 60
const MAX_COMMENT_LENGTH = 140
const MAX_COMMENTS_PER_POST = 50
const MAX_IMAGE_BYTES = 6 * 1024 * 1024
const MAX_NOTIFS_PER_ADDRESS = 100

/** R1 prestige-burn treasury (ledger mode — no chain tx yet). */
const DAILY_POT_SLP = 10000
const SPARK_SLP = 50
const MAX_SPARKS_PER_HOUR = 1
const MAX_FAN_BOOSTS_PER_HOUR = 10
const FAN_BOOST_MIN = 1
const FAN_BOOST_MAX = 10000
const BURN_MODE = 'ledger'


function emptyStore() {
  return { posts: [], axieScores: {}, dailyScores: {} }
}

/** Calendar date YYYY-MM-DD in Asia/Manila (UTC+8, no DST). */
function manilaDayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const d = parts.find((p) => p.type === 'day')?.value
  if (y && m && d) return `${y}-${m}-${d}`
  // Fallback: manual UTC+8
  const ms = date.getTime() + 8 * 60 * 60 * 1000
  const u = new Date(ms)
  const yy = u.getUTCFullYear()
  const mm = String(u.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(u.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** Next Asia/Manila midnight as ISO string. */
function nextManilaMidnightIso(now = new Date()) {
  const dayKey = manilaDayKey(now)
  const [y, m, d] = dayKey.split('-').map(Number)
  // Next Manila calendar day 00:00+08 = Date.UTC(y,m-1,d+1) - 8h
  return new Date(Date.UTC(y, m - 1, d + 1) - 8 * 60 * 60 * 1000).toISOString()
}

function loadStore() {
  const data = storage.get('posts', emptyStore)
  if (!Array.isArray(data.posts)) data.posts = []
  if (!data.axieScores || typeof data.axieScores !== 'object') data.axieScores = {}
  if (!data.dailyScores || typeof data.dailyScores !== 'object') data.dailyScores = {}
  for (const p of data.posts) {
    if (!Array.isArray(p.comments)) p.comments = []
  }
  return data
}

function saveStore(store) {
  storage.set('posts', store)
}

function emptyFollows() {
  return { byAddress: {} }
}

function loadFollows() {
  const data = storage.get('follows', emptyFollows)
  if (!data.byAddress || typeof data.byAddress !== 'object') data.byAddress = {}
  for (const [k, v] of Object.entries(data.byAddress)) {
    if (!Array.isArray(v)) data.byAddress[k] = []
    else data.byAddress[k] = v.map((x) => String(x)).filter(Boolean)
  }
  return data
}

function saveFollows(store) {
  storage.set('follows', store)
}

function emptyNotifs() {
  return { byAddress: {} }
}

function loadNotifs() {
  const data = storage.get('notifications', emptyNotifs)
  if (!data.byAddress || typeof data.byAddress !== 'object') data.byAddress = {}
  for (const [k, v] of Object.entries(data.byAddress)) {
    if (!Array.isArray(v)) data.byAddress[k] = []
  }
  return data
}

function saveNotifs(store) {
  storage.set('notifications', store)
}

function emptyOwners() {
  return {}
}

function loadOwners() {
  const data = storage.get('owners', emptyOwners)
  if (!data || typeof data !== 'object' || Array.isArray(data)) return emptyOwners()
  return data
}

function saveOwners(store) {
  storage.set('owners', store)
}

function emptyBurns() {
  return {
    mode: BURN_MODE,
    settledDays: [],
    records: [],
  }
}

function loadBurns() {
  const data = storage.get('burns', emptyBurns)
  if (!Array.isArray(data.settledDays)) data.settledDays = []
  if (!Array.isArray(data.records)) data.records = []
  data.mode = BURN_MODE
  return data
}

function saveBurns(store) {
  storage.set('burns', store)
}

function prevManilaDayKey(dayKey = manilaDayKey()) {
  const [y, m, d] = String(dayKey).split('-').map(Number)
  if (!y || !m || !d) return dayKey
  // Manila midnight of dayKey as UTC ms, then step back 1ms → previous Manila day
  const midnightUtc = Date.UTC(y, m - 1, d) - 8 * 60 * 60 * 1000
  return manilaDayKey(new Date(midnightUtc - 1))
}

function appendBurnRecord(burns, { dayKey, axieId, amount, kind, funder }) {
  const rec = {
    id: randomUUID(),
    dayKey: String(dayKey),
    axieId: String(axieId),
    amount: Math.floor(Number(amount) || 0),
    kind,
    funder: funder || 'treasury',
    status: 'pending',
    txHash: null,
    createdAt: Date.now(),
    mode: BURN_MODE,
  }
  burns.records.push(rec)
  return rec
}

/** Commit spark for owned numeric post. Max 1 spark/address/hour. */
function tryAwardSpark(ownerAddress, axieId) {
  const addr = normalizeAddress(ownerAddress)
  const id = String(axieId || '').trim()
  if (!addr || !ID_RE.test(id)) return null
  const rateKey = `spark:${addr}`
  const rate = checkRate(rateKey, 'sparks')
  if (!rate.ok) return null
  const burns = loadBurns()
  const dayKey = manilaDayKey()
  const rec = appendBurnRecord(burns, {
    dayKey,
    axieId: id,
    amount: SPARK_SLP,
    kind: 'spark',
    funder: 'treasury',
  })
  // Cap records
  if (burns.records.length > 5000) {
    burns.records = burns.records.slice(-4000)
  }
  saveBurns(burns)
  recordRate(rateKey, 'sparks')
  return { axieId: id, amount: SPARK_SLP, id: rec.id, dayKey, mode: BURN_MODE }
}

/**
 * Settle crown burns for a past Manila day from dailyScores weights.
 * Numeric axies only; free-cast excluded. Deducts that day's sparks from pot.
 */
function settleCrownForDay(dayKey, postsStore) {
  const burns = loadBurns()
  if (burns.settledDays.includes(dayKey)) {
    return { settled: false, reason: 'already-settled', dayKey }
  }
  const today = manilaDayKey()
  if (dayKey >= today) {
    return { settled: false, reason: 'day-not-ended', dayKey }
  }
  const bucket =
    postsStore?.dailyScores && typeof postsStore.dailyScores[dayKey] === 'object'
      ? postsStore.dailyScores[dayKey]
      : {}
  const weights = {}
  let totalPts = 0
  for (const [axieId, ptsRaw] of Object.entries(bucket)) {
    if (!ID_RE.test(String(axieId))) continue
    const pts = Number(ptsRaw) || 0
    if (pts <= 0) continue
    weights[axieId] = pts
    totalPts += pts
  }
  const sparksUsed = burns.records
    .filter((r) => r.dayKey === dayKey && r.kind === 'spark')
    .reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const potRemaining = Math.max(0, DAILY_POT_SLP - sparksUsed)
  const crowns = []
  if (totalPts > 0 && potRemaining > 0) {
    // Largest-remainder so integers sum to potRemaining
    const rows = Object.entries(weights).map(([axieId, pts]) => {
      const exact = (potRemaining * pts) / totalPts
      const floor = Math.floor(exact)
      return { axieId, pts, floor, frac: exact - floor }
    })
    let allocated = rows.reduce((s, r) => s + r.floor, 0)
    rows.sort((a, b) => b.frac - a.frac || b.pts - a.pts || a.axieId.localeCompare(b.axieId))
    let i = 0
    while (allocated < potRemaining && i < rows.length) {
      rows[i].floor += 1
      allocated += 1
      i += 1
    }
    for (const row of rows) {
      if (row.floor <= 0) continue
      const rec = appendBurnRecord(burns, {
        dayKey,
        axieId: row.axieId,
        amount: row.floor,
        kind: 'crown',
        funder: 'treasury',
      })
      crowns.push(rec)
    }
  }
  burns.settledDays.push(dayKey)
  if (burns.settledDays.length > 400) {
    burns.settledDays = burns.settledDays.slice(-300)
  }
  if (burns.records.length > 5000) {
    burns.records = burns.records.slice(-4000)
  }
  saveBurns(burns)
  return {
    settled: true,
    dayKey,
    pot: DAILY_POT_SLP,
    sparksUsed,
    potRemaining,
    totalPts,
    crowns: crowns.map((c) => ({
      axieId: c.axieId,
      amount: c.amount,
      id: c.id,
    })),
    mode: BURN_MODE,
  }
}

/** Auto-settle any Manila day before today that is not yet settled. */
function autoSettlePastDays(postsStore) {
  const today = manilaDayKey()
  const burns = loadBurns()
  const settled = new Set(burns.settledDays)
  const candidates = new Set()
  candidates.add(prevManilaDayKey(today))
  if (postsStore?.dailyScores && typeof postsStore.dailyScores === 'object') {
    for (const k of Object.keys(postsStore.dailyScores)) {
      if (k < today) candidates.add(k)
    }
  }
  for (const r of burns.records) {
    if (r.dayKey && r.dayKey < today) candidates.add(r.dayKey)
  }
  const results = []
  const ordered = [...candidates].filter((k) => k && k < today && !settled.has(k)).sort()
  for (const dayKey of ordered) {
    results.push(settleCrownForDay(dayKey, postsStore))
  }
  return results
}

/** Projected crown split if Manila day ended now (numeric axies only). */
function projectCrownSplit(postsStore, dayKey = manilaDayKey()) {
  const burns = loadBurns()
  const bucket = todayBucket(postsStore, dayKey)
  const weights = {}
  let totalPts = 0
  for (const [axieId, ptsRaw] of Object.entries(bucket)) {
    if (!ID_RE.test(String(axieId))) continue
    const pts = Number(ptsRaw) || 0
    if (pts <= 0) continue
    weights[axieId] = pts
    totalPts += pts
  }
  const dayRecs = burns.records.filter((r) => r.dayKey === dayKey)
  const sparksUsed = dayRecs
    .filter((r) => r.kind === 'spark')
    .reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const crownsUsed = dayRecs
    .filter((r) => r.kind === 'crown')
    .reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const potRemaining = Math.max(0, DAILY_POT_SLP - sparksUsed - crownsUsed)
  const projectedCrown = {}
  if (totalPts > 0 && potRemaining > 0) {
    const rows = Object.entries(weights).map(([axieId, pts]) => {
      const exact = (potRemaining * pts) / totalPts
      const floor = Math.floor(exact)
      return { axieId, pts, floor, frac: exact - floor }
    })
    let allocated = rows.reduce((s, r) => s + r.floor, 0)
    rows.sort((a, b) => b.frac - a.frac || b.pts - a.pts || a.axieId.localeCompare(b.axieId))
    let i = 0
    while (allocated < potRemaining && i < rows.length) {
      rows[i].floor += 1
      allocated += 1
      i += 1
    }
    for (const row of rows) {
      if (row.floor > 0) projectedCrown[row.axieId] = row.floor
    }
  }
  return { projectedCrown, potRemaining, sparksUsed, crownsUsed, totalPts }
}

function committedByAxie(dayKey = manilaDayKey()) {
  const burns = loadBurns()
  const byAxie = {}
  for (const r of burns.records) {
    if (r.dayKey !== dayKey) continue
    if (!ID_RE.test(String(r.axieId))) continue
    const id = String(r.axieId)
    if (!byAxie[id]) byAxie[id] = { spark: 0, crown: 0, fan: 0, total: 0 }
    const amt = Math.floor(Number(r.amount) || 0)
    if (r.kind === 'spark') byAxie[id].spark += amt
    else if (r.kind === 'crown') byAxie[id].crown += amt
    else if (r.kind === 'fan') byAxie[id].fan += amt
    byAxie[id].total =
      byAxie[id].spark + byAxie[id].crown + byAxie[id].fan
  }
  return byAxie
}

function burnsTodayPayload(postsStore) {
  autoSettlePastDays(postsStore)
  const dayKey = manilaDayKey()
  const byAxie = committedByAxie(dayKey)
  const proj = projectCrownSplit(postsStore, dayKey)
  return {
    dayKey,
    timezone: 'Asia/Manila',
    mode: BURN_MODE,
    modeLabel: 'Demo burn (ledger)',
    pot: DAILY_POT_SLP,
    sparkAmount: SPARK_SLP,
    potRemaining: proj.potRemaining,
    committed: { byAxie },
    projectedCrown: proj.projectedCrown,
    resetsAt: nextManilaMidnightIso(),
  }
}


/** Public chrome: Waypoint name or 0x12ab…cd34. Never email. */
function shortOwnerAddress(addr) {
  const a = normalizeAddress(addr)
  if (!a) return ''
  if (a.length < 10) return a
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

function sanitizeOwnerName(raw) {
  if (typeof raw !== 'string') return ''
  let s = raw.replace(/<[^>]*>/g, ' ')
  s = s.replace(/[\u0000-\u001f\u007f]/g, '')
  s = s.replace(/&[a-zA-Z0-9#]+;/g, ' ')
  s = s.replace(/[<>]/g, '')
  s = s.replace(/\s+/g, ' ').trim()
  if (!s) return ''
  if (s.includes('@')) return ''
  if (s.length > 32) s = s.slice(0, 32).trim()
  return s
}

function ownerNameFor(address) {
  const a = normalizeAddress(address)
  if (!a) return ''
  const rec = loadOwners()[a]
  if (!rec || typeof rec !== 'object') return ''
  return sanitizeOwnerName(rec.name)
}

function ownerDisplayNameFor(address) {
  const a = normalizeAddress(address)
  if (!a) return ''
  return ownerNameFor(a) || shortOwnerAddress(a)
}

/**
 * Unique normalized addresses for inventory / ownership: the lookup address
 * plus identity + secondary from owners.json (and mirrored entries).
 */
function walletSetFor(address) {
  const a = normalizeAddress(address)
  if (!a) return []
  const owners = loadOwners()
  const set = new Set([a])
  const collect = (rec) => {
    if (!rec || typeof rec !== 'object') return
    const identity = normalizeAddress(rec.identity || '')
    const secondary = normalizeAddress(rec.secondary || '')
    if (identity) set.add(identity)
    if (secondary) set.add(secondary)
  }
  collect(owners[a])
  // Pull fields from any mirrored wallet entry already in the set
  for (const addr of [...set]) {
    collect(owners[addr])
  }
  return [...set]
}

function parseWalletDefault(raw, identity, secondary) {
  if (typeof raw !== 'string') return ''
  const t = raw.trim().toLowerCase()
  if (t === 'identity' || t === 'wallet.identity') return 'identity'
  if (t === 'secondary' || t === 'wallet.secondary') return 'secondary'
  const asAddr = normalizeAddress(raw)
  if (asAddr && identity && asAddr === identity) return 'identity'
  if (asAddr && secondary && asAddr === secondary) return 'secondary'
  return ''
}

/** Fetch all pages for one owner (GraphQL paginates). */
async function fetchAllOwnerAxies(owner) {
  const all = []
  let from = 0
  let total = Infinity
  const pageSize = 100
  while (from < total && from < 5000) {
    const page = await fetchOwnerInventory(owner, from, pageSize)
    total = Number(page.total) || 0
    const batch = Array.isArray(page.axies) ? page.axies : []
    all.push(...batch)
    if (!batch.length) break
    from += batch.length
  }
  return all
}


/**
 * Sky Mavis get-profile via curl + tempfile (Node fetch often gets CF 403).
 * Never persists the JWT.
 */
async function fetchWaypointProfile(idToken) {
  const res = await fetch(WAYPOINT_PROFILE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ id_token: idToken }),
    signal: AbortSignal.timeout(20_000),
  })
  let json = {}
  try {
    json = JSON.parse((await res.text()) || '{}')
  } catch {
    json = {}
  }
  return { status: res.status, json }
}

function followsFor(address) {
  const store = loadFollows()
  const list = store.byAddress[address]
  return Array.isArray(list) ? [...list] : []
}

function followerCountMap(axieIds) {
  const want = new Set((axieIds || []).map((x) => String(x)))
  const counts = {}
  for (const id of want) counts[id] = 0
  if (!want.size) return counts
  const store = loadFollows()
  for (const list of Object.values(store.byAddress)) {
    if (!Array.isArray(list)) continue
    for (const id of list) {
      if (want.has(id)) counts[id] = (counts[id] || 0) + 1
    }
  }
  return counts
}

function followerCountFor(axieId) {
  return followerCountMap([axieId])[String(axieId)] || 0
}

/** Owner-inbox only: likes/comments on posts whose costume was posted as owned. */
function pushOwnerNotif(post, kind, fromLabel, extra = {}) {
  const owner = normalizeAddress(post?.ownerAddress || '')
  if (!owner) return
  const notifs = loadNotifs()
  if (!Array.isArray(notifs.byAddress[owner])) notifs.byAddress[owner] = []
  const entry = {
    id: randomUUID(),
    createdAt: Date.now(),
    type: kind,
    postId: post.id,
    axieId: post.axieId,
    axieLabel: post.axieLabel || post.axieId,
    fromLabel: String(fromLabel || 'Guest').slice(0, 96),
    read: false,
    ...extra,
  }
  notifs.byAddress[owner].unshift(entry)
  if (notifs.byAddress[owner].length > MAX_NOTIFS_PER_ADDRESS) {
    notifs.byAddress[owner].length = MAX_NOTIFS_PER_ADDRESS
  }
  saveNotifs(notifs)
}

function todayBucket(store, dayKey = manilaDayKey()) {
  if (!store.dailyScores || typeof store.dailyScores !== 'object') store.dailyScores = {}
  if (!store.dailyScores[dayKey] || typeof store.dailyScores[dayKey] !== 'object') {
    store.dailyScores[dayKey] = {}
  }
  return store.dailyScores[dayKey]
}

/** True for free-cast kit ids or numeric owned Axie ids. */
function isCostumeId(id) {
  const s = String(id || '').trim()
  if (!s) return false
  if (FREE_CAST_IDS.has(s)) return true
  return /^\d+$/.test(s)
}

/** Bump all-time axieScores AND today's dailyScores for any costume id
 *  (free-cast kit + numeric owned Axies). Public Idol Board ranks both.
 *  Negative deltas floor at 0. */
function bumpIdolPoints(store, axieId, delta) {
  if (!axieId || !delta) return
  const id = String(axieId).trim()
  if (!isCostumeId(id)) return
  if (!store.axieScores || typeof store.axieScores !== 'object') store.axieScores = {}
  const bucket = todayBucket(store)
  if (delta < 0) {
    store.axieScores[id] = Math.max(0, (store.axieScores[id] || 0) + delta)
    bucket[id] = Math.max(0, (bucket[id] || 0) + delta)
  } else {
    store.axieScores[id] = (store.axieScores[id] || 0) + delta
    bucket[id] = (bucket[id] || 0) + delta
  }
}

function scoresPayload(store) {
  const dayKey = manilaDayKey()
  const daily = { ...(todayBucket(store, dayKey)) }
  return {
    axieScores: daily,
    dailyAxieScores: daily,
    allTimeAxieScores: store.axieScores || {},
    dayKey,
    timezone: 'Asia/Manila',
  }
}

/** In-memory rate buckets: deviceKey → { posts, likes, comments } (epoch ms arrays) */
const rateBuckets = new Map()

function getBucket(deviceKey) {
  let b = rateBuckets.get(deviceKey)
  if (!b) {
    b = { posts: [], likes: [], comments: [], follows: [], sparks: [], boosts: [] }
    rateBuckets.set(deviceKey, b)
  } else {
    if (!Array.isArray(b.comments)) b.comments = []
    if (!Array.isArray(b.follows)) b.follows = []
    if (!Array.isArray(b.sparks)) b.sparks = []
    if (!Array.isArray(b.boosts)) b.boosts = []
  }
  return b
}

function pruneHour(arr, now = Date.now()) {
  const cutoff = now - 60 * 60 * 1000
  while (arr.length && arr[0] < cutoff) arr.shift()
  return arr.length
}

function rateLimitFor(kind) {
  if (kind === 'posts') return MAX_POSTS_PER_HOUR
  if (kind === 'comments') return MAX_COMMENTS_PER_HOUR
  if (kind === 'follows') return MAX_FOLLOWS_PER_HOUR
  if (kind === 'sparks') return MAX_SPARKS_PER_HOUR
  if (kind === 'boosts') return MAX_FAN_BOOSTS_PER_HOUR
  return MAX_LIKES_PER_HOUR
}

function rateArr(bucket, kind) {
  if (kind === 'posts') return bucket.posts
  if (kind === 'comments') return bucket.comments
  if (kind === 'follows') return bucket.follows
  if (kind === 'sparks') return bucket.sparks
  if (kind === 'boosts') return bucket.boosts
  return bucket.likes
}

function checkRate(deviceKey, kind) {
  const limit = rateLimitFor(kind)
  const b = getBucket(deviceKey)
  const arr = rateArr(b, kind)
  const count = pruneHour(arr)
  if (count >= limit) {
    return { ok: false, limit, count }
  }
  return { ok: true, limit, count }
}

function recordRate(deviceKey, kind) {
  const b = getBucket(deviceKey)
  rateArr(b, kind).push(Date.now())
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(text),
  })
  res.end(text)
}

function readBody(req, limit = 8 * 1024 * 1024) {
  const buf = req.body || Buffer.alloc(0)
  if (buf.length > limit) {
    return Promise.reject(Object.assign(new Error('Body too large'), { statusCode: 413 }))
  }
  return Promise.resolve(buf)
}

function deviceKeyFrom(req, body) {
  const header = req.headers.get('x-device-key')
  if (typeof header === 'string' && header.trim()) return header.trim().slice(0, 128)
  if (body && typeof body.deviceKey === 'string' && body.deviceKey.trim()) {
    return body.deviceKey.trim().slice(0, 128)
  }
  return ''
}

const ID_RE = /^\d+$/

async function proxyMetadata(id, res) {
  if (!ID_RE.test(id)) {
    sendJson(res, 400, { error: 'Invalid Axie ID' })
    return
  }
  const upstream = await fetch(`${METADATA_BASE}/axie/${id}`)
  const text = await upstream.text()
  res.writeHead(upstream.status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=60',
  })
  res.end(text)
}

async function proxyImage(id, res) {
  if (!ID_RE.test(id)) {
    sendJson(res, 400, { error: 'Invalid Axie ID' })
    return
  }
  const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; AxieIdol/1.0)', Accept: 'image/png,image/*,*/*' }
  // 1) CDN first (fast path; works without metadata)
  let upstream = null
  try {
    upstream = await fetch(AXIE_CDN_PNG(id), { headers: UA, signal: AbortSignal.timeout(15_000) })
  } catch {
    upstream = null
  }
  // 2) Fallback: metadata image URL
  if (!upstream || !upstream.ok) {
    try {
      const metaRes = await fetch(`${METADATA_BASE}/axie/${id}`, { headers: { 'User-Agent': UA['User-Agent'], Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) })
      if (metaRes.ok) {
        const meta = await metaRes.json()
        if (meta?.image && typeof meta.image === 'string') {
          upstream = await fetch(meta.image, { headers: UA, signal: AbortSignal.timeout(15_000) })
        }
      }
    } catch {
      /* keep upstream as is */
    }
  }
  if (!upstream || !upstream.ok) {
    sendJson(res, upstream && upstream.status === 404 ? 404 : 502, {
      error: `Upstream image fetch failed (${upstream ? upstream.status : 'network'})`,
      url: AXIE_CDN_PNG(id),
    })
    return
  }
  const buf = Buffer.from(await upstream.arrayBuffer())
  res.writeHead(200, {
    'Content-Type': upstream.headers.get('content-type') || 'image/png',
    'Cache-Control': 'public, max-age=86400',
    'Content-Length': String(buf.length),
  })
  res.end(buf)
}









function parseDataUrl(imageBase64) {
  if (typeof imageBase64 !== 'string' || !imageBase64) return null
  const m = /^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/i.exec(imageBase64.trim())
  if (m) {
    const subtype = m[2].toLowerCase() === 'jpg' ? 'jpeg' : m[2].toLowerCase()
    const buf = Buffer.from(m[3], 'base64')
    return { buf, ext: subtype === 'jpeg' ? '.jpg' : `.${subtype}`, mime: `image/${subtype}` }
  }
  // Raw base64 — assume PNG
  try {
    const buf = Buffer.from(imageBase64.replace(/\s/g, ''), 'base64')
    if (buf.length < 8) return null
    // PNG magic
    if (buf[0] === 0x89 && buf[1] === 0x50) {
      return { buf, ext: '.png', mime: 'image/png' }
    }
    // JPEG magic
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      return { buf, ext: '.jpg', mime: 'image/jpeg' }
    }
    return { buf, ext: '.png', mime: 'image/png' }
  } catch {
    return null
  }
}

function publicComments(comments) {
  const list = Array.isArray(comments) ? comments : []
  // Oldest-first for thread read order; cap at 50 for feed payload
  return list
    .slice(0, MAX_COMMENTS_PER_POST)
    .map((c) => {
      const out = {
        id: c.id,
        createdAt: c.createdAt,
        authorGuestId: c.authorGuestId,
        authorLabel: c.authorLabel,
        text: c.text,
      }
      if (c.cast || (typeof c.castId === 'string' && FREE_CAST_IDS.has(c.castId))) {
        out.cast = true
        out.castId = c.castId || String(c.authorGuestId || '').replace(/^cast:/, '')
      }
      return out
    })
}


async function handleInventory(req, res, url) {
  const addressRaw = url.searchParams.get('address') || ''
  const address = normalizeAddress(addressRaw)
  if (!address) {
    sendJson(res, 400, { error: 'Valid address required (0x… or ronin:…)' })
    return
  }
  let from = Number(url.searchParams.get('from') || 0)
  let size = Number(url.searchParams.get('size') || 50)
  if (!Number.isFinite(from) || from < 0) from = 0
  if (!Number.isFinite(size) || size < 1) size = 50
  size = Math.min(100, Math.floor(size))
  from = Math.floor(from)
  try {
    const wallets = walletSetFor(address)
    const byId = new Map()
    for (const w of wallets) {
      const axies = await fetchAllOwnerAxies(w)
      for (const axie of axies) {
        const id = String(axie.id)
        if (!byId.has(id)) byId.set(id, axie)
      }
    }
    const merged = [...byId.values()].sort((a, b) => {
      const na = Number(a.id)
      const nb = Number(b.id)
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
      return String(a.id).localeCompare(String(b.id))
    })
    const total = merged.length
    const slice = merged.slice(from, from + size)
    sendJson(res, 200, {
      address,
      wallets,
      total,
      axies: slice,
    })
  } catch (err) {
    console.warn('[server] inventory failed', err)
    sendJson(res, err?.statusCode || 502, {
      error: err instanceof Error ? err.message : 'Inventory fetch failed',
    })
  }
}

/** Soft personalization signals for Global warm-chrono ranking (7d engagement window). */
const ENGAGED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const FRESH_PROTECT_K = 10
const FRESH_SLOT_CAP = 14
const VERY_FRESH_MS = 12 * 60 * 1000

function viewerDeviceKey(req, url) {
  const fromHeader = deviceKeyFrom(req, null)
  if (fromHeader) return fromHeader
  const q = url?.searchParams?.get('deviceKey') || ''
  return typeof q === 'string' && q.trim() ? q.trim().slice(0, 128) : ''
}

function viewerGuestId(url) {
  const q =
    url?.searchParams?.get('authorGuestId') || url?.searchParams?.get('guestId') || ''
  return typeof q === 'string' && q.trim() ? q.trim().slice(0, 64) : ''
}

function engagedAxieIdsForViewer(posts, { deviceKey, guestId, now }) {
  const out = new Set()
  if (!deviceKey && !guestId) return out
  const cutoff = now - ENGAGED_WINDOW_MS
  for (const p of posts) {
    const axieId = String(p.axieId || '')
    if (!axieId) continue
    const pAt = Number(p.createdAt) || 0
    // Likes have no timestamp — count if the post itself is within 7d
    if (
      deviceKey &&
      pAt >= cutoff &&
      Array.isArray(p.likedByDevice) &&
      p.likedByDevice.includes(deviceKey)
    ) {
      out.add(axieId)
      continue
    }
    if (guestId && Array.isArray(p.comments)) {
      for (const c of p.comments) {
        if (!c) continue
        const cAt = Number(c.createdAt) || 0
        if (cAt < cutoff) continue
        if (String(c.authorGuestId || '') === guestId) {
          out.add(axieId)
          break
        }
      }
    }
  }
  return out
}

function unlockedCastIdsForViewer({ address, guestId, deviceKey }) {
  const key = castCrewPosterKey({
    ownerAddress: address,
    address,
    authorGuestId: guestId,
    deviceKey,
  })
  if (!key) return new Set(['kotaro'])
  try {
    const store = loadCastCrew()
    const entry = normalizeQuestEntry(store.byPoster?.[key] || defaultQuestEntry())
    const unlocked = Array.isArray(entry.unlockedCast) ? entry.unlockedCast : ['kotaro']
    return new Set(unlocked.filter((id) => FREE_CAST_IDS.has(String(id))).map(String))
  } catch {
    return new Set(['kotaro'])
  }
}

function lowIdFactor(axieId) {
  if (!ID_RE.test(axieId)) return 0
  const n = Number(axieId)
  if (!Number.isFinite(n) || n < 0) return 0
  return 1 / Math.log10(n + 10)
}

/**
 * Warm chronological score: recency dominates; small additive personal + discovery bumps.
 * score = 1/(1+ageHours) + followed(0.25) + castCrew(0.2) + engaged7d(0.15)
 *         + freeCast(0.08) + 0.05*lowIdFactor + veryFresh(2.0 if <12m)
 */
function scoreWarmPost(post, now, { followed, unlockedCast, engaged }) {
  const axieId = String(post.axieId || '')
  const ageMs = Math.max(0, now - (Number(post.createdAt) || 0))
  const ageHours = ageMs / 3_600_000
  const recency = 1 / (1 + ageHours)
  const reasons = [`recency:${recency.toFixed(3)}`]
  let boost = 0
  if (followed.has(axieId)) {
    boost += 0.25
    reasons.push('followed')
  }
  if (unlockedCast.has(axieId)) {
    boost += 0.2
    reasons.push('castCrew')
  }
  if (engaged.has(axieId)) {
    boost += 0.15
    reasons.push('engaged7d')
  }
  if (FREE_CAST_IDS.has(axieId)) {
    boost += 0.08
    reasons.push('freeCast')
  }
  const lif = lowIdFactor(axieId)
  if (lif > 0) {
    boost += 0.05 * lif
    reasons.push(`lowId:${lif.toFixed(3)}`)
  }
  if (ageMs <= VERY_FRESH_MS) {
    boost += 2.0
    reasons.push('veryFresh')
  }
  return { score: recency + boost, reasons, recency, boost }
}

/** Keep the K newest posts from falling below slot ~FRESH_SLOT_CAP. */
function applyFreshnessCap(ranked, k = FRESH_PROTECT_K, maxSlot = FRESH_SLOT_CAP - 1) {
  if (!ranked.length) return ranked
  const byTime = [...ranked].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  const protect = byTime.slice(0, Math.min(k, ranked.length))
  const out = [...ranked]
  // Oldest-of-protected first so newest wins conflicts when bubbling up
  for (const p of [...protect].reverse()) {
    const i = out.findIndex((x) => x.id === p.id)
    if (i < 0) continue
    if (i > maxSlot) {
      out.splice(i, 1)
      out.splice(maxSlot, 0, p)
    }
  }
  return out
}

function warmRankGlobalPosts(rawPosts, ctx) {
  const now = ctx.now || Date.now()
  const scored = rawPosts.map((p) => {
    const s = scoreWarmPost(p, now, ctx)
    return {
      post: p,
      id: p.id,
      createdAt: Number(p.createdAt) || 0,
      score: s.score,
      reasons: s.reasons,
    }
  })
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.createdAt - a.createdAt
  })
  const capped = applyFreshnessCap(scored)
  return capped
}

function handleFeed(req, res, url) {
  const store = loadStore()
  autoSettlePastDays(store)
  // Global empty-room: pad with durable cast seed posts when live volume is thin
  ensureSeedPosts(store)
  let posts = filterSeedPosts([...store.posts])
  const axieIdRaw = url?.searchParams?.get('axieId')
  const followingRaw = url?.searchParams?.get('following')
  const followingOn = followingRaw === '1' || followingRaw === 'true'
  const authorAddress = normalizeAddress(url?.searchParams?.get('authorAddress') || '')
  const followAddress = normalizeAddress(url?.searchParams?.get('address') || '')
  const debugRank =
    url?.searchParams?.get('debugRank') === '1' ||
    url?.searchParams?.get('debugRank') === 'true'
  let timelineAxieId = ''
  const isGlobal = !followingOn && (axieIdRaw == null || String(axieIdRaw).trim() === '')

  if (axieIdRaw != null && String(axieIdRaw).trim() !== '') {
    const axieId = String(axieIdRaw).trim()
    if (!isCostumeId(axieId)) {
      sendJson(res, 400, { error: 'axieId must be a free-cast id or numeric Axie id' })
      return
    }
    timelineAxieId = axieId
    posts = posts.filter((p) => p.axieId === axieId)
  } else if (followingOn) {
    if (!followAddress) {
      sendJson(res, 401, { error: 'address required for Following feed' })
      return
    }
    const set = new Set(followsFor(followAddress))
    posts = posts.filter((p) => set.has(String(p.axieId)))
  }

  if (authorAddress) {
    posts = posts.filter(
      (p) => normalizeAddress(p.ownerAddress || '') === authorAddress,
    )
  }

  let rankedMeta = null
  if (isGlobal && !authorAddress) {
    const now = Date.now()
    const deviceKey = viewerDeviceKey(req, url)
    const guestId = viewerGuestId(url)
    const followed = followAddress
      ? new Set(followsFor(followAddress).map(String))
      : new Set()
    const unlockedCast = unlockedCastIdsForViewer({
      address: followAddress,
      guestId,
      deviceKey,
    })
    const engaged = engagedAxieIdsForViewer(store.posts, { deviceKey, guestId, now })
    const ranked = warmRankGlobalPosts(posts, {
      now,
      followed,
      unlockedCast,
      engaged,
    })
    rankedMeta = ranked.slice(0, 50)
    posts = rankedMeta.map((row) => {
      const pub = publicPost(row.post)
      if (debugRank) {
        pub._score = Math.round(row.score * 1000) / 1000
        pub._reasons = row.reasons
      }
      return pub
    })
  } else {
    posts = posts
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 50)
      .map((p) => publicPost(p))
  }

  const payload = { posts, ...scoresPayload(store), burns: burnsTodayPayload(store), golden: goldenSummary(store) }
  if (timelineAxieId) {
    payload.axieId = timelineAxieId
    payload.followerCount = followerCountFor(timelineAxieId)
    if (ID_RE.test(timelineAxieId)) {
      const owned = store.posts
        .filter(
          (p) =>
            String(p.axieId) === timelineAxieId &&
            Boolean(normalizeAddress(p.ownerAddress || '')),
        )
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      const last = owned[0]
      if (last) {
        const addr = normalizeAddress(last.ownerAddress)
        const n = ownerNameFor(addr)
        payload.owner = {
          address: addr,
          name: n,
          displayName: n || shortOwnerAddress(addr),
        }
      } else {
        payload.owner = null
      }
    }
  }
  if (followingOn) {
    payload.following = true
    payload.follows = followsFor(followAddress)
  }
  if (isGlobal && !authorAddress) {
    payload.rank = 'warm'
  }
  sendJson(res, 200, payload)
}

const BOARD_RANK_LIMIT = 100

/** Sum idol points across all Manila daily buckets (per axie id). */
function sumDailyIdolPoints(store) {
  const sums = {}
  const daily = store?.dailyScores && typeof store.dailyScores === 'object' ? store.dailyScores : {}
  for (const bucket of Object.values(daily)) {
    if (!bucket || typeof bucket !== 'object') continue
    for (const [id, pts] of Object.entries(bucket)) {
      if (!isCostumeId(id)) continue
      const n = Number(pts) || 0
      if (!n) continue
      sums[id] = (sums[id] || 0) + n
    }
  }
  return sums
}

/** Ensure all-time axieScores is at least the sum of daily buckets (repair drift). */
function repairAllTimeScores(store) {
  if (!store.axieScores || typeof store.axieScores !== 'object') store.axieScores = {}
  const sums = sumDailyIdolPoints(store)
  let changed = false
  for (const [id, sum] of Object.entries(sums)) {
    const cur = Number(store.axieScores[id] || 0) || 0
    if (cur < sum) {
      store.axieScores[id] = sum
      changed = true
    }
  }
  return changed
}

/** Label + preview (+ optional owner address) for a board row (legacy Axie board). */
function boardMetaFor(store, axieId) {
  const cast = FREE_CAST.find((c) => c.id === axieId)
  if (cast) {
    return { label: cast.label, preview: cast.preview, ownerAddress: '' }
  }
  let label = ''
  let ownerAddress = ''
  const posts = Array.isArray(store.posts) ? store.posts : []
  for (let i = posts.length - 1; i >= 0; i--) {
    const p = posts[i]
    if (String(p?.axieId || '') !== String(axieId)) continue
    if (!label && typeof p.axieLabel === 'string' && p.axieLabel.trim()) {
      label = p.axieLabel.trim().slice(0, 96)
    }
    if (!ownerAddress) {
      ownerAddress = normalizeAddress(p.ownerAddress || '') || ''
    }
    if (label && ownerAddress) break
  }
  return {
    label: label || `Axie #${axieId}`,
    preview: `/api/image/${axieId}`,
    ownerAddress,
  }
}

/** Highest unlocked free-cast face for a quest entry (fallback Kotaro). */
function highestUnlockedCastId(entry) {
  const unlocked = new Set(
    (Array.isArray(entry?.unlockedCast) ? entry.unlockedCast : ['kotaro']).map(String),
  )
  if (!unlocked.has('kotaro')) unlocked.add('kotaro')
  for (let i = QUEST_DEFS.length - 1; i >= 0; i--) {
    const u = QUEST_DEFS[i]?.unlock
    if (u?.type === 'cast' && FREE_CAST_IDS.has(u.id) && unlocked.has(u.id)) {
      return u.id
    }
  }
  return 'kotaro'
}

function castPreviewForId(castId) {
  const cast = FREE_CAST.find((c) => c.id === castId)
  if (cast?.preview) return cast.preview
  if (FREE_CAST_IDS.has(castId)) return `/previews/${castId}.png`
  return '/previews/kotaro.png'
}

/** Parse posterKey → { address, guestId, deviceKey }. */
function parsePosterKey(posterKey) {
  const key = String(posterKey || '')
  if (key.startsWith('guest:')) {
    return { address: '', guestId: key.slice(6), deviceKey: '' }
  }
  if (key.startsWith('device:')) {
    return { address: '', guestId: '', deviceKey: key.slice(7) }
  }
  const addr = normalizeAddress(key)
  return { address: addr || '', guestId: '', deviceKey: '' }
}

function guestLabelFromId(guestId) {
  const g = String(guestId || '').trim()
  if (!g) return 'Guest'
  const short = g.replace(/-/g, '').slice(0, 4).toUpperCase()
  return `Guest-${short || '????'}`
}

/** Best display label for a posterKey from owners.json / recent posts. */
function boardLabelForPoster(posterKey, postsStore) {
  const { address, guestId, deviceKey } = parsePosterKey(posterKey)
  if (address) return ownerDisplayNameFor(address)
  const posts = Array.isArray(postsStore?.posts) ? postsStore.posts : []
  if (guestId) {
    for (let i = posts.length - 1; i >= 0; i--) {
      const p = posts[i]
      if (String(p?.authorGuestId || '') !== guestId) continue
      if (typeof p.authorLabel === 'string' && p.authorLabel.trim()) {
        return p.authorLabel.trim().slice(0, 96)
      }
    }
    return guestLabelFromId(guestId)
  }
  if (deviceKey) {
    for (let i = posts.length - 1; i >= 0; i--) {
      const p = posts[i]
      if (String(p?.deviceKey || '') !== deviceKey) continue
      if (typeof p.authorLabel === 'string' && p.authorLabel.trim()) {
        return p.authorLabel.trim().slice(0, 96)
      }
    }
    const short = deviceKey.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()
    return `Device-${short || '????'}`
  }
  return 'Player'
}

/** Poster keys that posted or had quest progress today (Asia/Manila). */
function activePosterKeysToday(postsStore, crewStore, dayKey) {
  const active = new Set()
  const posts = Array.isArray(postsStore?.posts) ? postsStore.posts : []
  for (const p of posts) {
    const created = Number(p?.createdAt) || 0
    if (!created) continue
    if (manilaDayKey(new Date(created)) !== dayKey) continue
    const key = posterKeyFromPost(p)
    if (key) active.add(key)
  }
  const byPoster = crewStore?.byPoster && typeof crewStore.byPoster === 'object' ? crewStore.byPoster : {}
  for (const [key, raw] of Object.entries(byPoster)) {
    const updatedAt = raw?.updatedAt
    if (!updatedAt) continue
    const t = Date.parse(updatedAt)
    if (!Number.isFinite(t)) continue
    if (manilaDayKey(new Date(t)) === dayKey) active.add(key)
  }
  return active
}

/**
 * Quest-level player ladder (primary Idol Board).
 * All-time: every castCrew poster sorted by level.
 * Daily: posters active today, sorted by current quest level.
 */
function buildQuestLevelBoard(range, dayKey) {
  const postsStore = loadStore()
  const crewStore = loadCastCrew()
  const byPoster =
    crewStore.byPoster && typeof crewStore.byPoster === 'object' ? crewStore.byPoster : {}
  const activeToday =
    range === 'daily' ? activePosterKeysToday(postsStore, crewStore, dayKey) : null

  const rows = []
  for (const [posterKey, raw] of Object.entries(byPoster)) {
    if (range === 'daily' && activeToday && !activeToday.has(posterKey)) continue
    const entry = normalizeQuestEntry(raw || defaultQuestEntry())
    const level = Math.max(0, Math.min(24, Math.floor(Number(entry.level) || 0)))
    const { address, guestId } = parsePosterKey(posterKey)
    const previewCastId = highestUnlockedCastId(entry)
    const preview = castPreviewForId(previewCastId)
    const label = boardLabelForPoster(posterKey, postsStore)
    const nextQuest = nextQuestPayload(entry)
    const posts = Math.max(0, Math.floor(Number(entry.stats?.posts) || 0))
    // Prefer raw updatedAt — evaluateQuests() rewrites it on every normalize
    const updatedAtRaw = raw?.updatedAt || entry.updatedAt || null
    const updatedMs = updatedAtRaw ? Date.parse(updatedAtRaw) : 0
    let owner = null
    if (address) {
      owner = {
        address,
        displayName: ownerDisplayNameFor(address),
      }
    }
    rows.push({
      posterKey,
      address: address || null,
      guestId: guestId || null,
      label,
      level,
      // Back-compat: older clients read `points` as the board score
      points: level,
      preview,
      previewCastId,
      // Keep axieId = preview cast so existing timeline click paths still work
      axieId: previewCastId,
      followerCount: Array.isArray(entry.unlockedCast) ? entry.unlockedCast.length : 1,
      owner,
      nextQuest: nextQuest
        ? {
            level: nextQuest.level,
            description: nextQuest.description,
            progress: nextQuest.progress,
            target: nextQuest.target,
            unlockLabel: nextQuest.unlockLabel,
          }
        : null,
      stats: { posts },
      updatedAt: updatedAtRaw,
      _sortPosts: posts,
      _sortUpdated: Number.isFinite(updatedMs) ? updatedMs : 0,
    })
  }

  rows.sort((a, b) => {
    if (b.level !== a.level) return b.level - a.level
    if (b._sortUpdated !== a._sortUpdated) return b._sortUpdated - a._sortUpdated
    if (b._sortPosts !== a._sortPosts) return b._sortPosts - a._sortPosts
    return String(a.label).localeCompare(String(b.label))
  })

  return rows.slice(0, BOARD_RANK_LIMIT).map((row, i) => {
    const {
      _sortPosts: _p,
      _sortUpdated: _u,
      ...publicRow
    } = row
    return { ...publicRow, rank: i + 1 }
  })
}

function handleBoard(_req, res, url) {
  const store = loadStore()
  autoSettlePastDays(store)
  if (repairAllTimeScores(store)) saveStore(store)

  const rawRange = String(url?.searchParams?.get('range') || 'daily').toLowerCase()
  const range = rawRange === 'all' || rawRange === 'alltime' || rawRange === 'all-time' ? 'all' : 'daily'
  const dayKey = manilaDayKey()
  const burns = burnsTodayPayload(store)
  const rankings = buildQuestLevelBoard(range, dayKey)

  sendJson(res, 200, {
    range,
    dayKey,
    timezone: 'Asia/Manila',
    resetsAt: range === 'daily' ? nextManilaMidnightIso() : null,
    sortBy: 'questLevel',
    rankings,
    burns,
    golden: goldenSummary(store),
  })
}


/** Latest owned post for a numeric Axie — used for follow inbox + deep-link. */
function latestOwnedPostForAxie(axieId) {
  const id = String(axieId || '').trim()
  if (!id || !/^\d+$/.test(id)) return null
  const store = loadStore()
  const owned = (store.posts || []).filter(
    (p) => String(p.axieId) === id && Boolean(normalizeAddress(p.ownerAddress || '')),
  )
  owned.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  return owned[0] || null
}

function ownerAddressForAxie(axieId) {
  const post = latestOwnedPostForAxie(axieId)
  if (post) return normalizeAddress(post.ownerAddress || '')
  return ''
}

/** Notify Axie owner when someone follows their owned costume. */
function pushFollowNotif(axieId, fromLabel, followerAddress) {
  const id = String(axieId || '').trim()
  if (!/^\d+$/.test(id)) return
  const owner = ownerAddressForAxie(id)
  if (!owner) return
  const follower = normalizeAddress(followerAddress || '')
  if (follower && follower === owner) return
  const post = latestOwnedPostForAxie(id)
  const notifs = loadNotifs()
  if (!Array.isArray(notifs.byAddress[owner])) notifs.byAddress[owner] = []
  const entry = {
    id: randomUUID(),
    createdAt: Date.now(),
    type: 'follow',
    postId: post?.id || '',
    axieId: id,
    axieLabel: (post && post.axieLabel) || `Axie #${id}`,
    fromLabel: String(fromLabel || 'Fan').slice(0, 96),
    fromAddress: follower || '',
    read: false,
  }
  notifs.byAddress[owner].unshift(entry)
  if (notifs.byAddress[owner].length > MAX_NOTIFS_PER_ADDRESS) {
    notifs.byAddress[owner].length = MAX_NOTIFS_PER_ADDRESS
  }
  saveNotifs(notifs)
}

async function handleFollow(req, res, mode) {
  let body
  try {
    const raw = await readBody(req, 64 * 1024)
    body = JSON.parse(raw.toString('utf8') || '{}')
  } catch (err) {
    const status = err?.statusCode || 400
    sendJson(res, status, { error: status === 413 ? 'Body too large' : 'Invalid JSON' })
    return
  }

  const address = normalizeAddress(
    typeof body.address === 'string' ? body.address : '',
  )
  if (!address) {
    sendJson(res, 401, { error: 'Valid address required to follow' })
    return
  }

  const axieId = typeof body.axieId === 'string' ? body.axieId.trim() : ''
  if (!isCostumeId(axieId)) {
    sendJson(res, 400, { error: 'axieId must be free-cast or numeric' })
    return
  }

  const deviceKey = deviceKeyFrom(req, body) || address
  const rate = checkRate(deviceKey, 'follows')
  if (!rate.ok) {
    sendJson(res, 429, {
      error: `Follow rate limit: max ${rate.limit}/hour`,
      limit: rate.limit,
      count: rate.count,
    })
    return
  }

  const store = loadFollows()
  if (!Array.isArray(store.byAddress[address])) store.byAddress[address] = []
  const list = store.byAddress[address]
  const idx = list.indexOf(axieId)
  const wasFollowing = idx !== -1
  let following = false

  if (mode === 'unfollow') {
    if (idx !== -1) list.splice(idx, 1)
    following = false
  } else if (mode === 'toggle') {
    if (idx === -1) {
      list.push(axieId)
      following = true
    } else {
      list.splice(idx, 1)
      following = false
    }
  } else {
    // follow
    if (idx === -1) list.push(axieId)
    following = true
  }

  // Cap follows per address
  if (list.length > 200) list.length = 200
  saveFollows(store)
  recordRate(deviceKey, 'follows')

  // Owner celebration: someone followed one of their owned Axies
  if (following && !wasFollowing && /^\d+$/.test(axieId)) {
    const fromLabel =
      ownerNameFor(address) || shortOwnerAddress(address) || 'Fan'
    pushFollowNotif(axieId, fromLabel, address)
  }

  let castCrew = null
  if (following && !wasFollowing) {
    const actorKey = castCrewPosterKey({ address, deviceKey })
    if (actorKey) {
      castCrew = bumpQuestStats(actorKey, (stats) => {
        stats.followsGiven = Math.max(0, Math.floor(Number(stats.followsGiven) || 0)) + 1
      })
    }
    // Human follows on non-cast (owned) Axies count for the owner's received follows
    if (!FREE_CAST_IDS.has(axieId)) {
      const ownerKey = ownerPosterKeyForFollowedAxie(axieId) || (
        // Prefer explicit owner from posts; fall back to address-owned numeric via owners map absent
        ''
      )
      if (ownerKey && ownerKey !== actorKey) {
        const recvPayload = bumpQuestStats(ownerKey, (stats) => {
          stats.followsReceivedHuman =
            Math.max(0, Math.floor(Number(stats.followsReceivedHuman) || 0)) + 1
        })
        if (!castCrew) castCrew = recvPayload
      }
    }
  }

  const followPayload = {
    address,
    axieId,
    following,
    follows: [...list],
    followerCount: followerCountFor(axieId),
  }
  if (castCrew) followPayload.castCrew = castCrew
  sendJson(res, 200, followPayload)
}

function handleGetFollows(_req, res, url) {
  const address = normalizeAddress(url.searchParams.get('address') || '')
  if (!address) {
    sendJson(res, 401, { error: 'Valid address required' })
    return
  }
  const follows = followsFor(address)
  const counts = followerCountMap(follows)
  sendJson(res, 200, { address, follows, counts })
}

function handleFollowerCount(_req, res, url) {
  const axieId = String(url.searchParams.get('axieId') || '').trim()
  if (!isCostumeId(axieId)) {
    sendJson(res, 400, { error: 'axieId must be free-cast or numeric' })
    return
  }
  sendJson(res, 200, { axieId, followerCount: followerCountFor(axieId) })
}

function handleGetNotifications(_req, res, url) {
  const address = normalizeAddress(url.searchParams.get('address') || '')
  if (!address) {
    sendJson(res, 401, { error: 'Valid address required' })
    return
  }
  const store = loadNotifs()
  const list = Array.isArray(store.byAddress[address]) ? store.byAddress[address] : []
  const unread = list.filter((n) => !n.read).length
  sendJson(res, 200, {
    address,
    unread,
    notifications: list.slice(0, 50).map((n) => ({
      id: n.id,
      createdAt: n.createdAt,
      type: n.type,
      postId: n.postId || '',
      axieId: n.axieId,
      axieLabel: n.axieLabel,
      fromLabel: n.fromLabel,
      fromAddress: n.fromAddress || '',
      text: n.text || '',
      read: Boolean(n.read),
      preview: FREE_CAST_IDS.has(String(n.axieId || ''))
        ? FREE_CAST.find((c) => c.id === n.axieId)?.preview || `/previews/${n.axieId}.png`
        : n.axieId
          ? `/api/image/${n.axieId}`
          : '',
    })),
  })
}

async function handleReadNotifications(req, res) {
  let body
  try {
    const raw = await readBody(req, 64 * 1024)
    body = JSON.parse(raw.toString('utf8') || '{}')
  } catch (err) {
    const status = err?.statusCode || 400
    sendJson(res, status, { error: status === 413 ? 'Body too large' : 'Invalid JSON' })
    return
  }
  const address = normalizeAddress(
    typeof body.address === 'string' ? body.address : '',
  )
  if (!address) {
    sendJson(res, 401, { error: 'Valid address required' })
    return
  }
  const store = loadNotifs()
  const list = Array.isArray(store.byAddress[address]) ? store.byAddress[address] : []
  const ids = Array.isArray(body.ids) ? body.ids.map(String) : null
  let marked = 0
  for (const n of list) {
    if (ids && ids.length) {
      if (ids.includes(n.id) && !n.read) {
        n.read = true
        marked++
      }
    } else if (!n.read) {
      n.read = true
      marked++
    }
  }
  store.byAddress[address] = list
  saveNotifs(store)
  const unread = list.filter((n) => !n.read).length
  sendJson(res, 200, { address, marked, unread })
}

function handleProfile(_req, res, url) {
  const address = normalizeAddress(url.searchParams.get('address') || '')
  if (!address) {
    sendJson(res, 401, { error: 'Valid address required' })
    return
  }
  const store = loadStore()
  const dayKey = manilaDayKey()
  const bucket = todayBucket(store, dayKey)
  const ownedIds = new Set()
  const labelById = {}
  for (const p of store.posts) {
    if (normalizeAddress(p.ownerAddress || '') !== address) continue
    const id = String(p.axieId)
    ownedIds.add(id)
    if (p.axieLabel) labelById[id] = p.axieLabel
  }
  let todayPoints = 0
  const myBoard = []
  for (const id of ownedIds) {
    const points = Number(bucket[id] || 0) || 0
    todayPoints += points
    myBoard.push({
      axieId: id,
      label: labelById[id] || (FREE_CAST_IDS.has(id) ? id : `Axie #${id}`),
      points,
      preview: FREE_CAST_IDS.has(id)
        ? `/previews/${id}.png`
        : `/api/image/${id}`,
      followerCount: followerCountFor(id),
    })
  }
  myBoard.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    return String(a.label).localeCompare(String(b.label))
  })
  myBoard.forEach((row, i) => {
    row.rank = i + 1
  })

  const notifs = loadNotifs()
  const nlist = Array.isArray(notifs.byAddress[address]) ? notifs.byAddress[address] : []
  const unread = nlist.filter((n) => !n.read).length
  const follows = followsFor(address)

  const castCrew = getCastCrewForKey(address)
  const questLevel = Math.max(0, Math.min(24, Math.floor(Number(castCrew.level) || 0)))

  // Player ladder snippet: own quest level on the all-time board (not Axie Idol Points)
  const allRankings = buildQuestLevelBoard('all', dayKey)
  const mine = allRankings.find((r) => r.posterKey === address || r.address === address)
  const myBoardQuest = mine
    ? [
        {
          posterKey: mine.posterKey,
          address: mine.address,
          label: mine.label,
          level: mine.level,
          points: mine.level,
          rank: mine.rank,
          preview: mine.preview,
          axieId: mine.axieId,
          previewCastId: mine.previewCastId,
          followerCount: mine.followerCount,
          nextQuest: mine.nextQuest,
        },
      ]
    : questLevel > 0 || (castCrew.stats && castCrew.stats.posts > 0)
      ? [
          {
            posterKey: address,
            address,
            label: ownerDisplayNameFor(address),
            level: questLevel,
            points: questLevel,
            rank: null,
            preview: castPreviewForId(highestUnlockedCastId({ unlockedCast: castCrew.unlockedCast || ['kotaro'] })),
            axieId: highestUnlockedCastId({ unlockedCast: castCrew.unlockedCast || ['kotaro'] }),
            previewCastId: highestUnlockedCastId({ unlockedCast: castCrew.unlockedCast || ['kotaro'] }),
            followerCount: castCrew.crewFollowerCount,
            nextQuest: castCrew.nextQuest
              ? {
                  level: castCrew.nextQuest.level,
                  description: castCrew.nextQuest.description,
                  progress: castCrew.nextQuest.progress,
                  target: castCrew.nextQuest.target,
                  unlockLabel: castCrew.nextQuest.unlockLabel,
                }
              : null,
          },
        ]
      : []

  sendJson(res, 200, {
    address,
    dayKey,
    timezone: 'Asia/Manila',
    todayPoints,
    level: questLevel,
    follows,
    unread,
    myBoard: myBoardQuest,
    // Legacy axie-point rows kept under legacyMyBoard for debugging only
    legacyMyBoard: myBoard,
    burns: burnsTodayPayload(store),
    castCrew,
    crewFollowerCount: castCrew.crewFollowerCount,
  })
}

async function handleCreatePost(req, res) {
  let body
  try {
    const raw = await readBody(req)
    body = JSON.parse(raw.toString('utf8') || '{}')
  } catch (err) {
    const status = err?.statusCode || 400
    sendJson(res, status, { error: status === 413 ? 'Body too large' : 'Invalid JSON' })
    return
  }

  const deviceKey = deviceKeyFrom(req, body)
  if (!deviceKey) {
    sendJson(res, 400, { error: 'Missing X-Device-Key' })
    return
  }

  const rate = checkRate(deviceKey, 'posts')
  if (!rate.ok) {
    sendJson(res, 429, {
      error: `Post rate limit: max ${rate.limit}/hour`,
      limit: rate.limit,
      count: rate.count,
    })
    return
  }

  const axieId = typeof body.axieId === 'string' ? body.axieId.trim() : ''
  let axieLabel =
    typeof body.axieLabel === 'string' && body.axieLabel.trim()
      ? body.axieLabel.trim().slice(0, 96)
      : FREE_CAST.find((c) => c.id === axieId)?.label || axieId
  const caption =
    typeof body.caption === 'string' ? body.caption.trim().slice(0, 140) : ''
  const authorGuestId =
    typeof body.authorGuestId === 'string' ? body.authorGuestId.trim().slice(0, 64) : ''
  let authorLabel =
    typeof body.authorLabel === 'string' ? body.authorLabel.trim().slice(0, 96) : ''
  const ownerAddress = normalizeAddress(
    typeof body.ownerAddress === 'string' ? body.ownerAddress : '',
  )

  const isFreeCast = FREE_CAST_IDS.has(axieId)
  const isOwnedNumeric = ID_RE.test(axieId)

  if (!axieId || (!isFreeCast && !isOwnedNumeric)) {
    sendJson(res, 400, {
      error: 'axieId must be a free-cast id or owned numeric Axie id',
    })
    return
  }

  // Quest gate: free-cast faces must be unlocked (Kotaro always).
  const earlyPosterKey = castCrewPosterKey({
    ownerAddress: normalizeAddress(typeof body.ownerAddress === 'string' ? body.ownerAddress : ''),
    address: typeof body.address === 'string' ? body.address : '',
    authorGuestId: typeof body.authorGuestId === 'string' ? body.authorGuestId.trim().slice(0, 64) : '',
    deviceKey,
  })
  if (isFreeCast && axieId !== 'kotaro') {
    const crew = getCastCrewForKey(earlyPosterKey)
    if (!(crew.unlockedCast || []).includes(axieId)) {
      sendJson(res, 403, { error: `Cast "${axieId}" is locked — complete quests to unlock` })
      return
    }
  }

  let ownerAddressSaved = ''
  if (!isFreeCast) {
    // Owned Axie post — require ownerAddress and verify on-chain ownership
    if (!ownerAddress) {
      sendJson(res, 403, { error: 'ownerAddress required for owned Axie posts' })
      return
    }
    let chain
    try {
      chain = await fetchAxieOwnership(axieId)
    } catch (err) {
      console.warn('[server] ownership check failed', err)
      sendJson(res, 502, {
        error: err instanceof Error ? err.message : 'Ownership check failed',
      })
      return
    }
    const allowedWallets = new Set(walletSetFor(ownerAddress))
    if (!chain || !chain.owner || !allowedWallets.has(chain.owner)) {
      sendJson(res, 403, { error: 'Not the owner of this Axie' })
      return
    }
    ownerAddressSaved = ownerAddress
    // Prefer chain name #id for authorLabel / axieLabel
    const chainLabel = axieLabelFrom(chain.name, chain.id)
    axieLabel = chain.name.slice(0, 96)
    authorLabel = chainLabel.slice(0, 96)
  }

  if (!authorGuestId) {
    sendJson(res, 400, { error: 'authorGuestId required' })
    return
  }
  if (!authorLabel) {
    const short = authorGuestId.replace(/-/g, '').slice(0, 4).toUpperCase()
    authorLabel = `Guest-${short}`
  }

  const parsed = parseDataUrl(body.imageBase64)
  if (!parsed || !parsed.buf.length) {
    sendJson(res, 400, { error: 'imageBase64 required (PNG/JPEG data URL or raw base64)' })
    return
  }
  if (parsed.buf.length > MAX_IMAGE_BYTES) {
    sendJson(res, 413, { error: 'Image too large (max 6MB)' })
    return
  }

  const id = randomUUID()
  const filename = `${id}${parsed.ext}`
  await blobs.put(filename, parsed.buf, parsed.mime)
  const imagePath = `/uploads/${filename}`

  const shiny = Array.isArray(body.shiny)
    ? [...new Set(body.shiny.filter((x) => typeof x === 'string' && isCostumeId(x)).slice(0, MAX_SHINY))]
    : []
  const golden = Math.random() * GOLDEN_ODDS < 1

  const post = {
    id,
    createdAt: Date.now(),
    axieId,
    axieLabel,
    caption,
    authorGuestId,
    authorLabel,
    ownerAddress: ownerAddressSaved || undefined,
    imagePath,
    likes: 0,
    likedByDevice: [],
    comments: [],
  }
  if (shiny.length) post.shiny = shiny
  if (golden) post.golden = true

  const store = loadStore()
  store.posts.unshift(post)
  // Cap store size
  if (store.posts.length > 500) store.posts.length = 500
  // Idol board scores are free-cast only
  if (isFreeCast && !store.axieScores[axieId]) store.axieScores[axieId] = 0

  const posterAddress =
    typeof body.address === 'string' ? body.address : ''
  const posterKey = castCrewPosterKey({
    ownerAddress: ownerAddressSaved,
    address: posterAddress,
    authorGuestId,
    deviceKey,
  })
  let castCrew = applyCastCrewOnPost(store, post, posterKey)
  if (golden) {
    const granted = grantCast(posterKey, GOLDEN_ID)
    if (granted) castCrew = { ...granted, engagement: castCrew?.engagement || [] }
  }

  saveStore(store)
  recordRate(deviceKey, 'posts')

  // Instant spark burn: owned numeric posts only (free-cast never).
  let sparkBurn = null
  if (ownerAddressSaved && isOwnedNumeric) {
    sparkBurn = tryAwardSpark(ownerAddressSaved, axieId)
  }

  const payload = {
    post: publicPost(post),
    ...scoresPayload(store),
    burns: burnsTodayPayload(store),
    castCrew,
  }
  if (sparkBurn) payload.sparkBurn = sparkBurn
  if (golden) payload.goldenFound = true
  payload.golden = goldenSummary(store)
  sendJson(res, 201, payload)
}

async function handleLike(req, res, postId) {
  let body
  try {
    const raw = await readBody(req, 64 * 1024)
    body = JSON.parse(raw.toString('utf8') || '{}')
  } catch (err) {
    const status = err?.statusCode || 400
    sendJson(res, status, { error: status === 413 ? 'Body too large' : 'Invalid JSON' })
    return
  }

  const deviceKey = deviceKeyFrom(req, body)
  if (!deviceKey) {
    sendJson(res, 400, { error: 'Missing deviceKey' })
    return
  }

  const unlike = Boolean(body.unlike)
  if (!unlike) {
    const rate = checkRate(deviceKey, 'likes')
    if (!rate.ok) {
      sendJson(res, 429, {
        error: `Like rate limit: max ${rate.limit}/hour`,
        limit: rate.limit,
        count: rate.count,
      })
      return
    }
  }

  const store = loadStore()
  const post = store.posts.find((p) => p.id === postId)
  if (!post) {
    sendJson(res, 404, { error: 'Post not found' })
    return
  }
  if (!Array.isArray(post.likedByDevice)) post.likedByDevice = []

  const idx = post.likedByDevice.indexOf(deviceKey)
  if (unlike) {
    if (idx === -1) {
      sendJson(res, 200, { post: publicPost(post), liked: false, ...scoresPayload(store) })
      return
    }
    post.likedByDevice.splice(idx, 1)
    post.likes = Math.max(0, (post.likes || 0) - 1)
    bumpIdolPoints(store, post.axieId, -1)
  } else {
    if (idx !== -1) {
      sendJson(res, 200, { post: publicPost(post), liked: true, ...scoresPayload(store) })
      return
    }
    post.likedByDevice.push(deviceKey)
    post.likes = (post.likes || 0) + 1
    bumpIdolPoints(store, post.axieId, 1)
    recordRate(deviceKey, 'likes')
    const fromLabel =
      typeof body.authorLabel === 'string' && body.authorLabel.trim()
        ? body.authorLabel.trim().slice(0, 96)
        : 'Fan'
    pushOwnerNotif(post, 'like', fromLabel)
  }

  let castCrew = null
  if (!unlike) {
    const actorKey = castCrewPosterKey({
      address: typeof body.address === 'string' ? body.address : '',
      authorGuestId: typeof body.authorGuestId === 'string' ? body.authorGuestId : '',
      deviceKey,
    })
    const npc = isCastNpcActor({ deviceKey, authorGuestId: body.authorGuestId, cast: body.cast })
    if (!npc && actorKey) {
      castCrew = bumpQuestStats(actorKey, (stats) => {
        stats.likesGiven = Math.max(0, Math.floor(Number(stats.likesGiven) || 0)) + 1
      })
    }
    if (!npc) {
      const recvKey = posterKeyFromPost(post)
      if (recvKey && recvKey !== actorKey) {
        const recvPayload = bumpQuestStats(recvKey, (stats) => {
          stats.likesReceivedHuman =
            Math.max(0, Math.floor(Number(stats.likesReceivedHuman) || 0)) + 1
        })
        if (!castCrew) castCrew = recvPayload
      }
    }
  }

  saveStore(store)
  const likePayload = {
    post: publicPost(post),
    liked: !unlike,
    ...scoresPayload(store),
    burns: burnsTodayPayload(store),
  }
  if (castCrew) likePayload.castCrew = castCrew
  sendJson(res, 200, likePayload)
}

function publicPost(p) {
  const out = {
    id: p.id,
    createdAt: p.createdAt,
    axieId: p.axieId,
    axieLabel: p.axieLabel,
    caption: p.caption || '',
    authorGuestId: p.authorGuestId,
    authorLabel: p.authorLabel,
    imagePath: p.imagePath,
    likes: p.likes || 0,
    comments: publicComments(p.comments),
  }
  if (p.seed) out.seed = true
  if (p.golden) out.golden = true
  if (Array.isArray(p.shiny) && p.shiny.length) out.shiny = [...p.shiny]
  if (p.castAuthor || (typeof p.authorGuestId === 'string' && p.authorGuestId.startsWith('cast:'))) {
    out.castAuthor = true
    const cid = p.castId || String(p.authorGuestId || '').replace(/^cast:/, '')
    if (FREE_CAST_IDS.has(cid)) out.castId = cid
  }
  const ownerAddr = normalizeAddress(p.ownerAddress || '')
  if (ownerAddr) {
    out.ownerAddress = ownerAddr
    const n = ownerNameFor(ownerAddr)
    if (n) {
      out.ownerName = n
      out.ownerDisplayName = n
    } else {
      out.ownerDisplayName = shortOwnerAddress(ownerAddr)
    }
  }
  return out
}

async function handleOwnerSync(req, res) {
  let body
  try {
    const raw = await readBody(req, 64 * 1024)
    body = JSON.parse(raw.toString('utf8') || '{}')
  } catch (err) {
    const status = err?.statusCode || 400
    sendJson(res, status, {
      error: status === 413 ? 'Body too large' : 'Invalid JSON',
      name: '',
    })
    return
  }
  const address = normalizeAddress(typeof body.address === 'string' ? body.address : '')
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (!address || !token) {
    sendJson(res, 400, { error: 'address and token required', name: '' })
    return
  }
  let profile
  try {
    profile = await fetchWaypointProfile(token)
  } catch (err) {
    console.warn('[server] waypoint get-profile failed', err?.message || err)
    sendJson(res, 502, { address, name: '', displayName: shortOwnerAddress(address) })
    return
  }
  if (!profile || profile.status !== 200 || !profile.json || typeof profile.json !== 'object') {
    sendJson(res, 502, { address, name: '', displayName: shortOwnerAddress(address) })
    return
  }
  const json = profile.json
  const identity = normalizeAddress(json.wallet?.identity || json.wallet?.Identity || '')
  const secondary = normalizeAddress(json.wallet?.secondary || json.wallet?.Secondary || '')
  if (identity || secondary) {
    if (address !== identity && address !== secondary) {
      sendJson(res, 400, {
        error: 'Address does not match Waypoint wallet',
        name: '',
      })
      return
    }
  }
  const name = sanitizeOwnerName(json.name)
  const defaultWallet = parseWalletDefault(
    json.wallet?.default ?? json.wallet?.Default,
    identity,
    secondary,
  )
  const now = Date.now()
  const owners = loadOwners()
  const prev = owners[address] && typeof owners[address] === 'object' ? owners[address] : {}
  const record = {
    ...prev,
    updatedAt: now,
  }
  if (name) record.name = name
  else if (!record.name && prev.name) record.name = sanitizeOwnerName(prev.name)
  if (identity) record.identity = identity
  if (secondary) record.secondary = secondary
  if (defaultWallet) record.default = defaultWallet
  owners[address] = record

  // Mirror under the other wallet address key(s) so lookups work either way
  const mirrorKeys = [...new Set([identity, secondary].filter((x) => x && x !== address))]
  for (const other of mirrorKeys) {
    const prevOther = owners[other] && typeof owners[other] === 'object' ? owners[other] : {}
    owners[other] = {
      ...prevOther,
      name: record.name || sanitizeOwnerName(prevOther.name) || undefined,
      identity: identity || prevOther.identity || undefined,
      secondary: secondary || prevOther.secondary || undefined,
      default: defaultWallet || prevOther.default || undefined,
      updatedAt: now,
    }
    if (!owners[other].name) delete owners[other].name
    if (!owners[other].identity) delete owners[other].identity
    if (!owners[other].secondary) delete owners[other].secondary
    if (!owners[other].default) delete owners[other].default
  }
  saveOwners(owners)

  const savedName = sanitizeOwnerName(record.name) || ''
  const inventoryAddresses = [
    ...new Set([address, identity, secondary].filter(Boolean)),
  ]
  sendJson(res, 200, {
    address,
    name: savedName,
    displayName: savedName || shortOwnerAddress(address),
    identity: identity || '',
    secondary: secondary || '',
    inventoryAddresses,
  })
}

function handleOwnerGet(_req, res, url) {
  const address = normalizeAddress(url.searchParams.get('address') || '')
  if (!address) {
    sendJson(res, 400, { error: 'Valid address required' })
    return
  }
  const store = loadStore()
  const bucket = todayBucket(store)
  const name = ownerNameFor(address)
  const displayName = name || shortOwnerAddress(address)
  const byId = new Map()
  for (const p of store.posts) {
    if (normalizeAddress(p.ownerAddress || '') !== address) continue
    const id = String(p.axieId || '')
    if (!ID_RE.test(id)) continue
    const prev = byId.get(id)
    if (!prev || (p.createdAt || 0) > prev.createdAt) {
      byId.set(id, {
        id,
        label: p.axieLabel || `Axie #${id}`,
        createdAt: p.createdAt || 0,
      })
    }
  }
  const axies = [...byId.values()].map((a) => ({
    id: a.id,
    label: a.label,
    followerCount: followerCountFor(a.id),
    todayPoints: Number(bucket[a.id] || 0) || 0,
    preview: `/api/image/${a.id}`,
  }))
  const houseBoard = axies
    .map((a) => ({
      axieId: a.id,
      label: a.label,
      points: a.todayPoints,
      preview: a.preview,
      followerCount: a.followerCount,
    }))
    .sort((x, y) => {
      if (y.points !== x.points) return y.points - x.points
      return String(x.label).localeCompare(String(y.label))
    })
    .map((row, i) => ({ ...row, rank: i + 1 }))
  let todayPoints = 0
  for (const a of axies) todayPoints += a.todayPoints
  const castCrew = getCastCrewForKey(address)
  const questLevel = Math.max(0, Math.min(24, Math.floor(Number(castCrew.level) || 0)))
  const dayKey = manilaDayKey()
  const allRankings = buildQuestLevelBoard('all', dayKey)
  const mine = allRankings.find((r) => r.posterKey === address || r.address === address)
  const houseBoardQuest = mine
    ? [
        {
          posterKey: mine.posterKey,
          address: mine.address,
          label: mine.label,
          level: mine.level,
          points: mine.level,
          rank: mine.rank,
          preview: mine.preview,
          axieId: mine.axieId,
          previewCastId: mine.previewCastId,
          followerCount: mine.followerCount,
          nextQuest: mine.nextQuest,
        },
      ]
    : []

  sendJson(res, 200, {
    address,
    name,
    displayName,
    axies,
    houseBoard: houseBoardQuest.length ? houseBoardQuest : houseBoard,
    legacyHouseBoard: houseBoard,
    todayPoints,
    level: questLevel,
    castCrew,
  })
}

async function handleComment(req, res, postId) {
  let body
  try {
    const raw = await readBody(req, 64 * 1024)
    body = JSON.parse(raw.toString('utf8') || '{}')
  } catch (err) {
    const status = err?.statusCode || 400
    sendJson(res, status, { error: status === 413 ? 'Body too large' : 'Invalid JSON' })
    return
  }

  const deviceKey = deviceKeyFrom(req, body)
  if (!deviceKey) {
    sendJson(res, 400, { error: 'Missing X-Device-Key' })
    return
  }

  const rate = checkRate(deviceKey, 'comments')
  if (!rate.ok) {
    sendJson(res, 429, {
      error: `Comment rate limit: max ${rate.limit}/hour`,
      limit: rate.limit,
      count: rate.count,
    })
    return
  }

  const text =
    typeof body.text === 'string' ? body.text.trim().slice(0, MAX_COMMENT_LENGTH) : ''
  if (!text) {
    sendJson(res, 400, { error: 'Comment text required (max 140 chars)' })
    return
  }

  const authorGuestId =
    typeof body.authorGuestId === 'string' ? body.authorGuestId.trim().slice(0, 64) : ''
  let authorLabel =
    typeof body.authorLabel === 'string' ? body.authorLabel.trim().slice(0, 32) : ''
  if (!authorGuestId) {
    sendJson(res, 400, { error: 'authorGuestId required' })
    return
  }
  if (!authorLabel) {
    const short = authorGuestId.replace(/-/g, '').slice(0, 4).toUpperCase()
    authorLabel = `Guest-${short}`
  }

  const store = loadStore()
  const post = store.posts.find((p) => p.id === postId)
  if (!post) {
    sendJson(res, 404, { error: 'Post not found' })
    return
  }
  if (!Array.isArray(post.comments)) post.comments = []

  const comment = {
    id: randomUUID(),
    createdAt: Date.now(),
    authorGuestId,
    authorLabel,
    text,
  }
  post.comments.push(comment)

  bumpIdolPoints(store, post.axieId, 3)
  pushOwnerNotif(post, 'comment', authorLabel, { text })

  const actorKey = castCrewPosterKey({
    address: typeof body.address === 'string' ? body.address : '',
    authorGuestId,
    deviceKey,
  })
  const npc = isCastNpcActor({ deviceKey, authorGuestId, cast: body.cast, castId: body.castId })
  let castCrew = null
  if (!npc && actorKey) {
    castCrew = bumpQuestStats(actorKey, (stats) => {
      stats.commentsGiven = Math.max(0, Math.floor(Number(stats.commentsGiven) || 0)) + 1
    })
  }
  if (!npc) {
    const recvKey = posterKeyFromPost(post)
    if (recvKey && recvKey !== actorKey) {
      const recvPayload = bumpQuestStats(recvKey, (stats) => {
        stats.commentsReceivedHuman =
          Math.max(0, Math.floor(Number(stats.commentsReceivedHuman) || 0)) + 1
      })
      if (!castCrew) castCrew = recvPayload
    }
  }

  saveStore(store)
  recordRate(deviceKey, 'comments')

  const commentPayload = {
    comment: {
      id: comment.id,
      createdAt: comment.createdAt,
      authorGuestId: comment.authorGuestId,
      authorLabel: comment.authorLabel,
      text: comment.text,
    },
    post: publicPost(post),
    ...scoresPayload(store),
    burns: burnsTodayPayload(store),
  }
  if (castCrew) commentPayload.castCrew = castCrew
  sendJson(res, 201, commentPayload)
}

function handleBurnsToday(_req, res) {
  const store = loadStore()
  sendJson(res, 200, burnsTodayPayload(store))
}

async function handleBurnBoost(req, res) {
  let body
  try {
    const raw = await readBody(req, 64 * 1024)
    body = JSON.parse(raw.toString('utf8') || '{}')
  } catch (err) {
    const status = err?.statusCode || 400
    sendJson(res, status, { error: status === 413 ? 'Body too large' : 'Invalid JSON' })
    return
  }

  const address = normalizeAddress(typeof body.address === 'string' ? body.address : '')
  if (!address) {
    sendJson(res, 401, { error: 'Valid address required to boost (Connect Ronin)' })
    return
  }

  const axieId = typeof body.axieId === 'string' ? body.axieId.trim() : String(body.axieId || '').trim()
  if (!ID_RE.test(axieId)) {
    sendJson(res, 400, { error: 'axieId must be a numeric Axie id' })
    return
  }

  const amount = Math.floor(Number(body.amount))
  if (!Number.isFinite(amount) || amount < FAN_BOOST_MIN || amount > FAN_BOOST_MAX) {
    sendJson(res, 400, {
      error: `amount must be an integer ${FAN_BOOST_MIN}–${FAN_BOOST_MAX}`,
      min: FAN_BOOST_MIN,
      max: FAN_BOOST_MAX,
    })
    return
  }

  const rateKey = `boost:${address}`
  const rate = checkRate(rateKey, 'boosts')
  if (!rate.ok) {
    sendJson(res, 429, {
      error: `Fan boost rate limit: max ${rate.limit}/hour`,
      limit: rate.limit,
      count: rate.count,
    })
    return
  }

  const burns = loadBurns()
  const dayKey = manilaDayKey()
  const rec = appendBurnRecord(burns, {
    dayKey,
    axieId,
    amount,
    kind: 'fan',
    funder: address,
  })
  if (burns.records.length > 5000) burns.records = burns.records.slice(-4000)
  saveBurns(burns)
  recordRate(rateKey, 'boosts')

  const store = loadStore()
  sendJson(res, 201, {
    ok: true,
    mode: BURN_MODE,
    modeLabel: 'Demo burn (ledger)',
    burn: {
      id: rec.id,
      dayKey: rec.dayKey,
      axieId: rec.axieId,
      amount: rec.amount,
      kind: rec.kind,
      funder: rec.funder,
      status: rec.status,
      txHash: rec.txHash,
      createdAt: rec.createdAt,
    },
    burns: burnsTodayPayload(store),
  })
}

async function handleSettleDay(req, res) {
  let body = {}
  try {
    if (req.method === 'POST') {
      const raw = await readBody(req, 64 * 1024)
      if (raw && raw.length) body = JSON.parse(raw.toString('utf8') || '{}')
    }
  } catch (err) {
    const status = err?.statusCode || 400
    sendJson(res, status, { error: status === 413 ? 'Body too large' : 'Invalid JSON' })
    return
  }
  const store = loadStore()
  const today = manilaDayKey()
  let dayKey =
    typeof body.dayKey === 'string' && body.dayKey.trim()
      ? body.dayKey.trim()
      : prevManilaDayKey(today)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    sendJson(res, 400, { error: 'dayKey must be YYYY-MM-DD' })
    return
  }
  // Force settle a specific past day (or auto-settle all past)
  if (body.all) {
    const results = autoSettlePastDays(store)
    sendJson(res, 200, { results, burns: burnsTodayPayload(store) })
    return
  }
  if (dayKey >= today) {
    sendJson(res, 400, { error: 'Cannot settle current/future Manila day', dayKey, today })
    return
  }
  const result = settleCrownForDay(dayKey, store)
  sendJson(res, 200, { result, burns: burnsTodayPayload(store) })
}

async function handleApi(req) {
  const url = req.url
  if (!url.pathname.startsWith('/api/')) return null
  const res = new ResponseShim()
  const route = async () => {
    const genesMatch = /^\/api\/axie\/([^/]+)$/.exec(url.pathname)
    if (genesMatch && req.method === 'GET') {
      await handleAxieGenes(req, res, decodeURIComponent(genesMatch[1]))
      return
    }
    if (url.pathname.startsWith('/api/metadata/')) {
      let id = url.pathname.slice('/api/metadata/'.length)
      if (id.endsWith('/')) id = id.slice(0, -1)
      await proxyMetadata(id, res)
      return
    }
    if (url.pathname.startsWith('/api/image/')) {
      let id = url.pathname.slice('/api/image/'.length)
      if (id.endsWith('/')) id = id.slice(0, -1)
      await proxyImage(id, res)
      return
    }

    if (url.pathname === '/api/cast' && req.method === 'GET') {
      sendJson(res, 200, { cast: FREE_CAST })
      return
    }

    if ((url.pathname === '/api/cast-crew' || url.pathname === '/api/quests') && req.method === 'GET') {
      const address = normalizeAddress(url.searchParams.get('address') || '')
      const guestId = (url.searchParams.get('guestId') || '').trim().slice(0, 64)
      const deviceKey = (url.searchParams.get('deviceKey') || '').trim().slice(0, 128)
      const key = castCrewPosterKey({
        address,
        authorGuestId: guestId,
        deviceKey,
      })
      if (!key) {
        sendJson(res, 400, { error: 'address, guestId, or deviceKey required' })
        return
      }
      sendJson(res, 200, { posterKey: key, ...getCastCrewForKey(key) })
      return
    }

    if (url.pathname === '/api/inventory' && req.method === 'GET') {
      await handleInventory(req, res, url)
      return
    }

    if (url.pathname === '/api/feed' && req.method === 'GET') {
      handleFeed(req, res, url)
      return
    }

    if (url.pathname === '/api/board' && req.method === 'GET') {
      handleBoard(req, res, url)
      return
    }

    if (url.pathname === '/api/follow' && req.method === 'POST') {
      await handleFollow(req, res, 'follow')
      return
    }
    if (url.pathname === '/api/unfollow' && req.method === 'POST') {
      await handleFollow(req, res, 'unfollow')
      return
    }
    if (url.pathname === '/api/follow' && req.method === 'DELETE') {
      await handleFollow(req, res, 'unfollow')
      return
    }
    if (url.pathname === '/api/follow/toggle' && req.method === 'POST') {
      await handleFollow(req, res, 'toggle')
      return
    }
    if (url.pathname === '/api/follows' && req.method === 'GET') {
      handleGetFollows(req, res, url)
      return
    }
    if (url.pathname === '/api/followers/count' && req.method === 'GET') {
      handleFollowerCount(req, res, url)
      return
    }
    if (url.pathname === '/api/notifications' && req.method === 'GET') {
      handleGetNotifications(req, res, url)
      return
    }
    if (url.pathname === '/api/notifications/read' && req.method === 'POST') {
      await handleReadNotifications(req, res)
      return
    }
    if (url.pathname === '/api/profile' && req.method === 'GET') {
      handleProfile(req, res, url)
      return
    }
    if (url.pathname === '/api/owner/sync' && req.method === 'POST') {
      await handleOwnerSync(req, res)
      return
    }
    if (url.pathname === '/api/owner' && req.method === 'GET') {
      handleOwnerGet(req, res, url)
      return
    }

    if (url.pathname === '/api/burns/today' && req.method === 'GET') {
      handleBurnsToday(req, res)
      return
    }
    if (url.pathname === '/api/burns/boost' && req.method === 'POST') {
      await handleBurnBoost(req, res)
      return
    }
    if (url.pathname === '/api/burns/settle-day' && req.method === 'POST') {
      await handleSettleDay(req, res)
      return
    }

    if (url.pathname === '/api/posts' && req.method === 'POST') {
      await handleCreatePost(req, res)
      return
    }

    const likeMatch = /^\/api\/posts\/([^/]+)\/like$/.exec(url.pathname)
    if (likeMatch && req.method === 'POST') {
      await handleLike(req, res, decodeURIComponent(likeMatch[1]))
      return
    }

    const commentMatch = /^\/api\/posts\/([^/]+)\/comments$/.exec(url.pathname)
    if (commentMatch && req.method === 'POST') {
      await handleComment(req, res, decodeURIComponent(commentMatch[1]))
      return
    }


  }
  try {
    await route()
  } catch (err) {
    log.error('[core]', err)
    if (!res.headersSent) {
      sendJson(res, 502, { error: err instanceof Error ? err.message : 'Proxy error' })
    }
  }
  if (!res.headersSent) sendJson(res, 404, { error: 'Not found' })
  return res.result()
}

  return { handleApi }
}
