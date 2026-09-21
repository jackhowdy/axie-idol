import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'

function freePort() {
  return new Promise((res) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => res(port))
    })
  })
}

/** Any HTTP answer means the server is listening; which routes exist depends on the flags it got. */
async function waitFor(url, ms = 15000) {
  const until = Date.now() + ms
  while (Date.now() < until) {
    try {
      await fetch(url)
      return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error(`server did not start: ${url}`)
}

/** Starts `node server.mjs` on a free port with a temp DATA_DIR. Returns { baseUrl, stop }. */
export async function startNodeServer(extraEnv = {}) {
  const port = await freePort()
  const dataDir = mkdtempSync(join(tmpdir(), 'axie-idol-test-'))
  const child = spawn(process.execPath, [resolve('server.mjs')], {
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      DATA_DIR: dataDir,
      SKYMAVIS_API_KEY: '',
      // never let a developer's .env key send test photos to the voice model
      GEMINI_API_KEY: '',
      // the egg flows are still tested even though Round 1 ships without eggs
      EGGS: '1',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  child.stdout.on('data', (d) => (log += d))
  child.stderr.on('data', (d) => (log += d))
  const baseUrl = `http://127.0.0.1:${port}`
  try {
    await waitFor(`${baseUrl}/api/buddy`)
  } catch (err) {
    child.kill()
    throw new Error(`${err.message}\n${log}`)
  }
  return {
    baseUrl,
    stop: () =>
      new Promise((res) => {
        child.once('exit', res)
        child.kill()
      }),
  }
}
