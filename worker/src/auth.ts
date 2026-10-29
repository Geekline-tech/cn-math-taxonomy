const ITERATIONS = 100000

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export function randomHex(bytes: number): string {
  const buffer = new Uint8Array(bytes)
  crypto.getRandomValues(buffer)
  return [...buffer].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function derive(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  )
  return toBase64(new Uint8Array(bits))
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16)
  crypto.getRandomValues(salt)
  const hash = await derive(password, salt)
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${hash}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  if (!Number.isFinite(iterations) || iterations <= 0) return false
  const salt = fromBase64(parts[2])
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    key,
    256,
  )
  const computed = toBase64(new Uint8Array(bits))
  if (computed.length !== parts[3].length) return false
  let diff = 0
  for (let index = 0; index < computed.length; index += 1) {
    diff |= computed.charCodeAt(index) ^ parts[3].charCodeAt(index)
  }
  return diff === 0
}

export function validUsername(value: unknown): string {
  if (typeof value !== 'string') return ''
  const name = value.trim()
  if (!/^[A-Za-z0-9_\u4e00-\u9fa5]{3,20}$/.test(name)) return ''
  return name
}

export function validPassword(value: unknown): string {
  if (typeof value !== 'string') return ''
  if (value.length < 6 || value.length > 64) return ''
  return value
}
