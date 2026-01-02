import type { SessionItem } from '@/services/types'
import { NotificationTypeEnum } from '@/enums'

export type PolicyInput = { session?: SessionItem; isForeground: boolean; isActiveChat: boolean }
export type PolicyOutput = { skip: boolean; silent: boolean }

export function computeNotificationPolicy(input: PolicyInput): PolicyOutput {
  const shield = !!input.session?.shield
  const silentRoom = input.session?.muteNotification === NotificationTypeEnum.NOT_DISTURB
  const silentView = input.isForeground && input.isActiveChat
  const skip = shield
  const silent = !skip && (silentRoom || silentView)
  return { skip, silent }
}
