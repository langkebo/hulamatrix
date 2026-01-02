import { describe, it, expect } from 'vitest'
import { computeNotificationPolicy } from '@/utils/notificationPolicy'
import { NotificationTypeEnum } from '@/enums'

describe('notification policy', () => {
  it('skips when shield', () => {
    const policy = computeNotificationPolicy({
      session: { shield: true } as any,
      isForeground: false,
      isActiveChat: false
    })
    expect(policy.skip).toBe(true)
    expect(policy.silent).toBe(false)
  })

  it('silent when room set to not disturb', () => {
    const policy = computeNotificationPolicy({
      session: { muteNotification: NotificationTypeEnum.NOT_DISTURB } as any,
      isForeground: false,
      isActiveChat: false
    })
    expect(policy.skip).toBe(false)
    expect(policy.silent).toBe(true)
  })

  it('silent when foreground and active chat', () => {
    const policy = computeNotificationPolicy({ session: {} as any, isForeground: true, isActiveChat: true })
    expect(policy.skip).toBe(false)
    expect(policy.silent).toBe(true)
  })

  it('normal notify when background and not muted', () => {
    const policy = computeNotificationPolicy({ session: {} as any, isForeground: false, isActiveChat: false })
    expect(policy.skip).toBe(false)
    expect(policy.silent).toBe(false)
  })
})
