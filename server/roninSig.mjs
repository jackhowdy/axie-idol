// personal_sign recovery for Ronin (EVM) wallets. No transaction, no gas.
import { Buffer } from 'node:buffer'
import * as secp from '@noble/secp256k1'
import { keccak_256 } from '@noble/hashes/sha3'

export function signInMessage(address, nonce) {
  return `Axie Idol sign-in\naddress: ${address.toLowerCase()}\nnonce: ${nonce}\nNo transaction. No gas.`
}

export function hashPersonalMessage(message) {
  const body = Buffer.from(message, 'utf8')
  const prefix = Buffer.from(`\x19Ethereum Signed Message:\n${body.length}`, 'utf8')
  return keccak_256(Buffer.concat([prefix, body]))
}

export function recoverAddress(message, signatureHex) {
  try {
    const raw = Buffer.from(String(signatureHex).replace(/^0x/, ''), 'hex')
    if (raw.length !== 65) return null
    let v = raw[64]; if (v >= 27) v -= 27
    if (v !== 0 && v !== 1) return null
    const sig = secp.Signature.fromCompact(raw.subarray(0, 64)).addRecoveryBit(v)
    const pub = sig.recoverPublicKey(hashPersonalMessage(message)).toRawBytes(false)
    return '0x' + Buffer.from(keccak_256(pub.subarray(1)).subarray(12)).toString('hex')
  } catch {
    return null
  }
}
