// The written line library from docs/voice-bible.md. Lines are the floor; a model may add more later.
// Rules (checkRules): no digits, no game words, no emoji, at most three short sentences, one loud word.
// Lines with {slots} are used only when the app has a real noun for the slot; everything else works
// anywhere, so an Axie on a staircase never talks about waves.
export const SITUATIONS = ['hatch', 'morning', 'wish', 'before', 'after', 'bedtime', 'return', 'big', 'moment', 'unlock', 'talk', 'talk-warm', 'talk-curious', 'pet']

export const LINES = {
  Explorer: {
    hatch: ['I have HORNS. Where are we going first?', 'Out. Finally. Which way is new?'],
    morning: [
      'New day. New street? Pick one we haven\'t done.',
      'I looked at the map in my head. There\'s a gap. Let\'s fill it.',
      'Somewhere we\'ve never been. Even a small somewhere counts.',
      'Left instead of right today. Just to see.',
    ],
    wish: ['Take me somewhere you\'ve never taken me.', 'Show me a street with no name I know.'],
    before: [
      'Further back. I want all of it in.',
      'Get {thing} in it. What\'s past that?',
      'Turn a little. There\'s more that way.',
      'Wait, is that a path? Get the path in.',
      'Step back so I can see where this goes.',
    ],
    after: [
      'New. That was new. I felt it in my ears.',
      'There was {thing}. What\'s past {thing}?',
      'Okay. Now what\'s around the corner?',
      'Good one. Add it to the places. I\'m counting places now.',
      'I\'ve never stood here before. Now I have.',
    ],
    bedtime: [
      'Six new things today. I\'m going to dream all six.',
      'My feet are full of new streets. Night.',
      'Tomorrow, the other direction. Promise me.',
      'I went far today. Not far enough. Night.',
    ],
    return: [
      'You\'re back. I made a list. It\'s long.',
      'While you were gone I thought of places. Ready?',
      'There you are. The world got bigger without us. Let\'s catch up.',
      'Finally. Shoes on. Anywhere new.',
    ],
    big: ['I feel like I could see over the mountain now.', 'Something in me leans further away now.'],
  },
  Homebody: {
    hatch: ['Hello. Is this our place? I like our place.', 'Oh, warm. Is it always this warm here? Good.'],
    morning: [
      'Our bench today? The bench misses us.',
      'Same walk as yesterday. I liked yesterday.',
      'Let\'s go somewhere we know. Somewhere with a chair.',
      'Nothing new today, please. New is tiring.',
    ],
    wish: ['Take me back to somewhere we\'ve been. I want to check it\'s still there.', 'Our spot. You know the one.'],
    before: [
      'Same spot as last time. Stand where you stood.',
      'Closer. I like it when the edges are things I know.',
      'Get the usual bit in. The bit we always get in.',
      'Not too far from the door. Just in case.',
    ],
    after: [
      'That looked like home. Good.',
      'There was {thing}. Our {thing}.',
      'I remember this. Or something like this. Keep it.',
      'Familiar. I felt calm. Did you feel calm?',
      'We came back here. See? Things come back.',
    ],
    bedtime: [
      'Home is the best place we went today.',
      'Bed. Blanket. That was a good loop.',
      'Everything is where I left it. Night.',
      'We went out. We came back. My favourite kind of day.',
    ],
    return: [
      'There you are. I kept your side warm.',
      'You\'re back. I didn\'t move. Well, once.',
      'Missed you. The room was too big.',
      'Hello again. Sit first, then tell me.',
    ],
    big: ['Something\'s different. But you\'re the same. Good.', 'I feel settled. Like a chair that finally fits.'],
  },
  Foodie: {
    hatch: ['I\'m hungry. Is that normal? What\'s that smell?', 'Hello. Question. When is lunch?'],
    morning: [
      'Breakfast first. Then whatever you were going to say.',
      'I smell something. Follow it.',
      'Is there a bakery on the way? Make there be a bakery.',
      'Plan for today: eat, then look at things, then eat.',
    ],
    wish: ['Show me somewhere that smells like garlic.', 'Take me past a window with buns in it.'],
    before: [
      'Get the food in the shot. Closer. CLOSER.',
      'Get {thing} in it. Closer.',
      'Is anyone eating in this one? Get them in.',
      'Hold it there. I can smell something.',
      'A bit lower. I want to be near the table.',
    ],
    after: [
      'Is that for me? Blink twice if that\'s for me.',
      'I noticed {thing}. Is {thing} edible?',
      'No food in that one. I checked twice.',
      'Something nearby smelled amazing. Investigate.',
      'That one made me hungry. Most things do.',
    ],
    bedtime: [
      'I dreamed about the egg tart already. Twice.',
      'Good day. Would have been better with a snack.',
      'Night. Think about noodles for me.',
      'Full of pictures. Still hungry. Night.',
    ],
    return: [
      'You came back. Did you bring anything? It\'s fine.',
      'You\'re here. Any food on you? Fine.',
      'Two things I missed. You, and lunch with you.',
      'Welcome back. I saved you nothing. I had nothing.',
    ],
    big: ['I feel shiny. Shiny like a fresh bun.', 'Something changed. I feel fresh from the oven.'],
  },
  Athlete: {
    hatch: ['Out! Finally. How far can we go before dark?', 'Legs. I have legs. Let\'s test them.'],
    morning: [
      'Legs. Let\'s use the legs. Yours, I mean.',
      'Stairs today. I saw some yesterday and said nothing.',
      'Walk fast. Then faster. Then a photo.',
      'Warm up first. Now go.',
    ],
    wish: ['Take me up something. Stairs count.', 'Walk me until your legs complain.'],
    before: [
      'Not here. Ten more steps, then here.',
      'Higher. Is there a higher bit? Go there.',
      'Quick, before we cool down.',
      'Get the steps in. All of them.',
      'Hold still. I know, hard, right?',
    ],
    after: [
      'That\'s the top? Good. What\'s the next top?',
      'Done. Now again, but faster.',
      'I felt that one in my legs. Good.',
      'There was {thing}. Can we climb {thing}?',
      'Was that uphill? It felt uphill. Good.',
    ],
    bedtime: [
      'We went far. Further tomorrow.',
      'My legs are tired in a good way. Night.',
      'Rest day tomorrow? No. Night.',
      'Stretch before bed. You too.',
    ],
    return: [
      'Two days on the sofa. I forgive you. Walk?',
      'You\'re back. Shoes on. Now.',
      'I did laps of the room while you were gone. Many.',
      'Welcome back. We lost time. We can run it back.',
    ],
    big: ['My legs feel faster. Is that possible? Let\'s check.', 'I could climb the whole hill now. Try me.'],
  },
  Goofball: {
    hatch: ['Boo. Did I do it right? I\'ll do it again.', 'Hello. Was that a good hello? I have others.'],
    morning: [
      'Today I will be extremely normal. No I won\'t.',
      'Plan: do something silly. Then a photo of it.',
      'I woke up with a face ready. You\'ll see.',
      'Good morning. That\'s the serious voice. It won\'t last.',
    ],
    wish: ['Take a photo of me somewhere I definitely shouldn\'t be.', 'Put me somewhere silly and act like it\'s normal.'],
    before: [
      'Make the face. No, the OTHER face.',
      'Pretend I\'m not here. I\'m very here.',
      'On three, do something weird. One. Two.',
      'Tilt. More tilt. Too much, perfect.',
      'Can I be upside down in this one? Try.',
    ],
    after: [
      'That\'s the worst photo of me ever. Keep it forever.',
      'My face did a thing. Did you get the thing?',
      'I blinked. On purpose. Artistic.',
      'There was {thing}. I made a face at {thing}.',
      'Ha. Look at us. Look at that.',
    ],
    bedtime: [
      'I was very funny today. You laughed at least once. I heard it.',
      'Night. Tomorrow I try the other face.',
      'Sleep now. Silly again in the morning.',
      'That was a good one. Tell someone tomorrow.',
    ],
    return: [
      'I practised a new face while you were gone. Ready? No, wait.',
      'You\'re back. I have a joke. It\'s not ready.',
      'Where were you? I did a whole show for the chair.',
      'Hello again. Quick, look normal. Now don\'t.',
    ],
    big: ['Ooh. Do I look important now? I feel important.', 'Something changed and it\'s fabulous. Say it\'s fabulous.'],
  },
  'Show-off': {
    hatch: ['Hello everyone. Oh, it\'s just you. That\'s fine.', 'I\'m here. Everyone can relax now.'],
    morning: [
      'Big crowd today? Take me where the people are.',
      'I have a look ready. Where can people see it?',
      'Good morning. Best side is the left. Remember that.',
      'Today deserves an audience. Find one.',
    ],
    wish: ['Show me somewhere busy. I have a look ready.', 'Take me where people will look. And then look.'],
    before: [
      'Wait. Chin up. NOW.',
      'Is anyone watching? Get them in the back.',
      'This is my good angle. Don\'t move.',
      'Lights are fine. I make my own.',
      'Pose is ready. Are you ready? Go.',
    ],
    after: [
      'Three people looked. I counted. Post it.',
      'That one\'s a keeper. Obviously.',
      'I looked great. You did fine too.',
      'There was {thing}. I still stole the shot.',
      'Show someone. Show two people.',
    ],
    bedtime: [
      'I was the best thing out there today. Not bragging. Reporting.',
      'Night. Tomorrow the fans wait.',
      'Big day. I was big in it.',
      'Sleep now. Beauty takes work.',
    ],
    return: [
      'The fans were asking about me. Probably. Let\'s give them something.',
      'You\'re back. The world missed my face.',
      'Finally. I\'ve been ready for hours.',
      'There you are. Somebody get a camera. Oh, you have one.',
    ],
    big: ['Oh this is a whole new look. Show someone. Show two people.', 'Look at me. No, really look. Better, right?'],
  },
  Shy: {
    hatch: ['Oh. Is it just us? Good.', 'Hello. Quietly. Hello.'],
    morning: [
      'Somewhere quiet today? If that\'s okay.',
      'Morning. Small plans are good plans.',
      'Could we go early, before it\'s busy?',
      'I\'m ready. Ish. Let\'s go slowly.',
    ],
    wish: ['Take me somewhere with trees and not many people.', 'Somewhere calm. Somewhere with a corner.'],
    before: [
      'Can I stand a bit behind you? Just a bit.',
      'Not too close. Okay, a little closer.',
      'Is anyone looking? Do it quick.',
      'Maybe from the side? The side is safer.',
      'Okay. I\'m ready. Don\'t say ready.',
    ],
    after: [
      'I was brave. A little brave.',
      'There was {thing}. I stayed calm about {thing}.',
      'That was fine. It was fine. Good.',
      'You can keep that one. I look okay in it.',
      'Nobody stared. I think. Good.',
    ],
    bedtime: [
      'Today was a lot. A good lot. Night.',
      'Quiet now. I like the quiet. Night.',
      'That was enough people for one day.',
      'Thank you for going slowly. Night.',
    ],
    return: [
      'You\'re back. I didn\'t mind waiting. I minded a little.',
      'Oh, hi. I\'m glad. Very glad, actually.',
      'You came back. I knew you would. Mostly knew.',
      'Hello. It was quiet. Too quiet, even for me.',
    ],
    big: ['Is it okay that I feel a bit bigger today? I think it\'s okay.', 'Something changed. Don\'t make a fuss. Okay, a small fuss.'],
  },
  Brave: {
    hatch: ['Right. Where\'s the tallest thing. We start there.', 'Awake. What\'s the scariest thing nearby? Good, there.'],
    morning: [
      'Wind today. Good. Let\'s stand in it.',
      'Whatever\'s hardest today, do that first.',
      'Big day. I can tell. Let\'s meet it.',
      'Up. The world isn\'t going to dare itself.',
    ],
    wish: ['Take me to the Peak. Or the rain. Both is fine.', 'Take me somewhere high or loud. Or both.'],
    before: [
      'Closer to the edge. Trust me. Closer.',
      'Don\'t flinch. I won\'t either.',
      'Get the big thing in. I\'m not scared of it.',
      'Hold it steady. Steady is brave too.',
      'Right in front of it. Yes, that.',
    ],
    after: [
      'That nearly got us. Nearly. Again?',
      'Not scared. A bit impressed, maybe.',
      'There was {thing}. I stared {thing} down.',
      'We did that. Bigger one next.',
      'Good. Now something that actually scares you.',
    ],
    bedtime: [
      'Nothing scared me today. The bus was close, though.',
      'Brave all day. Tired now. Night.',
      'Tomorrow, the thing you avoided today.',
      'Rest. Dragons sleep too. Night.',
    ],
    return: [
      'You were gone a while. Did something big happen? Take me to it.',
      'You\'re back. I guarded the place and nothing came. Still counts.',
      'Finally. Aim me at something.',
      'There you are. I was ready the whole time.',
    ],
    big: ['I feel like the storm would move for me now.', 'Something changed. I feel taller. Taller than the wind.'],
  },
  Dreamer: {
    hatch: ['The light in here is doing something. Look. Look at it.', 'Hello. Is the sky always that colour? Wow.'],
    morning: [
      'What colour is the sky today? Don\'t tell me. Show me.',
      'The light is soft this morning. Let\'s go before it hardens.',
      'I had a dream about a road. Let\'s find it.',
      'Look up first. Then decide where.',
    ],
    wish: ['Take me somewhere the sky is big.', 'Show me a reflection. Water, glass, anything.'],
    before: [
      'Wait for the cloud to move. There. Now.',
      'More sky. Tilt up a little.',
      'See how the light falls there? Get that.',
      'Slow down. Let the moment arrive first.',
      'Get {thing} in. It\'s glowing, sort of.',
    ],
    after: [
      'That cloud is a whale. I\'m sure of it. Don\'t argue.',
      'The light was kind in that one.',
      'There was {thing}. It looked like it was dreaming too.',
      'Something soft about that. Keep it.',
      'I saw a shape in it. I\'ll tell you later.',
    ],
    bedtime: [
      'The window is orange. Then it\'ll be blue. Then us again.',
      'Night. The sky is putting its colours away.',
      'I\'ll dream about that last one.',
      'Stars soon. I\'ll count the ones I can see.',
    ],
    return: [
      'The sky did things while you were gone. I\'ll tell you tomorrow.',
      'You\'re back. The light missed you. So did I.',
      'Hello. I was watching the clouds change. They\'re slow.',
      'There you are. I saved a sunset for you. In my head.',
    ],
    big: ['Something in me went bright. Like the water when the sun hits it.', 'I feel lit from inside. Is that showing?'],
  },
  Collector: {
    hatch: ['One. That\'s one hello. I\'m keeping it.', 'Hello. New things get counted. Starting now.'],
    morning: [
      'We\'re at six places. Seven would be a lot. Seven?',
      'New day. Empty list. Let\'s fill it.',
      'I sorted yesterday\'s photos in my head. Ready for more.',
      'Something to count today. Anything. Doors.',
    ],
    wish: ['Take me somewhere with a number on the door. I collect those.', 'Find me something I haven\'t got yet.'],
    before: [
      'Get the sign in. I need the sign for the list.',
      'Is there a door in this? Get the door.',
      'Straight on. I like them straight.',
      'Get {thing} in. I don\'t have one of those yet.',
      'Frame it neatly. Neat ones stack better.',
    ],
    after: [
      'Four dogs today. That\'s a record. I\'ll write it down.',
      'New one for the list. I\'m moving everything down.',
      'There was {thing}. Added {thing} to the list.',
      'That goes with the others. It fits.',
      'Counted. Sorted. Kept.',
    ],
    bedtime: [
      'Eleven photos. Nine good. Two very good, one with a dog.',
      'List closed for today. Reopening tomorrow.',
      'Everything counted. Night.',
      'A good haul. I\'ll sort it while you sleep.',
    ],
    return: [
      'Two days. That\'s a gap. Gaps count too, I counted it.',
      'You\'re back. I kept everything in order for you.',
      'Welcome back. The list waited. Lists are patient.',
      'There you are. I counted the days. Then I stopped.',
    ],
    big: ['New thing for the list. Top of the list. I\'m moving everything down.', 'I feel like a new column. A whole new column.'],
  },
}

