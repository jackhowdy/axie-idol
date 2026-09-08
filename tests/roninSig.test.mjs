import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as secp from '@noble/secp256k1'
import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha256'
import { keccak_256 } from '@noble/hashes/sha3'
import { signInMessage, recoverAddress, hashPersonalMessage } from '../server/roninSig.mjs'

secp.etc.hmacSha256Sync = (k, ...m) => hmac(sha256, k, secp.etc.concatBytes(...m))

test('recovers the signer of a personal_sign message', () => {
  const priv = secp.utils.randomPrivateKey()
  const pub = secp.getPublicKey(priv, false)
  const address = '0x' + Buffer.from(keccak_256(pub.subarray(1)).subarray(12)).toString('hex')
  const msg = signInMessage(address, 'abc123')
  const sig = secp.sign(hashPersonalMessage(msg), priv)
  const hex = '0x' + Buffer.from(sig.toCompactRawBytes()).toString('hex') + (27 + sig.recovery).toString(16)
  assert.equal(recoverAddress(msg, hex), address)
  assert.notEqual(recoverAddress(msg + 'x', hex), address)
  assert.equal(recoverAddress(msg, '0x1234'), null)
})
