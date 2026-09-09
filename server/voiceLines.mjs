// The written line library from docs/voice-bible.md. Lines are the floor; a model may add more later.
export const SITUATIONS = ['hatch', 'morning', 'wish', 'before', 'after', 'bedtime', 'return', 'big', 'moment', 'unlock', 'talk', 'talk-warm', 'talk-curious']

export const LINES = {
  Explorer: {
    hatch: ['I have HORNS. Where are we going first?'],
    morning: ['New day. New street? Pick one we haven\'t done.'],
    wish: ['Take me somewhere you\'ve never taken me.'],
    before: ['Further back. I want the whole bridge in it.', 'Get {thing} in it. What\'s past that?'],
    after: ['A ferry. Where does it go? Can we go where it goes?', 'There was {thing}. What\'s past {thing}?'],
    bedtime: ['Six new things today. I\'m going to dream all six.'],
    return: ['You\'re back. I made a list. It\'s long.'],
    big: ['I feel like I could see over the mountain now.'],
  },
  Homebody: {
    hatch: ['Hello. Is this our place? I like our place.'],
    morning: ['Our bench today? The bench misses us.'],
    wish: ['Take me back to the noodle shop. I want to check it\'s still there.'],
    before: ['Same spot as last time. Stand where you stood.'],
    after: ['The cat from Tuesday is back. See? Things come back.', 'There was {thing}. Our {thing}.'],
    bedtime: ['Home is the best place we went today.'],
    return: ['There you are. I kept your side warm.'],
    big: ['Something\'s different. But you\'re the same. Good.'],
  },
  Foodie: {
    hatch: ['I\'m hungry. Is that normal? What\'s that smell?'],
    morning: ['Breakfast first. Then whatever you were going to say.'],
    wish: ['Show me somewhere that smells like garlic.'],
    before: ['Get the noodles in the shot. Closer. CLOSER.', 'Get {thing} in it. Closer.'],
    after: ['Is that for me? Blink twice if that\'s for me.'],
    bedtime: ['I dreamed about the egg tart already. Twice.'],
    return: ['You came back. Did you bring anything? It\'s fine.'],
    big: ['I feel shiny. Shiny like a fresh bun.'],
  },
  Athlete: {
    hatch: ['Out! Finally. How far can we go before dark?'],
    morning: ['Legs. Let\'s use the legs. Yours, I mean.'],
    wish: ['Take me up something. Stairs count.'],
    before: ['Not here. Ten more steps, then here.'],
    after: ['That\'s the top? Good. What\'s the next top?'],
    bedtime: ['We went far. Further tomorrow.'],
    return: ['Two days on the sofa. I forgive you. Walk?'],
    big: ['My legs feel faster. Is that possible? Let\'s check.'],
  },
  Goofball: {
    hatch: ['Boo. Did I do it right? I\'ll do it again.'],
    morning: ['Today I will be extremely normal. No I won\'t.'],
    wish: ['Take a photo of me somewhere I definitely shouldn\'t be.'],
    before: ['Make the face. No, the OTHER face.'],
    after: ['That\'s the worst photo of me ever. Keep it forever.'],
    bedtime: ['I was very funny today. You laughed at least once. I heard it.'],
    return: ['I practised a new face while you were gone. Ready? No, wait.'],
    big: ['Ooh. Do I look important now? I feel important.'],
  },
  'Show-off': {
    hatch: ['Hello everyone. Oh, it\'s just you. That\'s fine.'],
    morning: ['Big crowd today? Take me where the people are.'],
    wish: ['Show me somewhere busy. I have a look ready.'],
    before: ['Wait. Chin up. NOW.'],
    after: ['Three people looked. I counted. Post it.'],
    bedtime: ['I was the best thing at the harbour today. Not bragging. Reporting.'],
    return: ['The fans were asking about me. Probably. Let\'s give them something.'],
    big: ['Oh this is a whole new look. Show someone. Show two people.'],
  },
  Shy: {
    hatch: ['Oh. Is it just us? Good.'],
    morning: ['Somewhere quiet today? If that\'s okay.'],
    wish: ['Take me somewhere with trees and not many people.'],
    before: ['Can I stand a bit behind you? Just a bit.'],
    after: ['There was a dog. I was brave. A little brave.', 'There was {thing}. I was a little brave.'],
    bedtime: ['Today was a lot. A good lot. Night.'],
    return: ['You\'re back. I didn\'t mind waiting. I minded a little.'],
    big: ['Is it okay that I feel a bit bigger today? I think it\'s okay.'],
  },
  Brave: {
    hatch: ['Right. Where\'s the tallest thing. We start there.'],
    morning: ['Wind today. Good. Let\'s stand in it.'],
    wish: ['Take me to the Peak. Or the rain. Both is fine.'],
    before: ['Closer to the edge. Trust me. Closer.'],
    after: ['That wave nearly got us. Nearly. Again?'],
    bedtime: ['Nothing scared me today. The bus was close, though.'],
    return: ['You were gone a while. Did something big happen? Take me to it.'],
    big: ['I feel like the storm would move for me now.'],
  },
  Dreamer: {
    hatch: ['The light in here is doing something. Look. Look at it.'],
    morning: ['What colour is the sky today? Don\'t tell me. Show me.'],
    wish: ['Take me somewhere the sky is big.'],
    before: ['Wait for the cloud to move. There. Now.'],
    after: ['That cloud is a whale. I\'m sure of it. Don\'t argue.'],
    bedtime: ['The window is orange. Then it\'ll be blue. Then us again.'],
    return: ['The sky did three things while you were gone. I\'ll tell you tomorrow.'],
    big: ['Something in me went bright. Like the water when the sun hits it.'],
  },
  Collector: {
    hatch: ['One. That\'s one hello. I\'m keeping it.'],
    morning: ['We\'re at six places. Seven would be a lot. Seven?'],
    wish: ['Take me somewhere with a number on the door. I collect those.'],
    before: ['Get the sign in. I need the sign for the list.'],
    after: ['Four dogs today. That\'s a record. I\'ll write it down.'],
    bedtime: ['Eleven photos. Nine good. Two very good, one with a dog.'],
    return: ['Two days. That\'s a gap. Gaps count too, I counted it.'],
    big: ['New thing for the list. Top of the list. I\'m moving everything down.'],
  },
}

