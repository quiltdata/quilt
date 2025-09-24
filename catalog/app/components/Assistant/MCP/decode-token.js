/*
 * JWT helper utilities used by the MCP frontend integration.
 * Provides base64url encode/decode helpers, lightweight JWT parsing,
 * and HS256 signing that works in both browser and Node environments.
 */

let textEncoder
let textDecoder

const getTextEncoder = () => {
  if (textEncoder) return textEncoder
  if (typeof TextEncoder !== 'undefined') {
    textEncoder = new TextEncoder()
    return textEncoder
  }
  try {
    // eslint-disable-next-line global-require
    const { TextEncoder: NodeTextEncoder } = require('util')
    textEncoder = new NodeTextEncoder()
    return textEncoder
  } catch (error) {
    throw new Error('TextEncoder is not available in this environment')
  }
}

const getTextDecoder = () => {
  if (textDecoder) return textDecoder
  if (typeof TextDecoder !== 'undefined') {
    textDecoder = new TextDecoder()
    return textDecoder
  }
  try {
    // eslint-disable-next-line global-require
    const { TextDecoder: NodeTextDecoder } = require('util')
    textDecoder = new NodeTextDecoder()
    return textDecoder
  } catch (error) {
    throw new Error('TextDecoder is not available in this environment')
  }
}

const toUint8Array = (value) => {
  if (value instanceof Uint8Array) return value
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer)
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (typeof value === 'string') return getTextEncoder().encode(value)
  throw new TypeError('Cannot convert value to Uint8Array')
}

const base64FromBytes = (bytes) => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }
  let binary = ''
  const view = toUint8Array(bytes)
  for (let i = 0; i < view.length; i += 1) {
    binary += String.fromCharCode(view[i])
  }
  return btoa(binary)
}

const base64UrlEncode = (bytes) =>
  base64FromBytes(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

const base64ToBytes = (base64) => {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'))
  }
  const binaryString = atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

const base64UrlToBase64 = (value) => value.replace(/-/g, '+').replace(/_/g, '/')

const normalizeBase64Input = (value) => {
  const base64 = base64UrlToBase64(value)
  const padding = base64.length % 4
  if (!padding) return base64
  return base64 + '='.repeat(4 - padding)
}

export const base64UrlEncodeString = (value) =>
  base64UrlEncode(getTextEncoder().encode(value))

export const base64UrlEncodeBytes = (bytes) => base64UrlEncode(bytes)

export const base64UrlDecodeToString = (value) => {
  const base64 = normalizeBase64Input(value)
  const bytes = base64ToBytes(base64)
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('utf-8')
  }
  return getTextDecoder().decode(bytes)
}

export const decodeJwt = (token) => {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format: expected header.payload.signature')
  }
  const [headerPart, payloadPart, signaturePart] = parts
  const header = JSON.parse(base64UrlDecodeToString(headerPart))
  const payload = JSON.parse(base64UrlDecodeToString(payloadPart))
  return {
    header,
    payload,
    signature: signaturePart || '',
    headerB64: headerPart,
    payloadB64: payloadPart,
    signatureB64: signaturePart || '',
  }
}

const getSubtleCrypto = () => {
  if (typeof crypto !== 'undefined' && crypto?.subtle) return crypto.subtle
  // eslint-disable-next-line no-undef
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    // eslint-disable-next-line no-undef
    return globalThis.crypto.subtle
  }
  // Only try to require crypto in Node.js environment
  if (
    typeof window === 'undefined' &&
    typeof process !== 'undefined' &&
    process.versions?.node
  ) {
    try {
      // Use dynamic import to avoid webpack bundling issues
      const crypto = eval('require')('crypto')
      const { webcrypto } = crypto
      if (webcrypto?.subtle) return webcrypto.subtle
    } catch (error) {
      // ignore, we'll try the node fallback later
    }
  }

  // Fallback: return a mock subtle crypto for browser environments
  console.warn('Crypto.subtle not available, using mock implementation')
  return {
    importKey: () => Promise.reject(new Error('Crypto not available')),
    exportKey: () => Promise.reject(new Error('Crypto not available')),
    generateKey: () => Promise.reject(new Error('Crypto not available')),
    sign: () => Promise.reject(new Error('Crypto not available')),
    verify: () => Promise.reject(new Error('Crypto not available')),
    digest: () => Promise.reject(new Error('Crypto not available')),
  }
}

const signWithNodeCrypto = (secretBytes, dataBytes) => {
  // Only try to require crypto in Node.js environment
  if (
    typeof window === 'undefined' &&
    typeof process !== 'undefined' &&
    process.versions?.node
  ) {
    try {
      // Use dynamic import to avoid webpack bundling issues
      const nodeCrypto = eval('require')('crypto')
      const hmac = nodeCrypto.createHmac('sha256', Buffer.from(secretBytes))
      hmac.update(Buffer.from(dataBytes))
      return new Uint8Array(hmac.digest())
    } catch (error) {
      return null
    }
  }
  return null
}

const signHS256 = async (secret, data) => {
  const secretBytes = toUint8Array(secret)
  const dataBytes = toUint8Array(data)
  const subtle = getSubtleCrypto()
  if (subtle) {
    const key = await subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      false,
      ['sign'],
    )
    const signature = await subtle.sign('HMAC', key, dataBytes)
    return new Uint8Array(signature)
  }

  const nodeSignature = signWithNodeCrypto(secretBytes, dataBytes)
  if (nodeSignature) return nodeSignature

  throw new Error('Unable to sign JWT: HMAC-SHA256 not supported in this environment')
}

export const signJwt = async ({ header, payload, secret }) => {
  if (!secret) throw new Error('JWT signing secret is required')
  const headerStr = JSON.stringify(header)
  const payloadStr = JSON.stringify(payload)
  const headerB64 = base64UrlEncodeString(headerStr)
  const payloadB64 = base64UrlEncodeString(payloadStr)
  const signingInput = `${headerB64}.${payloadB64}`
  const signatureBytes = await signHS256(secret, signingInput)
  const signatureB64 = base64UrlEncodeBytes(signatureBytes)
  return {
    token: `${signingInput}.${signatureB64}`,
    headerB64,
    payloadB64,
    signatureB64,
  }
}

export const reSignJwt = async ({ token, mutatePayload, mutateHeader, secret }) => {
  const { header: originalHeader, payload: originalPayload } = decodeJwt(token)
  const header = mutateHeader ? mutateHeader(originalHeader) : originalHeader
  const payload = mutatePayload ? mutatePayload(originalPayload) : originalPayload
  return signJwt({ header, payload, secret })
}

export default {
  base64UrlEncodeString,
  base64UrlEncodeBytes,
  base64UrlDecodeToString,
  decodeJwt,
  signJwt,
  reSignJwt,
}
