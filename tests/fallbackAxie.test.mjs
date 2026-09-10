import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fallbackAxieSvg, fallbackAxieMarkup, colourForClass } from '../src/fallbackAxie.ts'

test('the stand-in wears the class colour, and an unknown class gets the neutral shell', () => {
  assert.equal(colourForClass('Beast'), '#F6B04E')
  assert.equal(colourForClass('aquatic'), '#5FB7F5')
  assert.equal(colourForClass('Plant'), '#8ED26B')
  assert.equal(colourForClass('Bird'), '#F58AA8')
  assert.equal(colourForClass('Bug'), '#F26D5B')
  assert.equal(colourForClass('Reptile'), '#B08BE6')
  assert.equal(colourForClass(null), '#C5D6E5')
  assert.equal(colourForClass('Dawn'), '#C5D6E5', 'an unknown class is neutral, never a wrong colour')
  assert.match(fallbackAxieMarkup('Beast', 'Miso'), /#F6B04E/)
})

test('the stand-in has a face and an outline, at the size the camera composes against', () => {
  const svg = fallbackAxieMarkup('Aquatic', 'Miso')
  assert.match(svg, /width="512" height="512"/)
  assert.match(svg, /viewBox="0 0 512 512"/)
  assert.doesNotMatch(svg, /<rect[^>]*width="512"/, 'transparent background — no full-bleed fill')
  assert.equal((svg.match(/<ellipse/g) || []).length, 2, 'two eyes')
  assert.match(svg, /<path d="M226 330/, 'a mouth')
  assert.match(svg, /#1A2B3C/, 'ink outlines')
  assert.match(svg, /<title>Miso<\/title>/)
})

test('a player-typed name is escaped, never interpolated raw into the markup', () => {
  const svg = fallbackAxieMarkup('Bug', '<script>&x')
  assert.doesNotMatch(svg, /<script>/)
  assert.match(svg, /<title>&lt;script&gt;&amp;x<\/title>/)
})

test('fallbackAxieSvg is a data URI an <img> can take straight', () => {
  const uri = fallbackAxieSvg('Beast', 'Miso')
  assert.match(uri, /^data:image\/svg\+xml;charset=utf-8,/)
  const decoded = decodeURIComponent(uri.slice(uri.indexOf(',') + 1))
  assert.equal(decoded, fallbackAxieMarkup('Beast', 'Miso'))
  assert.match(decoded, /#F6B04E/)
  // Nothing in it reaches the network — that is the whole point of a stand-in.
  assert.doesNotMatch(decoded, /https?:\/\/(?!www\.w3\.org)/)
})
