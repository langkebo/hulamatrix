import { describe, it, expect } from 'vitest'

function shouldPlay(last: number, now: number, windowMs: number, allowSound: boolean, silent: boolean): boolean {
  if (!allowSound || silent) return false
  return now - last > windowMs
}

describe('notification sound debounce', () => {
  it('plays when outside window', () => {
    expect(shouldPlay(0, 1000, 800, true, false)).toBe(true)
  })
  it('does not play when inside window', () => {
    expect(shouldPlay(500, 1000, 800, true, false)).toBe(false)
  })
  it('does not play when silent', () => {
    expect(shouldPlay(0, 1000, 800, true, true)).toBe(false)
  })
  it('does not play when global sound disabled', () => {
    expect(shouldPlay(0, 1000, 800, false, false)).toBe(false)
  })
})