/** Trait-neutral lines for each situation. Used when every trait line is spent or needs a slot we do not have. */
export const GENERIC = {
  // A pat on the head, on Home. Small and glad, and often it turns into wanting to go out.
  pet: [
    'Oh. Do that again.',
    'That spot. Right there. Yes.',
    'My horn likes that. Keep going?',
    'Hee. That tickles. Again?',
    'I was hoping you would do that.',
    'Mmm. Now I want to go somewhere with you.',
    'Warm hand. Good hand.',
    'Again. Then outside?',
  ],
  hatch: ['Hello. You\'re my person now. Where are we?', 'Oh. Hi. So this is outside.'],
  morning: [
    'Morning. Where are we going?',
    'I\'m awake. Mostly. Let\'s go.',
    'New day. Show me something.',
    'Ready when you are. Actually, ready before you.',
    'Shoes, door, photo. In that order.',
    'What\'s the plan? Any plan. I\'m in.',
  ],
  wish: ['Take me somewhere today. Anywhere.', 'Show me something I haven\'t seen.'],
  before: [
    'Closer. No, the other closer.',
    'Hold it there. Don\'t breathe. Okay, breathe.',
    'A little to the left. Your left.',
    'Get all of it in. I want the edges.',
    'Ready. Go. No wait, go.',
    'Don\'t shake. I\'m not shaking. You\'re shaking.',
  ],
  after: [
    'That one is going in the book.',
    'Good. Do another one, just in case.',
    'I liked that. Did you like that?',
    'Keep it. I looked fine.',
    'Again? I\'ve got more faces.',
    'That felt like a real one.',
  ],
  bedtime: [
    'Good day. Night.',
    'Photos done. Eyes closed. Night.',
    'Tomorrow, more. Night.',
    'I\'m sleepy. You look sleepy too.',
    'Night. Dream about somewhere new.',
  ],
  return: [
    'You\'re back. Come on, we\'ve got catching up to do.',
    'There you are. Where first?',
    'Hello again. I waited. Well, I napped.',
    'Missed you. Camera ready?',
  ],
  big: ['Something changed. Look at me. Look.', 'I feel different. Good different.'],
  moment: ['Something happened just now. Did you see it?', 'Did you feel that? That was a thing.'],
  unlock: ['Something changed. Look at me. Look.', 'New. I got something new. Check.'],
  talk: ['Say that again? I was thinking about something.', 'Hm. Tell me more.', 'I heard you. I\'m thinking.'],
  'talk-warm': [
    'Then it\'s a sofa day. I\'ll do the face until you laugh.',
    'Come here. We don\'t have to go anywhere today.',
    'That sounds heavy. Put it down for a bit. I\'m here.',
  ],
  'talk-curious': [
    'I don\'t know that one. I only really know puddles and buses.',
    'No idea. Ask the sky. It seems to know things.',
    'That\'s a grown-up question. I\'m a photo person.',
  ],
}

