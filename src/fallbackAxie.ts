/**
 * A stand-in Axie for a phone that cannot show the real one.
 *
 * The 3D character is a mixer rig: a 5 MB manifest, part textures and WebGL. On a device where
 * that fails or crawls, the camera used to show nothing at all — the egg appeared, the hatched
 * Axie did not. This is the picture that goes in its place: no network, no WebGL, no fonts, just
 * a data URI the <img> already on the layer can take, so the shot still composes.
 *
 * Pure and self-contained on purpose — it has to work at the exact moment everything else did not.
 */

/** Class colours, matched to the Axie class palette. */
const CLASS_COLOUR: Record<string, string> = {
  beast: '#F6B04E',
  aquatic: '#5FB7F5',
  plant: '#8ED26B',
  bird: '#F58AA8',
  bug: '#F26D5B',
  reptile: '#B08BE6',
}
/** Anything unknown (or an unhatched/owned Axie whose class never loaded) gets a neutral shell. */
const UNKNOWN_COLOUR = '#C5D6E5'
const INK = '#1A2B3C'

export function colourForClass(cls: string | null): string {
  return CLASS_COLOUR[String(cls || '').trim().toLowerCase()] || UNKNOWN_COLOUR
}

/** The name is player-typed and lands inside SVG markup: escape it, never interpolate it raw. */
function escapeXml(raw: string): string {
  return String(raw).replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&apos;',
  )
}

/** The markup itself — exported so it can be read and asserted on without decoding a URI. */
export function fallbackAxieMarkup(cls: string | null, name: string): string {
  const body = colourForClass(cls)
  const label = escapeXml(String(name || 'Your Axie').slice(0, 16))
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img">',
    `<title>${label}</title>`,
    // body: a rounded blob, ink-outlined so it reads on any background the camera shows
    `<rect x="86" y="122" width="340" height="292" rx="132" fill="${body}" stroke="${INK}" stroke-width="12"/>`,
    // ears
    `<path d="M150 152 L134 78 L206 116 Z" fill="${body}" stroke="${INK}" stroke-width="12" stroke-linejoin="round"/>`,
    `<path d="M362 152 L378 78 L306 116 Z" fill="${body}" stroke="${INK}" stroke-width="12" stroke-linejoin="round"/>`,
    // eyes
    '<ellipse cx="204" cy="256" rx="34" ry="40" fill="#FFFFFF" stroke="' + INK + '" stroke-width="10"/>',
    '<ellipse cx="308" cy="256" rx="34" ry="40" fill="#FFFFFF" stroke="' + INK + '" stroke-width="10"/>',
    `<circle cx="204" cy="262" r="15" fill="${INK}"/>`,
    `<circle cx="308" cy="262" r="15" fill="${INK}"/>`,
    // mouth
    `<path d="M226 330 q30 30 60 0" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>`,
    '</svg>',
  ].join('')
}

/**
 * The stand-in as an inline data URI, ready for `img.src`. Percent-encoded rather than base64 so
 * the markup stays legible in a devtools inspection of a phone that is already misbehaving.
 */
export function fallbackAxieSvg(cls: string | null, name: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fallbackAxieMarkup(cls, name))}`
}
