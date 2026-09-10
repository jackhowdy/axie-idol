import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createVoiceModel, splitImage, DEFAULT_MODEL } from '../server/voiceModel.mjs'

const quiet = { warn: () => {} }
const okResponse = (obj) => ({
  ok: true, status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }),
})

test('without a key the model is off and never calls out', async () => {
  let calls = 0
  const v = createVoiceModel({ env: {}, fetchImpl: async () => { calls++; return okResponse({ line: 'x' }) }, log: quiet })
  assert.equal(v.enabled, false)
  assert.equal(await v.ask({ system: 's', user: 'u' }), null)
  assert.equal(calls, 0)
})

test('a call carries the system prompt, the image and the JSON schema, and the parsed answer comes back', async () => {
  let seen = null
  const v = createVoiceModel({
    env: { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'test-model' },
    fetchImpl: async (url, init) => { seen = { url, init }; return okResponse({ seen: ['dog'], line: 'A dog. Can we keep it?' }) },
    log: quiet,
  })
  assert.equal(v.enabled, true)
  const out = await v.ask({ system: 'You are Miso', user: 'Look at this', image: { mime: 'image/jpeg', data: 'AAAA' }, schema: { type: 'OBJECT' } })
  assert.deepEqual(out, { seen: ['dog'], line: 'A dog. Can we keep it?' })
  assert.match(seen.url, /models\/test-model:generateContent$/)
  assert.equal(seen.init.headers['x-goog-api-key'], 'k')
  assert.doesNotMatch(seen.url, /key=/, 'the key travels in a header, never the URL')
  const body = JSON.parse(seen.init.body)
  assert.equal(body.systemInstruction.parts[0].text, 'You are Miso')
  assert.equal(body.contents[0].parts[0].text, 'Look at this')
  assert.deepEqual(body.contents[0].parts[1].inlineData, { mimeType: 'image/jpeg', data: 'AAAA' })
  assert.equal(body.generationConfig.responseMimeType, 'application/json')
  assert.deepEqual(body.generationConfig.responseSchema, { type: 'OBJECT' })
})

test('the default model is the fast one and the env can override it', () => {
  assert.equal(createVoiceModel({ env: { GEMINI_API_KEY: 'k' }, fetchImpl: async () => okResponse({}) }).model, DEFAULT_MODEL)
  assert.equal(createVoiceModel({ env: { GEMINI_API_KEY: 'k', GEMINI_MODEL: ' other ' }, fetchImpl: async () => okResponse({}) }).model, 'other')
})

test('an error status, prose instead of JSON, or a thrown fetch all answer null', async () => {
  const bad = createVoiceModel({ env: { GEMINI_API_KEY: 'k' }, fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({}) }), log: quiet })
  assert.equal(await bad.ask({ system: 's', user: 'u' }), null)
  const prose = createVoiceModel({ env: { GEMINI_API_KEY: 'k' }, fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Here is the JSON requested:' }] } }] }) }), log: quiet })
  assert.equal(await prose.ask({ system: 's', user: 'u' }), null)
  const thrown = createVoiceModel({ env: { GEMINI_API_KEY: 'k' }, fetchImpl: async () => { throw new Error('network down') }, log: quiet })
  assert.equal(await thrown.ask({ system: 's', user: 'u' }), null)
  assert.equal(thrown.stats().failures, 1)
})

test('a slow model is abandoned at the timeout', async () => {
  const v = createVoiceModel({
    env: { GEMINI_API_KEY: 'k' }, timeoutMs: 30, log: quiet,
    fetchImpl: (url, init) => new Promise((_, reject) => { init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))) }),
  })
  const t0 = Date.now()
  assert.equal(await v.ask({ system: 's', user: 'u' }), null)
  assert.ok(Date.now() - t0 < 1000, 'did not hang')
})

test('the daily budget stops calls until the next day', async () => {
  let clock = Date.parse('2026-09-10T02:00:00Z')
  let calls = 0
  const v = createVoiceModel({ env: { GEMINI_API_KEY: 'k' }, dailyCap: 2, now: () => clock, fetchImpl: async () => { calls++; return okResponse({ line: 'ok' }) }, log: quiet })
  assert.ok(await v.ask({ system: 's', user: 'u' }))
  assert.ok(await v.ask({ system: 's', user: 'u' }))
  assert.equal(await v.ask({ system: 's', user: 'u' }), null, 'third call of the day is refused')
  assert.equal(calls, 2)
  clock += 24 * 3600 * 1000
  assert.ok(await v.ask({ system: 's', user: 'u' }), 'a new day opens the budget again')
  assert.equal(v.stats().used, 1)
})

test('splitImage reads a data URL or raw base64 and refuses giants', () => {
  assert.deepEqual(splitImage('data:image/png;base64,AAAA'), { mime: 'image/png', data: 'AAAA' })
  assert.deepEqual(splitImage('data:image/jpg;base64,BBBB'), { mime: 'image/jpeg', data: 'BBBB' })
  assert.deepEqual(splitImage('CCCC'), { mime: 'image/jpeg', data: 'CCCC' })
  assert.equal(splitImage(''), null)
  assert.equal(splitImage(null), null)
  assert.equal(splitImage('data:image/png;base64,' + 'A'.repeat(6 * 1024 * 1024)), null)
})
