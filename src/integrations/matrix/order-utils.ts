const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

function midChar(a: string, b: string): string {
  const ai = CHARS.indexOf(a)
  const bi = CHARS.indexOf(b)
  const mi = Math.floor((ai + bi) / 2)
  return CHARS[mi] || 'U'
}

export function nextString(s: string): string {
  if (!s) return 'U'
  const last: string = s.charAt(s.length - 1)
  const idx = CHARS.indexOf(last)
  if (idx === -1 || idx === CHARS.length - 1) return s + 'U'
  return s.slice(0, -1) + CHARS[idx + 1]
}

export function prevString(s: string): string {
  if (!s) return 'U'
  const last: string = s.charAt(s.length - 1)
  const idx = CHARS.indexOf(last)
  if (idx <= 0) return s + '0'
  return s.slice(0, -1) + CHARS[idx - 1]
}

export function averageBetweenStrings(a?: string, b?: string): string {
  const A = a || ''
  const B = b || ''
  const len = Math.max(A.length, B.length)
  let result = ''
  for (let i = 0; i < len; i++) {
    const ca = A[i] || '0'
    const cb = B[i] || 'z'
    if (ca === cb) {
      result += ca
      continue
    }
    result += midChar(ca, cb)
    return result
  }
  return nextString(A)
}