/** Lines with slots, used only when the app has a real noun for every slot. */
export const TEMPLATES = {
  pet: ['Oh. Do that again.'],
  hatch: ['Hello. You\'re my person now. Where are we?'],
  morning: ['It\'s {weather}. Good. Let\'s go anyway.', 'Day {count}. What\'s the plan?'],
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

/**
 * Every trait the Axie has, in order, then the trait-neutral pool, then slot templates.
 * Never repeats a line in `recent`; when everything is spent, a generic line repeats before a
 * trait line does, so the voice stays sensible rather than surprising.
 */
export function pickLine({ traits = [], situation, slots = {}, recent = [], rng = Math.random }) {
  const seen = new Set(recent)
  const pick = (arr) => fillSlots(arr[Math.floor(rng() * arr.length)], slots)
  const traitPools = traits.map((t) => LINES[t]?.[situation] || [])
  const genericPool = GENERIC[situation] || []
  const templatePool = TEMPLATES[situation] || []

  for (const pool of traitPools) {
    const fresh = pool.filter((l) => !seen.has(l) && usable(l, slots))
    if (fresh.length) return pick(fresh)
  }
  const freshGeneric = genericPool.filter((l) => !seen.has(l))
  if (freshGeneric.length) return pick(freshGeneric)
  const freshTemplates = templatePool.filter((l) => !seen.has(l) && usable(l, slots))
  if (freshTemplates.length) return pick(freshTemplates)

  if (genericPool.length) return pick(genericPool)
  const templateUsable = templatePool.filter((l) => usable(l, slots))
  if (templateUsable.length) return pick(templateUsable)
  return pick(GENERIC.talk)
}
