import { describe, it, expect } from 'vitest'
import { validateAlias } from '@/integrations/matrix/alias'

describe('alias validation', () => {
  it('valid alias', () => {
    const r = validateAlias('#room:example.org')
    expect(r.valid).toBe(true)
  })
  it('rejects no #', () => {
    const r = validateAlias('room:example.org')
    expect(r.valid).toBe(false)
  })
  it('rejects bad format', () => {
    const r = validateAlias('#room')
    expect(r.valid).toBe(false)
  })
})
