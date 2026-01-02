import { computed } from 'vue'
import type { TransferRenderSourceList, TransferRenderTargetLabel } from 'naive-ui'
import { NAvatar, NCheckbox } from 'naive-ui'
import { useFriendsStore } from '@/stores/friends'
import { useGlobalStore } from '@/stores/global'
import { useGroupStore } from '@/stores/group'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { UserType } from '@/enums'

/** Friend option type for transfer component */
interface FriendOption {
  label: string
  value: string
  avatar: string
  disabled?: boolean
}

const friendsStore = useFriendsStore()
const groupStore = useGroupStore()
const globalStore = useGlobalStore()

export const options = computed<FriendOption[]>(() => {
  return (friendsStore.friends || [])
    .map((f) => {
      const uid = String(f.user_id)
      const userInfo = groupStore.getUserInfo(uid)
      const account = userInfo?.account
      const isBotAccount = typeof account === 'string' && account.toLowerCase() === UserType.BOT
      if (isBotAccount) return null
      return {
        label: userInfo?.name || uid,
        value: uid,
        avatar: AvatarUtils.getAvatarUrl(userInfo?.avatar || '/logoD.png')
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
})

// 获取已禁用选项的值列表
export const getDisabledOptions = () => {
  // 当前选中的房间id
  const currentRoomId = globalStore.currentSessionRoomId

  if (!currentRoomId || !groupStore.userList.length) return []

  // 确保返回群内所有成员的UID
  const result = groupStore.userList.map((member) => member.uid)
  return result
}

// 获取过滤后的选项列表
export const getFilteredOptions = (): FriendOption[] => {
  // 获取禁用选项列表
  const disabledOptions = getDisabledOptions()
  // 当前选中的房间id
  const currentRoomId = globalStore.currentSessionRoomId
  // 如果没有房间ID，返回所有好友
  if (!currentRoomId) return options.value

  // 标记已在群内的好友
  return options.value.map((option) => {
    const isInGroup = disabledOptions.includes(option.value)

    if (isInGroup) {
      // 对于已在群内的好友，添加禁用标记，但保持所有原始属性不变
      return {
        ...option,
        disabled: true
      }
    } else {
      // 对于未在群内的好友，保持原样
      return option
    }
  })
}

// 统一的源列表渲染函数，通过参数控制是否使用过滤后的选项
export const renderSourceList = (
  preSelectedFriendId = '',
  enablePreSelection = true,
  placeholder = ''
): TransferRenderSourceList => {
  return ({ onCheck, checkedOptions, pattern }) => {
    // 使用过滤后的选项列表，确保已在群内的好友被正确标记为禁用
    const baseOptions = getFilteredOptions()

    // 根据搜索模式进一步过滤
    const displayOptions = pattern
      ? baseOptions.filter((option) => option.label?.toLowerCase().includes(pattern.toLowerCase()))
      : baseOptions

    return (
      <div class="select-none">
        {placeholder && <div class="text-(12px [--chat-text-color]) pb-6px">{placeholder}</div>}
        {displayOptions.map((option) => {
          // 判断是否是预选中的好友（仅在启用预选中时生效）
          const isPreSelected = enablePreSelection && option.value === preSelectedFriendId
          // 判断是否被禁用(已在群内)（仅在启用预选中时生效）
          const isDisabled = enablePreSelection && option.disabled === true
          // 如果是预选中的好友或已被选中，则显示为选中状态
          const checked = isPreSelected || checkedOptions.some((o) => o.value === option.value)

          return (
            <div
              key={option.value}
              style={{
                userSelect: 'none',
                display: 'flex',
                margin: '4px 0',
                padding: '4px 8px',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                alignItems: 'center',
                borderRadius: '3px',
                fontSize: '14px',
                opacity: isDisabled && !isPreSelected ? 0.5 : 1,
                backgroundColor: isPreSelected ? 'var(--n-item-color-pending)' : '',
                transition: 'background-color .3s var(--n-bezier)'
              }}
              class={isDisabled ? '' : 'hover:bg-[var(--n-item-color-pending)]'}
              onClick={() => {
                if (isDisabled) return

                const index = checkedOptions.findIndex((o) => o.value === option.value)
                if (index === -1) {
                  onCheck([...checkedOptions.map((o) => o.value), option.value])
                } else {
                  // 如果是预选中的好友且启用了预选中，不允许取消选中
                  if (enablePreSelection && isPreSelected) return
                  const newCheckedOptions = [...checkedOptions]
                  newCheckedOptions.splice(index, 1)
                  onCheck(newCheckedOptions.map((o) => o.value))
                }
              }}>
              <NCheckbox
                checked={checked}
                disabled={isDisabled || (enablePreSelection && isPreSelected && checked)}
                style={{ marginRight: '12px' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                {option.avatar ? (
                  <NAvatar round src={option.avatar || '/logoD.png'} size={24} fallbackSrc="/logoD.png" />
                ) : (
                  <NAvatar round size={24}>
                    {option.label?.slice(0, 1)}
                  </NAvatar>
                )}
                <div style={{ marginLeft: '12px', fontSize: '14px' }}>{option.label}</div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }
}

export const renderLabel: TransferRenderTargetLabel = ({ option }) => {
  const friendOption = option as FriendOption
  return (
    <div class="select-none" style={{ display: 'flex', margin: '6px 0' }}>
      {friendOption.avatar ? (
        <NAvatar round src={friendOption.avatar || '/logoD.png'} size={24} fallbackSrc="/logoD.png" />
      ) : (
        <NAvatar round size={24}>
          {String(option.label).slice(0, 1)}
        </NAvatar>
      )}
      <div style={{ display: 'flex', marginLeft: '12px', alignSelf: 'center', fontSize: '14px' }}>
        {String(option.label)}
      </div>
    </div>
  )
}

// 创建自定义的目标列表渲染函数
export const renderTargetList = (
  preSelectedFriendId = '',
  enablePreSelection = true,
  placeholder = '',
  requiredTag = ''
) => {
  return ({
    onCheck,
    checkedOptions,
    pattern
  }: {
    onCheck: (checkedValueList: Array<string | number>) => void
    checkedOptions: unknown[]
    pattern: string
  }) => {
    // 根据搜索模式过滤选项
    const displayOptions = pattern
      ? checkedOptions.filter((option) => {
          const opt = option as FriendOption
          return opt.label?.toLowerCase().includes(pattern.toLowerCase())
        })
      : checkedOptions

    return (
      <div>
        {placeholder && <div class="text-(12px [--chat-text-color]) pb-6px">{placeholder}</div>}
        {displayOptions.map((option) => {
          const opt = option as FriendOption
          const isPreSelected = enablePreSelection && opt.value === preSelectedFriendId

          return (
            <div
              key={String(opt.value)}
              style={{
                userSelect: 'none',
                display: 'flex',
                margin: '4px 0',
                padding: '4px 8px',
                alignItems: 'center',
                borderRadius: '3px',
                fontSize: '14px',
                backgroundColor: isPreSelected ? 'var(--n-item-color-pending)' : '',
                position: 'relative'
              }}>
              <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                {opt.avatar ? (
                  <NAvatar round src={opt.avatar || '/logoD.png'} size={24} fallbackSrc="/logoD.png" />
                ) : (
                  <NAvatar round size={24}>
                    {String(opt.label).slice(0, 1)}
                  </NAvatar>
                )}
                <div style={{ marginLeft: '12px', fontSize: '14px' }}>{String(opt.label)}</div>
              </div>

              {!isPreSelected && (
                <svg
                  style={{
                    width: '12px',
                    height: '12px',
                    cursor: 'pointer',
                    marginLeft: '8px',
                    color: '#909090'
                  }}
                  onClick={() => {
                    const newCheckedOptions = checkedOptions.filter((o) => (o as FriendOption).value !== opt.value)
                    onCheck(newCheckedOptions.map((o) => (o as FriendOption).value))
                  }}>
                  <use href="#close"></use>
                </svg>
              )}

              {isPreSelected && requiredTag && (
                <div
                  style={{
                    fontSize: '10px',
                    color: '#909090',
                    marginLeft: '8px'
                  }}>
                  {requiredTag}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }
}
