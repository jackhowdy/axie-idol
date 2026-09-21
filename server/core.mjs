/**
 * Axie Idol API core — runtime-agnostic (Node host: ../server.mjs, Worker host: ../worker/).
 * Storage adapter: storage.get(name, makeEmpty) / storage.set(name, obj) for
 * 'posts' | 'castCrew' | 'follows' | 'notifications' | 'owners' | 'burns'.
 * Blob adapter: blobs.put(filename, bytes, mime); blobs are served by the host at /uploads/<filename>.
 * Generated from the original server.mjs on 2026-09-06; handler logic unchanged.
 */
import { Buffer } from 'node:buffer'
import { ResponseShim } from './shim.mjs'
import { createBuddyModule } from './buddy.mjs'
import { createDiagModule } from './diag.mjs'

const randomUUID = () => crypto.randomUUID()

export function createCore({ storage, blobs, env = {}, log = console }) {
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

/** 1-in-N chance that a post contains the Golden Axie. Set GOLDEN_ODDS=1 to force it (demo/tests). */
const GOLDEN_ODDS = Math.max(1, Math.floor(Number(env.GOLDEN_ODDS) || 5000))
const MAX_SHINY = 3
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
  // `level` marks a record fetched since the Axie Core facts were added; older ones are refreshed.
  if (hit && hit.genes && Array.isArray(hit.parts) && hit.level !== undefined && hit.stage !== undefined && hit.xp !== undefined) return hit
  let data
  try {
    data = await graphqlRequest(
      `query($axieId: ID!) {
        axie(axieId: $axieId) { id name class stage newGenes genes bodyShape birthDate breedCount axpInfo { level xp xpToLevelUp } parts { id name type class stage specialGenes } }
      }`,
      { axieId: String(axieId) },
    )
  } catch {
    // The Axie Core fields are a bonus: without them the Axie still loads and plays.
    data = await graphqlRequest(
      `query($axieId: ID!) {
        axie(axieId: $axieId) { id name class newGenes genes bodyShape parts { id name type stage specialGenes } }
      }`,
      { axieId: String(axieId) },
    )
  }
  const axie = data?.axie
  if (!axie || !axie.id) return null
  const rec = {
    id: String(axie.id),
    name: (axie.name && String(axie.name).trim()) || `Axie #${axie.id}`,
    class: axie.class || null,
    genes: axie.newGenes || axie.genes || '',
    bodyShape: axie.bodyShape || null,
    // Axie Core: how far it has been trained, when it was born, how often it has bred.
    level: Number.isFinite(Number(axie.axpInfo?.level)) ? Number(axie.axpInfo.level) : null,
    // how far along the current level it is, for a read-only progress bar
    xp: Number.isFinite(Number(axie.axpInfo?.xp)) ? Number(axie.axpInfo.xp) : null,
    xpToLevelUp: Number.isFinite(Number(axie.axpInfo?.xpToLevelUp)) ? Number(axie.axpInfo.xpToLevelUp) : null,
    // 4 is a grown Axie; eggs and petites have no real art to show
    stage: Number.isFinite(Number(axie.stage)) ? Number(axie.stage) : null,
    birthDate: Number(axie.birthDate) || null,
    breedCount: Number.isFinite(Number(axie.breedCount)) ? Number(axie.breedCount) : null,
    // Stage per part slot (1 or 2). The mixer's genes decoder always emits stage 1, so the client
    // needs this to pick stage-2 meshes (all Nightmare and Nightmare-shiny parts are stage 2).
    parts: Array.isArray(axie.parts)
      ? axie.parts.map((p) => ({
          type: String(p.type || '').toLowerCase(),
          stage: p.stage === 2 ? 2 : 1,
          name: p.name || null,
          class: p.class || null,
          specialGenes: p.specialGenes || null,
        }))
      : [],
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
/**
 * One-Axie loop: the legacy ceiling of 10 posts/hour is the same number as the daily bond cap,
 * so a player who takes eleven photos in an hour would be 429'd off their own camera. Buddy
 * snaps get a much higher ceiling; the ones past the daily cap simply earn no bond.
 */
const MAX_BUDDY_POSTS_PER_HOUR = 40
/** Fallback for the 'buddy' rate kind when the caller names no limit of its own. */
const MAX_BUDDY_ROUTES_PER_HOUR = 20
const MAX_LIKES_PER_HOUR = 60
const MAX_COMMENTS_PER_HOUR = 30
const MAX_FOLLOWS_PER_HOUR = 60
const MAX_COMMENTS_PER_POST = 50
const MAX_IMAGE_BYTES = 6 * 1024 * 1024
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

function emptyOwners() {
  return {}
}

function loadOwners() {
  const data = storage.get('owners', emptyOwners)
  if (!data || typeof data !== 'object' || Array.isArray(data)) return emptyOwners()
  return data
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
    b = { posts: [], likes: [], comments: [], follows: [], sparks: [], boosts: [], buddy: [] }
    rateBuckets.set(deviceKey, b)
  } else {
    if (!Array.isArray(b.comments)) b.comments = []
    if (!Array.isArray(b.follows)) b.follows = []
    if (!Array.isArray(b.sparks)) b.sparks = []
    if (!Array.isArray(b.boosts)) b.boosts = []
    if (!Array.isArray(b.buddy)) b.buddy = []
  }
  return b
}

function pruneHour(arr, now = Date.now()) {
  const cutoff = now - 60 * 60 * 1000
  while (arr.length && arr[0] < cutoff) arr.shift()
  return arr.length
}

function rateLimitFor(kind, opts = {}) {
  if (kind === 'posts') return opts.buddy ? MAX_BUDDY_POSTS_PER_HOUR : MAX_POSTS_PER_HOUR
  if (kind === 'comments') return MAX_COMMENTS_PER_HOUR
  if (kind === 'follows') return MAX_FOLLOWS_PER_HOUR
  if (kind === 'sparks') return MAX_SPARKS_PER_HOUR
  if (kind === 'boosts') return MAX_FAN_BOOSTS_PER_HOUR
  // The buddy module names its own ceiling per route (egg/retire 5, recovery 10, ronin 20) and
  // they share one bucket, so a device cannot walk around one limit by spending another.
  // Play routes (a pat, a game, meeting an Axie) each count on their own: `buddy:<route>`. Sharing
  // one bucket meant ten pats and shuffles used up the ten "pick an Axie" of the hour.
  if (kind === 'buddy' || String(kind).startsWith('buddy:')) return Number.isFinite(opts.limit) ? opts.limit : MAX_BUDDY_ROUTES_PER_HOUR
  return MAX_LIKES_PER_HOUR
}

function rateArr(bucket, kind) {
  if (kind === 'posts') return bucket.posts
  if (kind === 'comments') return bucket.comments
  if (kind === 'follows') return bucket.follows
  if (kind === 'sparks') return bucket.sparks
  if (kind === 'boosts') return bucket.boosts
  if (kind === 'buddy') return bucket.buddy
  if (String(kind).startsWith('buddy:')) { bucket.routes ||= {}; return (bucket.routes[kind] ||= []) }
  return bucket.likes
}

function checkRate(deviceKey, kind, opts = {}) {
  const limit = rateLimitFor(kind, opts)
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

  // `body.buddy` alone is a client claim: the 40/hour ceiling and the snap credit both belong to a
  // caller that actually has an active buddy to credit, not to anyone who sets the flag.
  const buddyOwnerKey = buddy.ownerKeyFrom(req, body)
  const isBuddyPost = body.buddy === true && Boolean(buddy.getActive(buddyOwnerKey))

  const rate = checkRate(deviceKey, 'posts', { buddy: isBuddyPost })
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
  let castCrew = body.buddy === true ? null : applyCastCrewOnPost(store, post, posterKey)
  if (golden) {
    const granted = grantCast(posterKey, GOLDEN_ID)
    if (granted) castCrew = { ...granted, engagement: castCrew?.engagement || [] }
  }

  // Buddy: convert this snap into egg/bond progress before the post is persisted, so
  // any buddyId stamped on the post is saved with it. Never gates on the quest system.
  const buddyResult = await buddy.recordSnap(post, {
    buddy: isBuddyPost,
    ownerKey: buddyOwnerKey,
    lat: typeof body.lat === 'number' ? body.lat : undefined,
    lng: typeof body.lng === 'number' ? body.lng : undefined,
    hour: typeof body.hour === 'number' ? body.hour : undefined,
    weather: typeof body.weather === 'string' ? body.weather.slice(0, 16) : undefined,
    placeType: typeof body.placeType === 'string' ? body.placeType.slice(0, 16) : undefined,
    placeName: typeof body.placeName === 'string' ? body.placeName.slice(0, 40) : undefined,
    district: typeof body.district === 'string' ? body.district.slice(0, 40) : undefined,
    labels: Array.isArray(body.labels) ? body.labels.slice(0, 12).map(String) : [],
    // the upload itself, so the Axie can look at what it is reacting to
    image: typeof body.imageBase64 === 'string' ? body.imageBase64 : null,
    // the look the client already drew onto this image (see /api/buddy/look)
    lookId: typeof body.lookId === 'string' ? body.lookId.slice(0, 64) : null,
    // the phone measured the capture as very dark (see darkness() in main.ts)
    dark: body.dark === true,
    // the caption, so a post that has to ask the model itself asks with the person's words
    caption: typeof body.caption === 'string' ? body.caption.slice(0, 140) : '',
  })
  if (buddyResult) post.buddyId = buddy.getActive(buddyOwnerKey)?.id || null

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
    buddy: buddyResult,
  }
  if (sparkBurn) payload.sparkBurn = sparkBurn
  if (golden) payload.goldenFound = true
  payload.golden = goldenSummary(store)
  sendJson(res, 201, payload)
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

/**
 * Take a post back out of the feed, with its upload. Used by the buddy module when the player
 * says they do not want a photo kept. The blob only goes if the host adapter knows how to
 * delete one — a host that does not simply leaves the file, which nothing links to any more.
 */
async function removePost(postId) {
  const store = loadStore()
  const i = store.posts.findIndex((p) => p.id === postId)
  if (i < 0) return false
  const [post] = store.posts.splice(i, 1)
  saveStore(store)
  const name = String(post.imagePath || '').replace(/^\/uploads\//, '')
  if (name && !/[/\\]|\.\./.test(name) && typeof blobs?.delete === 'function') {
    try {
      await blobs.delete(name)
    } catch (err) {
      log.warn?.('[core] upload delete failed', name, err?.message)
    }
  }
  return true
}

const buddy = createBuddyModule({
  storage, env,
  helpers: { sendJson, readBody, deviceKeyFrom, manilaDayKey, fetchAxieGenes, fetchAllOwnerAxies, normalizeAddress, checkRate, recordRate, removePost },
})

/** Not gated on BUDDY: the reports are about the 3D rig, which the camera uses either way. */
const diag = createDiagModule({
  storage, env,
  helpers: { sendJson, readBody, deviceKeyFrom, checkRate, recordRate },
})

async function handleApi(req) {
  const url = req.url
  if (!url.pathname.startsWith('/api/')) return null
  const res = new ResponseShim()
  const route = async () => {
    if (await diag.handle(req, res, url)) return
    if (await buddy.handle(req, res, url)) return

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
