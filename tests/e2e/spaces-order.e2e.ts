import { test, expect } from '@playwright/test'

test('create space and insert ordered child', async ({ page }) => {
  await page.goto('/')
  const spaceId = await page.evaluate(async () => {
    const h: any = (window as any).__spacesTest
    const sid = await h.createSpace('E2E Space')
    await h.insertChildOrdered(sid, '!child1:mock')
    await h.insertChildOrdered(sid, '!child2:mock')
    const children = await h.insertChildOrdered(sid, '!child3:mock')
    return { sid, children }
  })
  expect(spaceId.sid).toContain('!space_')
  expect(Array.isArray((spaceId as any).children)).toBe(true)
  expect((spaceId as any).children.length).toBeGreaterThan(0)
})

test('hierarchy fallback and suggested edit', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const h: any = (window as any).__spacesTest
    const sid = await h.createSpace('E2E Space 2')
    const ch = await h.insertChildOrdered(sid, '!roomX:mock')
    const ch2 = await h.setSuggested(sid, '!roomX:mock', true)
    return { sid, ch, ch2 }
  })
  expect(result.sid).toContain('!space_')
  expect(Array.isArray((result as any).ch2)).toBe(true)
  const edited = (result as any).ch2.find((c: any) => c.roomId === '!roomX:mock')
  expect(edited?.suggested).toBe(true)
})
