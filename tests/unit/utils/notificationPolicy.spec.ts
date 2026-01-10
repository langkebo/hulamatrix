/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect } from 'vitest'
import { computeNotificationPolicy } from '@/utils/notificationPolicy'
import { NotificationTypeEnum } from '@/enums'
import type { SessionItem } from '@/services/types'

describe('notificationPolicy utilities', () => {
  const createMockSession = (overrides: Partial<SessionItem> = {}): SessionItem => ({
    id: 'test-room',
    name: 'Test Room',
    shield: false,
    muteNotification: NotificationTypeEnum.NONE,
    ...overrides
  })

  describe('computeNotificationPolicy', () => {
    describe('skip behavior', () => {
      it('should skip notification when session is shielded', () => {
        const result = computeNotificationPolicy({
          session: createMockSession({ shield: true }),
          isForeground: false,
          isActiveChat: false
        })

        expect(result).toEqual({ skip: true, silent: false })
      })

      it('should not skip notification when session is not shielded', () => {
        const result = computeNotificationPolicy({
          session: createMockSession({ shield: false }),
          isForeground: false,
          isActiveChat: false
        })

        expect(result).toEqual({ skip: false, silent: false })
      })

      it('should skip notification when session is undefined', () => {
        const result = computeNotificationPolicy({
          session: undefined,
          isForeground: false,
          isActiveChat: false
        })

        expect(result).toEqual({ skip: false, silent: false })
      })
    })

    describe('silent behavior', () => {
      it('should be silent when room is muted', () => {
        const result = computeNotificationPolicy({
          session: createMockSession({
            shield: false,
            muteNotification: NotificationTypeEnum.NOT_DISTURB
          }),
          isForeground: false,
          isActiveChat: false
        })

        expect(result).toEqual({ skip: false, silent: true })
      })

      it('should be silent when app is foreground and chat is active', () => {
        const result = computeNotificationPolicy({
          session: createMockSession({
            shield: false,
            muteNotification: NotificationTypeEnum.NONE
          }),
          isForeground: true,
          isActiveChat: true
        })

        expect(result).toEqual({ skip: false, silent: true })
      })

      it('should not be silent when room is not muted and chat is not active', () => {
        const result = computeNotificationPolicy({
          session: createMockSession({
            shield: false,
            muteNotification: NotificationTypeEnum.NONE
          }),
          isForeground: false,
          isActiveChat: false
        })

        expect(result).toEqual({ skip: false, silent: false })
      })

      it('should not be silent when app is background even if chat is active', () => {
        const result = computeNotificationPolicy({
          session: createMockSession({
            shield: false,
            muteNotification: NotificationTypeEnum.NONE
          }),
          isForeground: false,
          isActiveChat: true
        })

        expect(result).toEqual({ skip: false, silent: false })
      })

      it('should not be silent when app is foreground but chat is not active', () => {
        const result = computeNotificationPolicy({
          session: createMockSession({
            shield: false,
            muteNotification: NotificationTypeEnum.NONE
          }),
          isForeground: true,
          isActiveChat: false
        })

        expect(result).toEqual({ skip: false, silent: false })
      })
    })

    describe('shield takes precedence', () => {
      it('should skip and not be silent when shielded, even if room is muted', () => {
        const result = computeNotificationPolicy({
          session: createMockSession({
            shield: true,
            muteNotification: NotificationTypeEnum.NOT_DISTURB
          }),
          isForeground: false,
          isActiveChat: false
        })

        expect(result).toEqual({ skip: true, silent: false })
      })

      it('should skip and not be silent when shielded, even if in active chat', () => {
        const result = computeNotificationPolicy({
          session: createMockSession({
            shield: true,
            muteNotification: NotificationTypeEnum.NONE
          }),
          isForeground: true,
          isActiveChat: true
        })

        expect(result).toEqual({ skip: true, silent: false })
      })
    })

    describe('mute notification modes', () => {
      it('should handle NONE mode - not silent', () => {
        const result = computeNotificationPolicy({
          session: createMockSession({
            shield: false,
            muteNotification: NotificationTypeEnum.NONE
          }),
          isForeground: false,
          isActiveChat: false
        })

        expect(result.silent).toBe(false)
      })

      it('should handle NOT_DISTURB mode - silent', () => {
        const result = computeNotificationPolicy({
          session: createMockSession({
            shield: false,
            muteNotification: NotificationTypeEnum.NOT_DISTURB
          }),
          isForeground: false,
          isActiveChat: false
        })

        expect(result.silent).toBe(true)
      })
    })

    describe('edge cases', () => {
      it('should handle session with all default values', () => {
        const result = computeNotificationPolicy({
          session: createMockSession(),
          isForeground: true,
          isActiveChat: true
        })

        expect(result).toEqual({ skip: false, silent: true })
      })

      it('should handle session without muteNotification property', () => {
        const sessionWithoutMute = {
          id: 'test-room',
          name: 'Test Room',
          shield: false
        } as SessionItem

        const result = computeNotificationPolicy({
          session: sessionWithoutMute,
          isForeground: false,
          isActiveChat: false
        })

        expect(result.silent).toBe(false)
      })
    })
  })
})
