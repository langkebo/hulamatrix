// 导出基础接口和抽象类
export type { MessageStrategy, AbstractMessageStrategy } from './base'

// 导出各种消息策略实现
export { TextMessageStrategyImpl } from './messages/TextMessageStrategy'
export { ImageMessageStrategyImpl } from './messages/ImageMessageStrategy'
export { DefaultMessageStrategy } from './messages/DefaultMessageStrategy'

// 导入策略实现（用于同步映射）
import { MsgEnum } from '@/enums'
import { TextMessageStrategyImpl } from './messages/TextMessageStrategy'
import { ImageMessageStrategyImpl } from './messages/ImageMessageStrategy'
import { DefaultMessageStrategy } from './messages/DefaultMessageStrategy'

export const messageStrategyMapSync = {
  [MsgEnum.TEXT]: new TextMessageStrategyImpl(),
  [MsgEnum.IMAGE]: new ImageMessageStrategyImpl(),
  [MsgEnum.UNKNOWN]: new DefaultMessageStrategy(),
  [MsgEnum.RECALL]: new DefaultMessageStrategy(),
  [MsgEnum.SYSTEM]: new DefaultMessageStrategy(),
  [MsgEnum.MERGE]: new DefaultMessageStrategy(),
  [MsgEnum.NOTICE]: new DefaultMessageStrategy(),
  [MsgEnum.VIDEO_CALL]: new DefaultMessageStrategy(),
  [MsgEnum.AUDIO_CALL]: new DefaultMessageStrategy(),
  [MsgEnum.MIXED]: new DefaultMessageStrategy(),
  // 为所有消息类型提供默认策略
  [MsgEnum.EMOJI]: new DefaultMessageStrategy(),
  [MsgEnum.VOICE]: new DefaultMessageStrategy(),
  [MsgEnum.LOCATION]: new DefaultMessageStrategy(),
  [MsgEnum.FILE]: new DefaultMessageStrategy(),
  [MsgEnum.VIDEO]: new DefaultMessageStrategy(),
  [MsgEnum.REPLY]: new DefaultMessageStrategy()
}