export const TEMPLATES = {
  hatch: ['Hello. You\'re my person now. Where are we?'],
  morning: ['Day {count}. What\'s the plan?', 'It\'s {weather}. Good. Let\'s go anyway.'],
  wish: ['Take me to {place} today.'],
  before: ['Get {thing} in it. Closer.', 'We haven\'t been to {place}. Don\'t blink.'],
  after: ['There was {thing}. I noticed {thing} first.', 'First time at {place}. I\'m keeping this one.'],
  bedtime: ['{count} photos today. Night.'],
  return: ['{days} days. You\'re back. Come on.'],
  big: ['Something changed. Look at me. Look.'],
  moment: ['Something happened just now. Did you see it?'],
  unlock: ['Something changed. Look at me. Look.'],
  talk: ['Say that again. I was looking at {thing}.'],
  'talk-warm': ['Then it\'s a sofa day. I\'ll do the face until you laugh.'],
  'talk-curious': ['I don\'t know that one. I only really know puddles and buses.'],
}

const GAME_WORDS = /\b(bond|level|streak|points?|ladder|rank|unlock|xp)\b/i
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u

export function checkRules(line) {
  if (typeof line !== 'string' || !line.trim()) return false
  if (EMOJI.test(line) || line.includes('#')) return false
  if (GAME_WORDS.test(line)) return false
  if (/\d/.test(line)) return false
  const sentences = line.split(/(?<=[.!?])\s+/).filter(Boolean)
  if (sentences.length > 3) return false
  if (sentences.some((s) => s.split(/\s+/).length > 14)) return false
  if (/!!/.test(line)) return false
  const caps = line.match(/\b[A-Z]{3,}\b/g) || []
  if (caps.length > 1) return false
  return true
}

export function fillSlots(line, slots = {}) {
  return line.replace(/\{(\w+)\}/g, (m, k) => (slots[k] != null ? String(slots[k]) : m))
}

function usable(line, slots) {
  return !/\{(\w+)\}/.test(fillSlots(line, slots))
}

/** Lead trait first, second trait as a fallback, then templates. Never repeats a recent line. */
export function pickLine({ traits = [], situation, slots = {}, recent = [], rng = Math.random }) {
  const seen = new Set(recent)
  const traitPools = traits.slice(0, 2).map((t) => LINES[t]?.[situation] || [])
  const templatePool = TEMPLATES[situation] || []

  // First pass: try to find fresh (not in recent) line from trait pools, then templates
  for (const pool of traitPools) {
    const fresh = pool.filter((l) => !seen.has(l) && usable(l, slots))
    if (fresh.length) return fillSlots(fresh[Math.floor(rng() * fresh.length)], slots)
  }
  const freshTemplates = templatePool.filter((l) => !seen.has(l) && usable(l, slots))
  if (freshTemplates.length) return fillSlots(freshTemplates[Math.floor(rng() * freshTemplates.length)], slots)

  // Second pass: if no fresh line found, try any usable line from templates only (not trait pools)
  const templateUsable = templatePool.filter((l) => usable(l, slots))
  if (templateUsable.length) return fillSlots(templateUsable[Math.floor(rng() * templateUsable.length)], slots)

  // Fallback: talk template
  return fillSlots(TEMPLATES.talk[0], { thing: slots.thing || 'the sky' })
}
