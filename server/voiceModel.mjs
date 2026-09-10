/**
 * The model behind the Axie's voice: one small call to Gemini per line that has to be about
 * something (what is in the photo, what the person just said, the day so far). Everything the
 * model returns is checked against the voice rules by the caller; anything that fails, times out,
 * or runs past the daily budget falls back to the written line library, so the app never waits on
 * this and never goes quiet.
 *
 * Off without `GEMINI_API_KEY`. Model name from `GEMINI_MODEL` (the flash-lite model answers a
 * photo in about two seconds and honours JSON output; the larger flash models were seen to answer
 * JSON mode with prose). No SDK: a single REST call, so the same file runs in Node and the Worker.
 */
export const DEFAULT_MODEL = 'gemini-3.5-flash-lite'
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
/** Free-tier daily request ceiling for one deployment, well under the provider's own. */
const DEFAULT_DAILY_CAP = 1000
const DEFAULT_TIMEOUT_MS = 9000
/** Uploads are ~200-400 KB composites; anything much larger is not a phone photo from this app. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024

/** A data URL or raw base64 -> { mime, data } for the API, or null if it is not an image. */
export function splitImage(raw) {
  if (typeof raw !== 'string' || !raw) return null
  const m = /^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i.exec(raw.trim())
  const mime = m ? m[1].toLowerCase().replace('jpg', 'jpeg') : 'image/jpeg'
  const data = (m ? m[2] : raw).replace(/\s/g, '')
  if (!data || data.length * 0.75 > MAX_IMAGE_BYTES) return null
  return { mime, data }
}

export function createVoiceModel({ env = {}, fetchImpl = globalThis.fetch, now = () => Date.now(), dailyCap = DEFAULT_DAILY_CAP, timeoutMs = DEFAULT_TIMEOUT_MS, log = console } = {}) {
  const apiKey = typeof env.GEMINI_API_KEY === 'string' ? env.GEMINI_API_KEY.trim() : ''
  const model = (typeof env.GEMINI_MODEL === 'string' && env.GEMINI_MODEL.trim()) || DEFAULT_MODEL
  const enabled = Boolean(apiKey) && typeof fetchImpl === 'function'
  let day = ''
  let used = 0
  let failures = 0

  function budgetOk() {
    const today = new Date(now()).toISOString().slice(0, 10)
    if (today !== day) { day = today; used = 0 }
    return used < dailyCap
  }

  /**
   * One call. `system` sets who is speaking, `user` is the situation, `image` an optional
   * { mime, data }, `schema` the JSON shape wanted back. Resolves to the parsed object or null.
   */
  async function ask({ system, user, image = null, schema, maxTokens = 160, temperature = 0.9 }) {
    if (!enabled || !budgetOk()) return null
    used += 1
    const parts = [{ text: user }]
    if (image?.data) parts.push({ inlineData: { mimeType: image.mime, data: image.data } })
    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType: 'application/json', ...(schema ? { responseSchema: schema } : {}) },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      ],
    }
    const controller = typeof AbortController === 'function' ? new AbortController() : null
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null
    try {
      const res = await fetchImpl(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
        signal: controller?.signal,
      })
      if (!res.ok) {
        failures += 1
        log?.warn?.(`[voice] model answered ${res.status}`)
        return null
      }
      const json = await res.json()
      const text = (json?.candidates?.[0]?.content?.parts || []).map((p) => p?.text || '').join('').trim()
      if (!text) return null
      try {
        const parsed = JSON.parse(text)
        return parsed && typeof parsed === 'object' ? parsed : null
      } catch {
        // prose instead of JSON: not usable, the library speaks
        return null
      }
    } catch (err) {
      failures += 1
      log?.warn?.(`[voice] model call failed: ${err?.name === 'AbortError' ? 'timeout' : err?.message || err}`)
      return null
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  return { enabled, model, ask, stats: () => ({ enabled, model, day, used, failures, dailyCap }) }
}
