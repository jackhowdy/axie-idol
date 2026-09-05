import { Buffer } from 'node:buffer'

/** Minimal stand-in for node:http ServerResponse used by the core handlers. */
export class ResponseShim {
  constructor() {
    this.statusCode = 200
    this.headersSent = false
    this._headers = {}
    this._chunks = []
  }

  writeHead(status, headers = {}) {
    this.statusCode = status
    for (const [k, v] of Object.entries(headers)) this._headers[k.toLowerCase()] = String(v)
    this.headersSent = true
    return this
  }

  setHeader(k, v) {
    this._headers[k.toLowerCase()] = String(v)
  }

  end(body) {
    if (body != null) this._chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(String(body)))
    this.headersSent = true
  }

  result() {
    return {
      status: this.statusCode,
      headers: { ...this._headers },
      body: Buffer.concat(this._chunks),
    }
  }
}
